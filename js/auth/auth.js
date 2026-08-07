/**
 * auth.js
 * Microsoft Entra ID (Azure AD) sign-in via MSAL.js.
 * MSAL is loaded lazily from CDN so the app still works fully offline
 * (Load JSON fallback) when sign-in is never used.
 */

import { msalConfig, loginRequest } from './authConfig.js';

const MSAL_SRC = 'https://alcdn.msauth.net/browser/2.30.0/js/msal-browser.min.js';

let msalInstance = null;

function loadMsalScript() {
  if (window.msal) return Promise.resolve();
  return new Promise(resolve => {
    const script = document.createElement('script');
    script.src = MSAL_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      console.error('Failed to load MSAL.js');
      resolve();
    };
    document.head.appendChild(script);
  });
}

/**
 * Load MSAL and restore any previously signed-in account (from sessionStorage).
 * @returns {Promise<Object|null>} The active account, or null if none.
 */
export async function initAuth() {
  await loadMsalScript();
  if (!window.msal) {
    console.warn('MSAL not available — sign-in disabled.');
    return null;
  }

  msalInstance = new msal.PublicClientApplication(msalConfig);

  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) msalInstance.setActiveAccount(accounts[0]);

  return getAccount();
}

/** @returns {Object|null} The currently signed-in account, or null. */
export function getAccount() {
  return msalInstance?.getActiveAccount() ?? null;
}

/** Opens the Entra ID sign-in popup. @returns {Promise<Object>} The signed-in account. */
export async function signIn() {
  if (!msalInstance) throw new Error('MSAL not initialized');
  const result = await msalInstance.loginPopup(loginRequest);
  msalInstance.setActiveAccount(result.account);
  return result.account;
}

/** Signs the current user out. */
export async function signOut() {
  if (!msalInstance) return;
  const account = getAccount();
  await msalInstance.logoutPopup({ account });
}

/**
 * Get a valid access token for the current user
 * @returns {Promise<string|null>} Access token or null
 */
export async function getAccessToken() {
    if (!msalInstance) {
        console.error("MSAL instance not initialized");
        return null;
    }

    const account = getAccount();
    if (!account) {
        // Not signed in
        return null;
    }

    const silentRequest = {
        scopes: loginRequest.scopes,
        account: account,
        forceRefresh: false
    };

    try {
        const response = await msalInstance.acquireTokenSilent(silentRequest);
        return response.accessToken;
    } catch (error) {
        console.error("Failed to acquire access token:", error);
        return null; // Handle interaction requirement if needed, but for now silent only
    }
}
