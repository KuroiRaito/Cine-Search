// Search — the public surface.
//
// The screen is the default export. `search()` is exported too: it is the one
// entry point the eval harness scores, and the only way any caller runs a
// query. Which variant answers is this module's business.
export { default } from './SearchPage.jsx';
export { search, DEFAULT_SEARCH_OPTS } from './lib/index.js';
