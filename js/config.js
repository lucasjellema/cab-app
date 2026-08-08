/**
 * config.js
 * Application configuration.
 */

/**
 * Source document loaded after a successful sign-in (see app.js `updateAuthUI`).
 * Raw GitHub URL — fetched as plain text via msgraph/graph-client.js's loadDocumentFromURL().
 */
export const EVENT_FEATURE_GUIDE_URL =
  'https://raw.githubusercontent.com/lucasjellema/company-timeline/refs/heads/main/EVENT_FEATURE_GUIDE.md';

/**
 * Shared OneDrive folder that holds per-user Architecture Board data.
 * After a successful sign-in, app.js looks for a file named `<username>.json`
 * in this folder (see msgraph/graph-client.js's readDocumentFromFolder()) and,
 * for users with write access, can save back to it via writeDocumentToFolder().
 */
export const ARCHITECTURE_BOARD_FOLDER_URL =
  'https://conclusionfutureit-my.sharepoint.com/:f:/r/personal/lsla_aadsaa_amis_nl/Documents/data?d=w8d77c34295b24152b70890&csf=1&web=1&e=ZU2Z';