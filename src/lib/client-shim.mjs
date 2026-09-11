// Re-export of the TMDB client's transport hook, for Node-side tooling
// (eval harness, benchmarks) that needs to inject a fetch implementation.
export { setFetchImpl } from './tmdb/client.js';
