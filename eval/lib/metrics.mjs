// Scoring. Every metric here is deliberately scoped to the query types where it
// is meaningful; where it is not, we emit null rather than a flattering number.

export const ANSWER_TYPES = ['known_item', 'open_set', 'not_in_catalogue'];

/** Composite key: TMDB ids collide across movie/tv, so media_type is required. */
export const keyOf = (item) => `${item.media_type}:${item.id}`;

/**
 * Score one query.
 * @param {object} q      entry from queries.json
 * @param {object[]} results ranked results from the search implementation
 */
/** Graded gain for a result key. 0 = not labelled acceptable. */
const gradeOf = (expected, key) => expected.get(key) ?? 0;

/**
 * NDCG@k over graded labels.
 *
 * Binary relevance cannot say that one acceptable mood result is better than
 * another, and raw DCG is not comparable across queries with different numbers
 * of correct answers ("inception" has 1, "sad war movie" has ~15). Normalising
 * against the ideal ordering fixes both, which is why this replaces the
 * per-answer-type metric split.
 */
function ndcgAt(ranked, expected, k) {
    const disc = (i) => 1 / Math.log2(i + 2);           // i is 0-based
    const dcg = ranked.slice(0, k).reduce((sum, key, i) => sum + gradeOf(expected, key) * disc(i), 0);
    const ideal = [...expected.values()].sort((a, b) => b - a).slice(0, k);
    const idcg = ideal.reduce((sum, g, i) => sum + g * disc(i), 0);
    return idcg > 0 ? dcg / idcg : null;
}

export function scoreQuery(q, results) {
    const ranked = results.map(keyOf);
    // schema 2: expected is [{key, grade}]. Grade >= 1 counts as acceptable for
    // the binary metrics, which are kept because they are easier to explain.
    const expected = new Map((q.expected || []).map((e) => [e.key, e.grade ?? 3]));
    const zeroResult = ranked.length === 0;

    // Catalogue gaps are a data problem, not a ranking problem. Scoring them
    // would penalise the ranker for TMDB's thin Indian-language coverage.
    if (q.answer_type === 'not_in_catalogue') {
        return { id: q.id, category: q.category, answer_type: q.answer_type,
                 scored: false, zeroResult, catalogueGap: true };
    }

    const top5 = ranked.slice(0, 5);
    const top10 = ranked.slice(0, 10);
    const hitsTop5 = top5.filter(k => expected.has(k)).length;
    const ndcg10 = ndcgAt(ranked, expected, 10);
    const ndcg5 = ndcgAt(ranked, expected, 5);

    // Headline metric. Empty OR nothing acceptable in the top 5.
    // Deliberately chosen over bare zero-result rate: a "never-empty" fallback
    // drives zero-result to ~0% while changing nothing for the user. This does not move.
    const nullAndLow = zeroResult || hitsTop5 === 0;

    const base = { id: q.id, category: q.category, answer_type: q.answer_type,
                   scored: true, zeroResult, nullAndLow, catalogueGap: false,
                   resultCount: ranked.length, ndcg10, ndcg5 };

    if (q.answer_type === 'known_item') {
        // One correct answer => rank-sensitive metrics are the honest ones.
        // P@5 is NOT reported: with |expected|=1 it caps at 0.2 and reads as failure.
        const idx = ranked.findIndex(k => expected.has(k));
        return { ...base,
            mrr: idx === -1 ? 0 : 1 / (idx + 1),
            hit1: ranked[0] ? expected.has(ranked[0]) : false,
            hit5: hitsTop5 > 0,
            rank: idx === -1 ? null : idx + 1,
            precision5: null, coverage10: null };
    }

    // open_set: many acceptable answers => set metrics.
    // MRR is NOT reported: with a large acceptable set something lands at rank 1
    // almost by accident and MRR reads ~0.9, inflating the aggregate.
    const hitsTop10 = top10.filter(k => expected.has(k)).length;
    return { ...base,
        precision5: top5.length ? hitsTop5 / 5 : 0,
        // NOT recall: the acceptable set for "sad war movie" is open and unbounded.
        // This is coverage of the labelled set only. Say that out loud.
        coverage10: expected.size ? hitsTop10 / Math.min(expected.size, 10) : null,
        mrr: null, hit1: null, hit5: null, rank: null };
}

const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const frac = (n, d) => ({ n, d, pct: d ? n / d : null });

/** Aggregate a list of per-query scores into a reportable block. */
export function aggregate(scores) {
    const scored = scores.filter(s => s.scored);
    const known = scored.filter(s => s.answer_type === 'known_item');
    const open = scored.filter(s => s.answer_type === 'open_set');
    const gaps = scores.filter(s => s.catalogueGap);

    return {
        n: scores.length,
        nScored: scored.length,
        // Headline
        nullAndLow5: frac(scored.filter(s => s.nullAndLow).length, scored.length),
        // Diagnostic: splits "empty" from "populated but wrong"
        zeroResult: frac(scored.filter(s => s.zeroResult).length, scored.length),
        populatedButWrong: frac(scored.filter(s => s.nullAndLow && !s.zeroResult).length, scored.length),
        // Known-item only
        mrr: known.length ? mean(known.map(s => s.mrr)) : null,
        hit1: known.length ? frac(known.filter(s => s.hit1).length, known.length) : null,
        // Open-set only
        precision5: open.length ? mean(open.map(s => s.precision5)) : null,
        coverage10: open.length ? mean(open.map(s => s.coverage10).filter(v => v !== null)) : null,
        // Primary ranking-quality metric: graded, position-aware, and comparable
        // across queries regardless of how many correct answers they have.
        ndcg10: mean(scored.map(s => s.ndcg10).filter(v => v !== null && v !== undefined)),
        ndcg5: mean(scored.map(s => s.ndcg5).filter(v => v !== null && v !== undefined)),
        // Reported separately, never folded into the scores above
        catalogueGap: frac(gaps.length, scores.length),
        // Small samples are noise. The report flags these rather than trusting them.
        directionalOnly: scored.length < 15,
    };
}

export function byCategory(scores) {
    const out = {};
    for (const s of scores) (out[s.category] ||= []).push(s);
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, aggregate(v)]));
}
