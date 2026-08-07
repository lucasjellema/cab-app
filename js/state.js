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
};
