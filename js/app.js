/**
 * app.js
 * Wires up Entra ID sign-in/sign-out and, after a successful sign-in,
 * retrieves the configured GitHub document and the user's own OneDrive
 * document (if any) into shared state.
 */

import { EVENT_FEATURE_GUIDE_URL, ARCHITECTURE_BOARD_FOLDER_URL } from './config.js';
import { state } from './state.js';
import { initAuth, signIn, signOut, getAccount } from './auth/auth.js';
import { loadDocumentFromURL, readDocumentFromFolder } from './msgraph/graph-client.js';

function wireAuth() {
  document.getElementById('login-btn').addEventListener('click', async () => {
    try {
      const account = await signIn();
      updateAuthUI(account);
    } catch (err) {
      console.error('Sign-in failed:', err);
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign-out failed:', err);
    }
    updateAuthUI(getAccount());
  });
}

function updateAuthUI(account) {
  const nameEl    = document.getElementById('user-name');
  const loginBtn  = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');

  if (account) {
    nameEl.textContent   = account.name || account.username;
    nameEl.style.display = '';
    loginBtn.style.display  = 'none';
    logoutBtn.style.display = '';
    loadDocumentFromURL(EVENT_FEATURE_GUIDE_URL, doc => { state.eventFeatureGuide = doc; });

    const userFileName = `${account.username}.json`;
    readDocumentFromFolder(ARCHITECTURE_BOARD_FOLDER_URL, userFileName, doc => {
      if (doc == null) return; // no file for this user yet — not an error
      try {
        state.userData = JSON.parse(doc);
      } catch (err) {
        console.error(`Failed to parse ${userFileName}:`, err);
      }
    });
  } else {
    nameEl.style.display    = 'none';
    loginBtn.style.display  = '';
    logoutBtn.style.display = 'none';
  }
}

async function init() {
  wireAuth();
  updateAuthUI(await initAuth());
}

init();
