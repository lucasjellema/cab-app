/**
 * state.js
 * Shared mutable application state.
 * All modules import this object and mutate its properties directly;
 * ES module live bindings ensure every importer sees the same reference.
 */

export const state = {
  /**
   * Raw text of EVENT_FEATURE_GUIDE_URL (config.js), loaded via
   * msgraph/graph-client.js's loadDocumentFromURL() after a successful sign-in.
   * @type {string|null}
   */
  eventFeatureGuide: null,

  /**
   * Parsed contents of `<username>.json` from the shared OneDrive folder
   * (config.js's ARCHITECTURE_BOARD_FOLDER_URL), loaded via
   * msgraph/graph-client.js's readDocumentFromFolder() after a successful
   * sign-in. Stays null until sign-in *and* the file is found — most users
   * won't have one yet.
   * @type {Object|null}
   */
  userData: null,
};
