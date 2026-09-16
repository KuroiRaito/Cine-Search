import { supabase } from '../../shared/auth/supabaseClient.js';
import { STATUSES } from '../library';

const unwrap = ({ data, error }) => {
    if (error) throw error;
    return data;
};

/**
 * Everything this screen draws, in one round trip.
 *
 * Replaces taste_summary(), which answered one question — what have you
 * watched, by genre, decade and person. The profile asks eight more: films
 * apart from series, a mean on every dimension rather than only a count, how
 * your statuses are distributed, which years you watched in, and how widely
 * you score. See docs/profile-module.html §07 and supabase/007_profile_stats.sql.
 */
export async function profileStats() {
    return supabase.rpc('profile_stats').then(unwrap);
}

/**
 * Minutes are stored as minutes and formatted where they are drawn — the same
 * integer becomes "18.4 days" on a stat tile and "3d 4h" on a card.
 */
export function formatDays(minutes) {
    if (!minutes) return '0';
    return (minutes / 1440).toFixed(1);
}

export function formatSpan(minutes) {
    if (!minutes) return '—';
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
    if (h > 0) return `${h}h`;
    return `${minutes}m`;
}

/**
 * "Score" needs a floor or it is meaningless: one film you gave a 10 would
 * outrank a genre you have watched for twenty years. Three is enough to be an
 * opinion rather than an accident.
 */
export const SCORE_FLOOR = 3;

/**
 * The stacked bar under each medium's block.
 *
 * Two rules from §07. A segment under 2% still renders at 2%, because a person
 * with three dropped films out of four hundred should still be able to see
 * that they drop things — and a bar that silently omits a state is a bar that
 * lies about the shape of a library. Widths are then normalised, or the floor
 * pushes the total past 100 and the last segment is clipped.
 *
 * The bar is never the only carrier: the caller draws the legend beside it,
 * because six hues in a row is exactly the case the foundations warn about.
 */
const MIN_SEGMENT = 2;

export function distribution(byStatus) {
    // Biggest first, not in status order. The dominant state should lead the
    // bar and the legend — a library that is four-fifths watched reads as a
    // library that is four-fifths watched, at a glance and without counting.
    const rows = STATUSES
        .map((s) => ({ key: s.key, label: s.short, tone: s.tone, n: byStatus?.[s.key] || 0 }))
        .filter((r) => r.n > 0)
        .sort((a, b) => b.n - a.n);
    const total = rows.reduce((n, r) => n + r.n, 0);
    if (!total) return { total: 0, rows: [] };

    const floored = rows.map((r) => ({ ...r, raw: Math.max(MIN_SEGMENT, (r.n / total) * 100) }));
    const sum = floored.reduce((n, r) => n + r.raw, 0);
    return {
        total,
        rows: floored.map((r) => ({ ...r, pct: (r.raw / sum) * 100 })),
    };
}

/**
 * Standard deviation, in words.
 *
 * "σ 1.4" is trivia. "You rate generously, and you rarely sit on the fence" is
 * the most personal line on the page, and it is the same number. Two clauses:
 * the first from where your average sits, the second from how far you travel
 * from it.
 *
 * Deliberately no comparison to anyone else — the whole record is cumulative,
 * and a percentile would turn it into a scoreboard.
 */
const SPREAD_FLOOR = 5;

export function scoreSpread(spread) {
    const n = spread?.n || 0;
    if (n < SPREAD_FLOOR || spread?.sd == null) return null;

    const mean = Number(spread.mean);
    const sd = Number(spread.sd);

    const generosity = mean >= 8 ? 'You rate generously'
        : mean <= 6 ? 'You rate hard'
            : 'You rate evenly';
    // 1.2, not 1.5: the design's own worked example is σ 1.4 reading "you
    // rarely sit on the fence", and a threshold that puts its own example in
    // the middle band is the wrong threshold.
    const width = sd >= 1.2 ? 'you rarely sit on the fence'
        : sd <= 0.7 ? 'almost everything lands in the same narrow band'
            : 'your scores spread a fair way either side';

    return { sigma: sd.toFixed(1), sentence: `${generosity}, and ${width}.` };
}
