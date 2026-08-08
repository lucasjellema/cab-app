# CLAUDE.md — Conclusion Architecture Board

Static, no-build web app (HTML/CSS/vanilla JS ES modules). No framework, no
bundler, no package.json. Currently a thin shell: branded landing page +
Entra ID sign-in + fetch-and-stash of one reference GitHub document + a
per-user JSON document read from (and, via a helper function, writable to) a
shared OneDrive folder.

---

## Serve

```bash
python -m http.server   # then http://localhost:8000
```
`index.html` loads `js/app.js` as an ES module (`<script type="module">`); ES
modules require HTTP, not `file://`, in most browsers.

---

## File map

```
index.html                       page shell — header (logo + auth controls), hero, about section
css/
  styles.css                       app-specific additions layered on top of the house style
  conclusion-huisstijl CSS.css     Conclusion brand stylesheet — tokens, components (do not edit casually)
images/
  conclusion_rainb_rgb_logo.webp   logo asset shown in the header
js/
  app.js       entry point — wireAuth(), updateAuthUI(account), init(); no other modules import app.js
  config.js    EVENT_FEATURE_GUIDE_URL + ARCHITECTURE_BOARD_FOLDER_URL consts — single source of truth for what gets fetched post-login
  state.js     state object — { eventFeatureGuide, userData }
  auth/
    authConfig.js  msalConfig + loginRequest — Entra ID app registration (clientId, authority, scopes)
    auth.js        initAuth(), signIn(), signOut(), getAccount(), getAccessToken() — MSAL.js wrapper
  msgraph/
    graph-client.js  loadDocumentFromURL(), listFolderContents(), readDocumentFromFolder(),
                     writeDocumentToFolder() — GitHub/OneDrive/plain-URL + shared-folder Graph calls
```

**Dependency order (no circular imports):**
```
authConfig  →  auth  →  msgraph
config, state, auth, msgraph  →  app
```
`app.js` is the only module that touches the DOM (`#login-btn`, `#logout-btn`,
`#user-name`). `auth.js` and `graph-client.js` are DOM-free and reusable as-is.

---

## Authentication

Sign-in with Microsoft Entra ID (Azure AD) via `msal-browser`
(`msal.PublicClientApplication`, popup flow). Purely client-side identity
display — nothing on the page is gated behind it; the page renders and works
fully before/without sign-in.

`js/auth/authConfig.js` — `msalConfig` (clientId, authority,
`redirectUri: window.location.origin`, `cacheLocation: "sessionStorage"`) and
`loginRequest` (`scopes: ["User.Read","openid","profile","Files.ReadWrite"]`
— `ReadWrite`, not just `Read`, because `writeDocumentToFolder()` needs write
access). Edit this file to point at a different app registration/tenant.

`js/auth/auth.js`:
- `loadMsalScript()` — module-private; appends a `<script>` tag for
  `msal-browser.min.js` from the `alcdn.msauth.net` CDN if `window.msal` isn't
  already present. No bundling — fetched lazily instead of vendored.
- `initAuth()` — awaits `loadMsalScript()`, constructs `msalInstance`, restores
  the active account from `sessionStorage` (via `getAllAccounts()` +
  `setActiveAccount`). Returns the account or `null`.
- `signIn()` — `msalInstance.loginPopup(loginRequest)`, then
  `setActiveAccount(result.account)`. Throws if `initAuth()` hasn't run yet.
- `signOut()` — `msalInstance.logoutPopup({ account })`.
- `getAccount()` — `msalInstance?.getActiveAccount() ?? null`.
- `getAccessToken()` — silent token acquisition; returns `null` (and logs) if
  not signed in or silent acquisition fails. Used by `graph-client.js` for
  OneDrive/SharePoint URLs; not needed for the current GitHub URL.

**Wiring (`app.js`)**:
```js
async function init() {
  wireAuth();
  updateAuthUI(await initAuth());
}
```
- `wireAuth()` binds click handlers on `#login-btn` (calls `signIn()`, then
  `updateAuthUI`) and `#logout-btn` (calls `signOut()`, then
  `updateAuthUI(getAccount())`).
- `updateAuthUI(account)` toggles `#user-name` / `#login-btn` / `#logout-btn`
  visibility via `style.display`, sets `#user-name` text to
  `account.name || account.username`. When `account` is truthy it also kicks
  off the document load (see below) — fires both on explicit sign-in and on a
  session restored from `sessionStorage` on page load.

**DOM elements** (`index.html`, inside `<header class="nav">`, in a
`.nav__auth` wrapper): `#user-name` (span, hidden by default), `#login-btn`,
`#logout-btn` (hidden by default). Styled via the house style's `.btn
.btn--ghost .btn--sm` classes; layout tweaks in `css/styles.css`
(`.nav__auth`, `.nav__username`).

---

## Reference document fetch

After a successful sign-in, `app.js`'s `updateAuthUI(account)` loads a
markdown document and stashes its raw text on `state`:

```js
loadDocumentFromURL(EVENT_FEATURE_GUIDE_URL, doc => { state.eventFeatureGuide = doc; });
```

- **`EVENT_FEATURE_GUIDE_URL`** (`config.js`) — the source URL:
  `https://raw.githubusercontent.com/lucasjellema/company-timeline/refs/heads/main/EVENT_FEATURE_GUIDE.md`.
- **`state.eventFeatureGuide`** (`state.js`) — `null` until loaded, then the
  raw text. No consumer reads it yet — this is the load-and-store step only.
  If you're adding a feature that displays or uses this document, read from
  `state.eventFeatureGuide`; don't fetch it again.
- **`loadDocumentFromURL(url, completionCallback)`** (`js/msgraph/graph-client.js`):
  - GitHub `blob` URLs are auto-rewritten to `raw.githubusercontent.com` (not
    needed here — the configured URL is already raw).
  - `onedrive.live.com` / `1drv.ms` / `sharepoint.com` URLs go through
    `auth.getAccessToken()` and the Microsoft Graph SDK instead of a plain
    `fetch()`.
  - Any other URL (including the current GitHub one) is fetched directly.
  - Errors are caught, logged, and surfaced via `alert(...)`; no promise to
    await — all results arrive through `completionCallback`.

---

## Shared OneDrive folder & per-user document

`config.js`'s `ARCHITECTURE_BOARD_FOLDER_URL` is a OneDrive/SharePoint share
link to a folder (not a file). Three functions in
`js/msgraph/graph-client.js` operate on it, all via the Graph `/shares/{id}`
→ driveId/itemId resolution (factored into the module-private
`resolveShareItem(url)` helper, shared with `loadDocumentFromURL`'s OneDrive
branch):

- **`listFolderContents(folderUrl, completionCallback)`** — lists the
  folder's immediate children via `/drives/{driveId}/items/{itemId}/children`.
  Calls back with `{ folders: [...], files: [...] }` (each entry has at least
  `id`, `name`, `webUrl`).
- **`readDocumentFromFolder(folderUrl, fileName, completionCallback)`** —
  reads one named file from the folder via Graph's colon path syntax
  (`/drives/{driveId}/items/{itemId}:/{fileName}:/content`). Calls back with
  the file's text content, or **`null`** (not an error/alert) if the file
  doesn't exist — Graph's `itemNotFound` / HTTP 404 is treated as an expected
  "not found" outcome, since callers use this to probe for optional per-user
  files.
- **`writeDocumentToFolder(folderUrl, fileName, content, completionCallback?)`**
  — creates or overwrites a named file in the folder (same colon path syntax,
  `PUT .../content`). Requires the signed-in user to have write access to the
  folder; requires the `Files.ReadWrite` scope (see Authentication above).
  `completionCallback` is optional and receives the updated Graph driveItem
  metadata.

**Per-user document on sign-in** (`app.js`'s `updateAuthUI`): alongside the
`EVENT_FEATURE_GUIDE_URL` fetch, it also probes the shared folder for a file
named `${account.username}.json`:

```js
readDocumentFromFolder(ARCHITECTURE_BOARD_FOLDER_URL, `${account.username}.json`, doc => {
  if (doc == null) return;           // no file for this user yet
  state.userData = JSON.parse(doc);  // parse failures are logged, not surfaced to the user
});
```

- **`state.userData`** (`state.js`) — `null` until sign-in *and* a matching
  file is found; most users won't have one. Holds the **parsed** object (the
  file is JSON), unlike `state.eventFeatureGuide` which stays raw text
  (markdown). If you add a feature that writes user data back, call
  `writeDocumentToFolder(ARCHITECTURE_BOARD_FOLDER_URL, \`${account.username}.json\`, JSON.stringify(state.userData), ...)`
  — don't invent a second write path.
- `ARCHITECTURE_BOARD_FOLDER_URL` in `config.js` points at a real shared
  OneDrive folder (`conclusionfutureit-my.sharepoint.com/.../data`). Whether
  a given signed-in user can read/write there depends on the sharing
  permissions set on that folder in OneDrive, not on anything in this repo.

---

## House style (`css/conclusion-huisstijl CSS.css`)

Treat this file as a design-token library, not a place to add app-specific
rules — put those in `css/styles.css` instead. Key primitives:

- CSS custom properties on `:root`: colors (`--color-*`), fonts
  (`--font-heading` = Montserrat, `--font-serif` = Source Serif 4), type scale
  (`--fs-*`), spacing (`--space-*`).
- Layout: `.nav` (sticky black header, `display:flex; justify-content:
  space-between`), `.hero` (black, full-bleed), `.container`, `.grid`.
- Components: `.btn` / `.btn--primary` / `.btn--secondary` / `.btn--ghost`,
  `.card`, `.badge`, `.footer`.

The stylesheet's filename contains a literal space (`conclusion-huisstijl
CSS.css`). `index.html` links it with the space percent-encoded
(`href="css/conclusion-huisstijl%20CSS.css"`) — keep that encoding if you
touch the `<link>` tag, or rename the file and update the link consistently,
don't do one without the other.

---

## Gotchas

- **ES modules require HTTP.** Opening `index.html` directly via `file://`
  will silently fail on `import` in most real-world browser setups. Always
  serve over `http://localhost:...` when testing.
- **`initAuth()` fetches MSAL from a CDN.** Fully offline, the script load
  hangs/fails silently (`window.msal` stays `undefined`), `initAuth()`
  resolves to `null`, and sign-in becomes unavailable — the rest of the page
  is unaffected.
- **`signIn()` requires `initAuth()` to have completed first.** `wireAuth()`
  binds the `#login-btn` click handler synchronously, before `init()` awaits
  `initAuth()`. A click during that brief window throws `"MSAL not
  initialized"` (caught and logged); in practice `initAuth()` resolves well
  before a user can click.
- **No build step, no `package.json`.** Don't introduce npm/bundler tooling
  for a small addition — this project intentionally stays pure static
  HTML/CSS/JS. If a real build becomes necessary, raise it explicitly rather
  than adding it silently.
- **`state.js` is intentionally minimal right now.** Add new shared state as
  additional properties on the existing `state` object (matching the
  `mjp-viewer` sibling project's pattern) rather than introducing new global
  state containers.
- **OneDrive folder functions require an access token.** Unlike the plain
  `fetch()` path in `loadDocumentFromURL`, everything in the "Shared OneDrive
  folder" section goes through `auth.getAccessToken()` inside
  `resolveShareItem()` — it silently proceeds with `token = null` if the user
  isn't signed in (`getAccessToken()`'s documented behavior), which will then
  fail Graph's auth check. Only call these after a successful sign-in.
