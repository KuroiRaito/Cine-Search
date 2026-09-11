// Runtime kill switch for search experiments.
//
// v1 is the untouched TMDB path that shipped. v2 is anything we build on top.
// Default is v1: a bad experiment cannot reach users, and any run can be
// reverted without a deploy by flipping one env var.
//
// This is also the bucketing seam Phase 3's A/B test will use.

export const SEARCH_VARIANTS = { V1: 'v1-baseline', V2: 'v2' };

export function getSearchVariant() {
    // Manual override for side-by-side demos: ?search=v2
    if (typeof window !== 'undefined') {
        const q = new URLSearchParams(window.location.search).get('search');
        if (q === 'v1') return SEARCH_VARIANTS.V1;
        if (q === 'v2') return SEARCH_VARIANTS.V2;
    }
    return import.meta.env.VITE_SEARCH_V2 === 'true' ? SEARCH_VARIANTS.V2 : SEARCH_VARIANTS.V1;
}

export const isV2 = () => getSearchVariant() === SEARCH_VARIANTS.V2;
