// Re-export of the TMDB client's transport hook, for Node-side tooling
// (eval harness, benchmarks) that needs to inject a fetch implementation.
export { setFetchImpl } from '../shared/tmdb/client.js';
