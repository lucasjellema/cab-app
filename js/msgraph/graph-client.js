import * as auth from '../auth/auth.js';
import { Client, ResponseType } from "https://cdn.jsdelivr.net/npm/@microsoft/microsoft-graph-client@3.0.4/+esm";

// url is the URL to load the document from (string) - URL can be a GitHub blob URL, a OneDrive share URL, or any other URL
// completionCallback is a function that will be called with the loaded data (string) when the document is successfully loaded
export async function loadDocumentFromURL(url,completionCallback) {
    try {
        let fetchUrl = url;

        // Auto-convert GitHub Blob URLs to Raw URLs to avoid CORS
        // From: https://github.com/user/repo/blob/main/path/to/file.json
        // To:   https://raw.githubusercontent.com/user/repo/main/path/to/file.json
        if (url.includes('github.com') && url.includes('/blob/')) {
            fetchUrl = url.replace('github.com', 'raw.githubusercontent.com')
                .replace('/blob/', '/');
            console.log(`Converted GitHub URL to Raw: ${fetchUrl}`);
        }

        // OneDrive Workaround
        // Convert Share URL to Graph API endpoint to get direct download URL
        if (url.includes('onedrive.live.com') || url.includes('1drv.ms') || url.includes('sharepoint.com')) {
            try {
                // Get token using our new auth helper
                const token = await auth.getAccessToken();
                const headers = {};
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                    console.log("Using authenticated session for OneDrive fetch");
                } else {
                    console.log("Attempting unauthenticated OneDrive fetch");
                }

                // GRAPH CLIENT

                const graphClient = Client.init({
                    authProvider: done => done(null, token)
                });


                function toBase64Url(str) {
                    // base64url (no padding, + → -, / → _)
                    return btoa(unescape(encodeURIComponent(str)))
                        .replace(/=/g, "")
                        .replace(/\+/g, "-")
                        .replace(/\//g, "_");
                }


                const shareId = 'u!' + toBase64Url(url);

                // (A) metadata ophalen (via shares)
                const item = await graphClient.api(`/shares/${shareId}/driveItem`).get();

                const driveId = item.parentReference?.driveId; // bv. "b!..."
                const itemId = item.id;
                const name = item.name ?? "download";

                if (!driveId || !itemId) throw new Error("driveId of itemId ontbreekt in metadata");

                // (B) content ophalen vanaf de juiste drive
                const blob = await graphClient
                    .api(`/drives/${driveId}/items/${itemId}/content`)
                    .responseType(ResponseType.BLOB)   // gebruik enum i.p.v. string
                    .get();

                const data  = await blob.text();
                completionCallback(data);
            }
            catch (odErr) {
                console.warn("OneDrive workaround failed, falling back to original URL", odErr);
                // Fallback to original URL if logic fails, though likely to fail CORS too
                if (odErr.message.includes("Authentication required")) {
                    alert(odErr.message);
                }
            }
        }
        else {
            const res = await fetch(fetchUrl);
            if (!res.ok) throw new Error(`Failed to load ${url}`);
            let data = await res.text();
            completionCallback(data);
            
        }

    } catch (err) {
        console.error(err);
        alert("Failed to load story: " + err.message);
    }
}
