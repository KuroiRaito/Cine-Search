import { supabase } from './supabaseClient.js';
import { titleFull } from './tmdb/endpoints.js';
import { toCatalog } from './tmdb/view.js';

/**
 * Every write to the library goes through a Postgres function, never straight
 * at a table.
 *
 * catalog_titles is shared by every user and read-only to clients, so saving a
 * title needs a privilege the browser must never hold. The functions are
 * SECURITY DEFINER: they hold the privilege, and the catalogue insert inside
 * them is ON CONFLICT DO NOTHING, so a client can create a missing row and can
 * never overwrite one. Catalogue, library entry and activity commit together.
 *
 * See supabase/002_library_writes.sql.
 */

/**
 * The six watch states, with the vocabulary split the design system rules on:
 *
 *   "Film statuses are Want to watch · Watched · Dropped only. 'Watching' is
 *    meaningless for a 2h film; forcing one vocabulary would degrade the film
 *    flow to serve the series flow."
 *
 * The database still allows all six for either kind — the constraint is a
 * product decision, not a data one, and a film imported later with a status we
 * no longer offer must still render.
 */
export const STATUSES = [
    { key: 'want_to_watch', label: 'Want to watch', short: 'Want',       icon: '\u25F7', tone: 'st-want', film: true },
    { key: 'watching',      label: 'Watching',      short: 'Watching',   icon: '\u25B6', tone: 'st-ing',  film: false },
    { key: 'on_hold',       label: 'On hold',       short: 'On hold',    icon: '\u2016', tone: 'st-hold', film: false },
    { key: 'watched',       label: 'Watched',       short: 'Watched',    icon: '\u2713', tone: 'st-done', film: true },
    { key: 'rewatching',    label: 'Rewatching',    short: 'Rewatch',    icon: '\u21BB', tone: 'st-re',   film: false },
    { key: 'dropped',       label: 'Dropped',       short: 'Dropped',    icon: '\u2715', tone: 'st-drop', film: true },
];

export const statusesFor = (mediaType) =>
    (mediaType === 'tv' ? STATUSES : STATUSES.filter((s) => s.film));

export const statusMeta = (key) => STATUSES.find((s) => s.key === key) || null;
export const statusLabel = (key) => statusMeta(key)?.label || null;
export const statusTone = (key) => statusMeta(key)?.tone || 'st-want';

/**
 * "Rating is locked until Watched or Rewatching. Tapping the star earlier
 * offers 'Mark as watched first?'" — you cannot score what you have not seen.
 */
export const canRate = (status) => status === 'watched' || status === 'rewatching';

export const keyOf = (mediaType, id) => `${mediaType}-${id}`;

/** Half points, 0.5 to 10 — the range the database's own check constraint allows. */
export const RATINGS = Array.from({ length: 20 }, (_, i) => (i + 1) / 2);

/** Guards a score before it reaches a constraint violation. */
export const validRating = (v) => v == null || RATINGS.includes(v);

/**
 * A quick-add from a poster tile has only what a list response carries, which
 * is not enough for a row everybody shares. Fetch the full title first: the UI
 * has already moved on optimistically, so this costs the user nothing, and it
 * is the difference between a catalogue with genres in it and one without.
 */
export async function catalogFor(id, mediaType, known, { exists = false } = {}) {
    if (known) return known;
    // The catalogue insert is ON CONFLICT DO NOTHING, so fetching a title that
    // is already saved buys nothing and spends a TMDB request. Every tap of the
    // "+" on a library row was doing exactly that.
    if (exists) return null;
    const raw = await titleFull(id, mediaType);
    return toCatalog(raw, mediaType);
}

const unwrap = ({ data, error }) => {
    if (error) throw error;
    return data;
};

export async function upsert({
    id, mediaType, catalog,
    status = null, rating = null, favourite = null,
    rewatches = null, recommendedBy = null, notes = null,
}) {
    return supabase.rpc('library_upsert', {
        p_tmdb_id: id,
        p_media_type: mediaType,
        p_catalog: catalog ?? {},
        p_status: status,
        p_rating: rating,
        p_favourite: favourite,
        p_rewatches: rewatches,
        p_recommended_by: recommendedBy,
        p_notes: notes,
    }).then(unwrap);
}

export async function remove(id, mediaType) {
    return supabase.rpc('library_remove', { p_tmdb_id: id, p_media_type: mediaType }).then(unwrap);
}

export async function clearRating(id, mediaType) {
    return supabase.rpc('library_clear_rating', { p_tmdb_id: id, p_media_type: mediaType }).then(unwrap);
}

export async function setEpisodes({ id, season, episodes, catalog }) {
    return supabase.rpc('library_episodes_set', {
        p_tmdb_id: id,
        p_season: season,
        p_episodes: episodes,
        p_catalog: catalog ?? {},
    }).then(unwrap);
}

/**
 * The whole library in one request. A person's library is hundreds of rows, not
 * millions, and every poster tile in the app needs to know whether it is in
 * there — so one read beats a lookup per tile by a wide margin.
 */
export async function loadAll() {
    return supabase
        .from('user_library')
        .select('tmdb_id, media_type, status, rating, is_favourite, watched_episodes, rewatch_count, recommended_by, recommended_at, notes, added_at, started_at, completed_at, updated_at')
        .order('updated_at', { ascending: false })
        .then(unwrap);
}

/** The saved rows joined to the catalogue, for the Library screen itself. */
export async function loadEntries() {
    return supabase
        .from('user_library')
        .select(`
            tmdb_id, media_type, status, rating, is_favourite, watched_episodes,
            added_at, updated_at, completed_at,
            catalog_titles!inner ( title, release_date, poster_path, number_of_episodes, seasons )
        `)
        .order('updated_at', { ascending: false })
        .then(unwrap);
}

/**
 * How many episodes of a series are ticked.
 *
 * Specials — season zero — are excluded, because the total they are counted
 * against excludes them: TMDB's `number_of_episodes` is the numbered run, and
 * the catalogue's season list is built from seasons above zero. Counting them
 * on one side of the fraction and not the other reads "63 of 62" and draws a
 * progress bar past its own end.
 *
 * They are still recorded. A special you watched is a thing you watched; it is
 * just not part of "how far through Breaking Bad are you".
 */
export function episodesWatched(watched, { includeSpecials = false } = {}) {
    if (!watched) return 0;
    return Object.entries(watched).reduce((n, [season, list]) => {
        if (!includeSpecials && Number(season) === 0) return n;
        return n + (Array.isArray(list) ? list.length : 0);
    }, 0);
}

/**
 * Every aired episode of a series, in running order.
 *
 * TMDB's per-season `episode_count` includes episodes that have been announced
 * but not broadcast, so the list is truncated to the aired total that
 * `airedEpisodeCount` works out from `last_episode_to_air`. Earlier seasons are
 * always complete, so truncating the tail is exactly right.
 */
export function runningOrder(seasons, airedTotal) {
    const out = [];
    for (const s of seasons || []) {
        // Two shapes reach this: TMDB's own season objects on a title page, and
        // the compact {n, c} stored on the catalogue row. Same meaning.
        const number = s.season_number ?? s.n;
        const count = s.episode_count ?? s.c ?? 0;
        for (let e = 1; e <= count; e += 1) {
            out.push({ season: number, episode: e });
            if (airedTotal != null && out.length >= airedTotal) return out;
        }
    }
    return out;
}

export const isWatched = (watched, season, episode) =>
    Boolean(watched?.[String(season)]?.includes(episode));

/** The next one to watch — never "one more than the number", which names nothing. */
export const nextUnwatched = (order, watched) =>
    order.find((x) => !isWatched(watched, x.season, x.episode)) || null;

/** The most recent one watched, for the stepper's minus. */
export function lastWatched(order, watched) {
    for (let i = order.length - 1; i >= 0; i -= 1) {
        if (isWatched(watched, order[i].season, order[i].episode)) return order[i];
    }
    return null;
}

export const epLabel = ({ season, episode }) => `S${season} E${episode}`;
