// v2 — built in Phase 2. Falls through to v1 until it exists, so the flag is a
// verified no-op and turning it on can never be worse than the baseline.
import { search as searchV1 } from '../v1.js';

export async function search(query, opts = {}, { signal } = {}) {
    const r = await searchV1(query, opts, { signal });
    return { ...r, meta: { ...r.meta, variant: 'v2', note: 'not yet implemented; delegating to v1' } };
}
