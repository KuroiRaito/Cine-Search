import { supabase } from '../../shared/auth/supabaseClient.js';
import { titleFull } from '../../shared/tmdb/endpoints.js';
import { toCatalog } from '../../shared/tmdb/view.js';

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
    { key: 'want_to_watch', label: 'Want to watch', short: 'Want',       icon: 'want', tone: 'st-want', film: true },
    { key: 'watching',      label: 'Watching',      short: 'Watching',   icon: 'watching', tone: 'st-ing',  film: false },
    { key: 'on_hold',       label: 'On hold',       short: 'On hold',    icon: 'hold', tone: 'st-hold', film: false },
    { key: 'watched',       label: 'Watched',       short: 'Watched',    icon: 'watched', tone: 'st-done', film: true },
    { key: 'rewatching',    label: 'Rewatching',    short: 'Rewatch',    icon: 'rewatched', tone: 'st-re',   film: false },
    { key: 'dropped',       label: 'Dropped',       short: 'Dropped',    icon: 'dropped', tone: 'st-drop', film: true },
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

/**
 * Whether a library entry counts as seen.
 *
 * Collection progress measures what you have actually watched, so a title on
 * the watchlist is not progress — "6 of 11" would otherwise mean "six I have
 * heard of". Rewatching counts: you saw it the first time.
 */
export const isSeen = (entry) => canRate(entry?.status);

/**
 * How much of one body of work has been watched.
 *
 * Shared by the person page, the search results and the taste cards so that all
 * three answer the same question the same way. Three places quoting different
 * fractions for the same person would be worse than none of them quoting any.
 */
export function collectionProgress(role, entryFor) {
    const total = role?.items.length ?? 0;
    const seen = (role?.items ?? [])
        .filter((it) => isSeen(entryFor(it.mediaType, it.id))).length;
    return { seen, total, pct: total ? Math.round((seen / total) * 100) : 0 };
}

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

/**
 * Just the favourites, with enough catalogue to draw a card.
 *
 * Narrower than loadEntries() on purpose: a shelf needs four columns and a
 * poster, and the profile has no business pulling episode maps and notes to
 * render eight tiles.
 */
export async function loadFavourites() {
    return supabase
        .from('user_library')
        .select(`
            tmdb_id, media_type, favourite_order, added_at,
            catalog_titles!inner ( title, release_date, poster_path )
        `)
        .eq('is_favourite', true)
        .then(unwrap);
}

/**
 * The person's own order for one shelf, as a list.
 *
 * A gap-based sequence (10, 20, 30…) written in one call: reordering is a
 * property of the list, not of any row in it, so sending eight separate
 * updates would be eight chances to leave the shelf half-sorted.
 */
export async function setFavouriteOrder(mediaType, ids) {
    return supabase.rpc('library_favourite_order', {
        p_media_type: mediaType,
        p_ids: ids,
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
        .select('tmdb_id, media_type, status, rating, is_favourite, favourite_order, watched_episodes, rewatch_count, recommended_by, recommended_at, notes, added_at, started_at, completed_at, updated_at')
        .order('updated_at', { ascending: false })
        .then(unwrap);
}

/** The saved rows joined to the catalogue, for the Library screen itself. */
export async function loadEntries() {
    return supabase
        .from('user_library')
        .select(`
            tmdb_id, media_type, status, rating, is_favourite, favourite_order,
            watched_episodes, added_at, updated_at, completed_at,
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

/**
 * Record how long an episode of this season runs.
 *
 * TMDB has retired `episode_run_time`, so the only place these numbers exist is
 * the season endpoint — which the app fetches anyway when someone opens a
 * season. The data arrives as a side effect of the thing that makes it matter:
 * you cannot tick an episode without opening its season.
 *
 * Fire and forget. A season whose runtime is missing costs a number on a screen
 * nobody is currently looking at, and is never worth interrupting anyone for.
 */
export function rememberSeasonRuntime(tmdbId, season, episodes) {
    const mins = (episodes || []).map((e) => e.minutes).filter((m) => m > 0);
    if (mins.length < 1) return;
    const average = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
    supabase.rpc('season_runtime_set', {
        p_tmdb_id: tmdbId,
        p_season: season,
        p_minutes: average,
    }).then(({ error }) => {
        if (error && import.meta.env.DEV) console.warn('season runtime not saved', error);
    });
}

/* ---------------------------------------------------------------
   Person filmography totals — the "11" in "6 of 11".

   The denominator lives at TMDB and changes a few times a year. It is kept on
   catalog_people, per role, in the app's own vocabulary, so a person whose
   filmography has been counted once is never counted again from the browser.
   --------------------------------------------------------------- */

/** Every role a person has, as the cache stores it. */
export function totalsFromView(view) {
    const out = {};
    for (const r of view.roles) out[r.key] = { count: r.items.length, label: r.label, verb: r.verb };
    return out;
}

const STALE_DAYS = 30;
export const totalsAreFresh = (row) => Boolean(row?.credit_totals)
    && (!row.totals_synced_at
        || (Date.now() - new Date(row.totals_synced_at).getTime()) < STALE_DAYS * 86_400_000);

/** One read for up to a handful of ids; returns a map id → row. */
export async function personTotalsGet(ids) {
    if (!ids?.length) return {};
    const rows = await supabase
        .from('catalog_people')
        .select('tmdb_id, credit_totals, totals_synced_at')
        .in('tmdb_id', ids)
        .then(unwrap);
    return Object.fromEntries((rows || []).map((r) => [r.tmdb_id, r]));
}

/** Fire and forget: the number is on screen already; storing it is for next time. */
export function personTotalsSet({ id, name, profilePath, totals }) {
    supabase.rpc('person_totals_set', {
        p_person_id: id,
        p_name: name ?? null,
        p_profile_path: profilePath ?? null,
        p_totals: totals,
    }).then(({ error }) => {
        if (error && import.meta.env.DEV) console.warn('person totals not saved', error);
    });
}

/**
 * The stored credits for a handful of people, so a search row can count what
 * has been seen without the person's full filmography. This is the same
 * numerator the You screen computes in SQL — the taste cards and the search
 * rows agree with each other by construction.
 */
export async function creditsForPeople(ids) {
    if (!ids?.length) return [];
    return supabase
        .from('catalog_credits')
        .select('person_id, tmdb_id, media_type, role, job')
        .in('person_id', ids)
        .then(unwrap);
}
