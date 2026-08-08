# Conclusion Architecture Board

A static, no-build web app in the Conclusion house style. It shows a placeholder
landing page and lets a user sign in with their Microsoft Conclusion (Entra ID)
account. After sign-in, a reference markdown document is fetched from GitHub, and
the app looks for a personal `<username>.json` document in a shared OneDrive
folder — both are held in memory for later use by the app.

## Run it

This is a pure static site — no build step, no dependencies to install. Because
the pages use ES modules (`import`/`export`), open it via a local HTTP server
rather than double-clicking `index.html` (browsers block `file://` module
imports):

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## What's in the box

```
index.html                       page shell — header/logo, hero, about section, auth controls
styles.css                       small app-specific additions on top of the house style
conclusion-huisstijl CSS.css     Conclusion brand stylesheet (design tokens, components)
conclusion_rainb_rgb_logo.webp   Conclusion logo, shown in the header
js/
  app.js                         entry point — wires sign-in/sign-out and loads the guide + user doc
  config.js                      EVENT_FEATURE_GUIDE_URL + ARCHITECTURE_BOARD_FOLDER_URL
  state.js                       shared in-memory state (loaded documents)
  auth/
    authConfig.js                MSAL config: Entra ID app registration + requested scopes
    auth.js                      thin MSAL.js wrapper: initAuth/signIn/signOut/getAccount
  msgraph/
    graph-client.js               loadDocumentFromURL(), listFolderContents(), readDocumentFromFolder(),
                                   writeDocumentToFolder() — fetch/list/read/write against GitHub or a shared OneDrive folder
```

## Sign-in

Sign-in uses Microsoft Entra ID via [MSAL.js](https://github.com/AzureAD/microsoft-authentication-library-for-js),
loaded lazily from a CDN — nothing to install. The app registration (client ID,
tenant) lives in [`js/auth/authConfig.js`](js/auth/authConfig.js); update it to
point at a different Entra ID tenant/app.

Clicking **Log in** opens a popup sign-in window. On success, the user's display
name appears in the header and the app automatically:

- fetches the reference document configured in
  [`js/config.js`](js/config.js) (`EVENT_FEATURE_GUIDE_URL`), storing its raw
  text in `state.eventFeatureGuide`;
- looks for a personal `<username>.json` file in the shared OneDrive folder
  (`ARCHITECTURE_BOARD_FOLDER_URL`) and, if found, stores its parsed contents
  in `state.userData`. Nothing happens if the file doesn't exist yet — that's
  the normal case for most users.

Sign-in is optional — the rest of the page works without it. Reading and
writing files in the shared folder requires the `Files.ReadWrite` Graph scope
(see [`js/auth/authConfig.js`](js/auth/authConfig.js)) and depends on the
OneDrive sharing permissions set on that folder for the signed-in user.

## Further reading

- [`CLAUDE.md`](CLAUDE.md) — for AI coding agents working on this repo
- [`architecture.md`](architecture.md) — for human software architects
