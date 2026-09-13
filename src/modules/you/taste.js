import { supabase } from '../../shared/auth/supabaseClient.js';

const unwrap = ({ data, error }) => {
    if (error) throw error;
    return data;
};

/** Everything the You screen draws, in one round trip. */
export async function tasteSummary() {
    return supabase.rpc('taste_summary').then(unwrap);
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
