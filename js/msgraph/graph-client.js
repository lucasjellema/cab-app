import * as auth from '../auth/auth.js';
import { Client, ResponseType } from "https://cdn.jsdelivr.net/npm/@microsoft/microsoft-graph-client@3.0.4/+esm";

function toBase64Url(str) {
    // base64url (no padding, + → -, / → _)
    return btoa(unescape(encodeURIComponent(str)))
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

// Resolves a OneDrive/SharePoint share URL (folder or file) to its driveId + itemId
// via the Graph /shares endpoint, and returns a ready-to-use graphClient alongside it.
async function resolveShareItem(url) {
    const token = await auth.getAccessToken();
    const graphClient = Client.init({
        authProvider: done => done(null, token)
    });

    const shareId = 'u!' + toBase64Url(url);

    const item = await graphClient.api(`/shares/${shareId}/driveItem`).get();

    const driveId = item.parentReference?.driveId; // bv. "b!..."
    const itemId = item.id;

    if (!driveId || !itemId) throw new Error("driveId of itemId ontbreekt in metadata");

    return { graphClient, driveId, itemId, name: item.name ?? "item" };
}

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
                const { graphClient, driveId, itemId } = await resolveShareItem(url);

                // content ophalen vanaf de juiste drive
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

// folderUrl is a OneDrive/SharePoint share URL pointing at a folder.
// completionCallback is called with { folders: [{id,name,webUrl}], files: [{id,name,webUrl,size,lastModifiedDateTime}] }
export async function listFolderContents(folderUrl, completionCallback) {
    try {
        const { graphClient, driveId, itemId } = await resolveShareItem(folderUrl);

        const res = await graphClient.api(`/drives/${driveId}/items/${itemId}/children`).get();
        const items = res.value ?? [];

        const folders = items
            .filter(i => i.folder)
            .map(i => ({ id: i.id, name: i.name, webUrl: i.webUrl, childCount: i.folder.childCount }));

        const files = items
            .filter(i => i.file)
            .map(i => ({ id: i.id, name: i.name, webUrl: i.webUrl, size: i.size, lastModifiedDateTime: i.lastModifiedDateTime }));

        completionCallback({ folders, files });
    } catch (err) {
        console.error(err);
        alert("Failed to list folder contents: " + err.message);
    }
}

// folderUrl is a OneDrive/SharePoint share URL pointing at a folder.
// fileName is the name of the document to read from that folder (e.g. "<username>.json").
// completionCallback is called with the file's text content, or null if no such file exists in the folder.
export async function readDocumentFromFolder(folderUrl, fileName, completionCallback) {
    try {
        const { graphClient, driveId, itemId } = await resolveShareItem(folderUrl);

        const blob = await graphClient
            .api(`/drives/${driveId}/items/${itemId}:/${encodeURIComponent(fileName)}:/content`)
            .responseType(ResponseType.BLOB)
            .get();

        const data = await blob.text();
        completionCallback(data);
    } catch (err) {
        // Graph returns itemNotFound when the file doesn't exist in the folder — that's an
        // expected outcome for callers probing for a per-user file, not an error to surface.
        if (err.statusCode === 404 || err.code === 'itemNotFound') {
            completionCallback(null);
            return;
        }
        console.error(err);
        alert("Failed to read " + fileName + ": " + err.message);
    }
}

// folderUrl is a OneDrive/SharePoint share URL pointing at a folder the signed-in user has
// write access to. fileName is created if it doesn't exist yet, or overwritten if it does.
// content is the text to write (e.g. a JSON.stringify()'d object).
// completionCallback (optional) is called with the updated Graph driveItem metadata.
export async function writeDocumentToFolder(folderUrl, fileName, content, completionCallback) {
    try {
        const { graphClient, driveId, itemId } = await resolveShareItem(folderUrl);

        const result = await graphClient
            .api(`/drives/${driveId}/items/${itemId}:/${encodeURIComponent(fileName)}:/content`)
            .put(content);

        completionCallback?.(result);
    } catch (err) {
        console.error(err);
        alert("Failed to write " + fileName + ": " + err.message);
    }
}
