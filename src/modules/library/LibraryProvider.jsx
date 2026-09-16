import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../../shared/auth/AuthProvider.jsx';
import * as api from './library.js';
import { statusMeta, statusTone } from './library.js';

const LibraryContext = createContext(null);

const EMPTY = Object.freeze({});

/**
 * One copy of the signed-in person's library, held in memory.
 *
 * Every poster tile in the app needs to know whether that title is saved, so
 * the alternative is a lookup per tile. A library is hundreds of rows; loading
 * it once is cheaper than that by an order of magnitude, and it is the only way
 * to satisfy "the same title never shows two different states in two places" —
 * there is one state, and both places read it.
 *
 * Writes are optimistic. The control moves the instant it is tapped, and if the
 * server refuses, the entry is put back exactly as it was and the failure is
 * said out loud. A write that fails quietly is worse than one that fails.
 */
export function LibraryProvider({ children }) {
    const { isSignedIn, user } = useAuth();
    const [entries, setEntries] = useState(EMPTY);
    const [ready, setReady] = useState(false);
    const [notice, setNotice] = useState(null);

    // Reads the current map without making every callback depend on it, so a
    // rollback always restores what was really there and not a stale copy.
    const latest = useRef(entries);
    latest.current = entries;

    useEffect(() => {
        if (!isSignedIn) {
            // Signing out clears the library from the screen at once. Leaving
            // the previous person's records visible is not a cosmetic bug.
            setEntries(EMPTY);
            setReady(false);
            return;
        }
        let live = true;
        setReady(false);
        api.loadAll()
            .then((rows) => {
                if (!live) return;
                const next = {};
                for (const r of rows || []) {
                    next[api.keyOf(r.media_type, r.tmdb_id)] = r;
                }
                setEntries(next);
            })
            .catch(() => live && setNotice('Couldn’t load your library.'))
            .finally(() => live && setReady(true));
        return () => { live = false; };
    }, [isSignedIn, user?.id]);

    const put = useCallback((key, row) => {
        setEntries((m) => (row ? { ...m, [key]: row } : omit(m, key)));
    }, []);

    /**
     * Apply the change, then do the write. `optimistic` is what the entry should
     * look like immediately; `write` returns the row the server settled on.
     */
    const commit = useCallback(async (key, optimistic, write, failure) => {
        const before = latest.current[key] ?? null;
        put(key, optimistic);
        try {
            const row = await write();
            // The server is the authority on derived fields — started_at,
            // completed_at, episodes_at_completion — so take its answer, not ours.
            if (row) put(key, normalise(row));
            return true;
        } catch (err) {
            put(key, before);
            setNotice(failure || 'That didn’t save.');
            if (import.meta.env.DEV) console.error(err);
            return false;
        }
    }, [put]);

    const entryFor = useCallback(
        (mediaType, id) => entries[api.keyOf(mediaType, id)] ?? null,
        [entries],
    );

    const save = useCallback(async (item, {
        status = null, rating = null, favourite = null,
        rewatches = null, recommendedBy = null, notes = null, episodes = null,
    } = {}) => {
        const key = api.keyOf(item.mediaType, item.id);
        const before = latest.current[key] ?? null;
        const optimistic = {
            ...(before ?? {}),
            tmdb_id: item.id,
            media_type: item.mediaType,
            status: status ?? before?.status ?? (rating != null ? 'watched' : 'want_to_watch'),
            rating: rating ?? before?.rating ?? null,
            is_favourite: favourite ?? before?.is_favourite ?? false,
            rewatch_count: rewatches ?? before?.rewatch_count ?? 0,
            recommended_by: recommendedBy ?? before?.recommended_by ?? null,
            notes: notes ?? before?.notes ?? null,
            watched_episodes: episodes ?? before?.watched_episodes ?? {},
        };
        if (!api.validRating(rating)) return false;
        return commit(key, optimistic, async () => {
            const catalog = await api.catalogFor(item.id, item.mediaType, item.catalog, { exists: Boolean(before) });
            let row = await api.upsert({
                id: item.id, mediaType: item.mediaType, catalog,
                status, rating, favourite, rewatches, recommendedBy, notes,
            });
            // Episodes live in their own function because the client sends the
            // whole season rather than a delta. Only seasons that actually
            // changed are sent — the stepper usually touches one.
            for (const season of changedSeasons(before?.watched_episodes, episodes)) {
                row = await api.setEpisodes({
                    id: item.id, season, episodes: episodes[season] ?? [], catalog,
                });
            }
            return row;
        }, 'Couldn’t save that.');
    }, [commit]);

    const drop = useCallback(async (item) => {
        const key = api.keyOf(item.mediaType, item.id);
        return commit(key, null, async () => {
            await api.remove(item.id, item.mediaType);
            return null;
        }, 'Couldn’t remove that.');
    }, [commit]);

    const clearRating = useCallback(async (item) => {
        const key = api.keyOf(item.mediaType, item.id);
        const before = latest.current[key];
        if (!before) return false;
        return commit(key, { ...before, rating: null }, async () => {
            await api.clearRating(item.id, item.mediaType);
            return null;
        }, 'Couldn’t clear that rating.');
    }, [commit]);

    /** `episodes` is the complete list for that season, not a delta. */
    const setEpisodes = useCallback(async (item, season, episodes) => {
        const key = api.keyOf(item.mediaType, item.id);
        const before = latest.current[key] ?? null;
        const watched = { ...(before?.watched_episodes ?? {}) };
        if (episodes.length) watched[String(season)] = [...episodes].sort((a, b) => a - b);
        else delete watched[String(season)];

        const optimistic = {
            tmdb_id: item.id,
            media_type: 'tv',
            status: before?.status ?? 'watching',
            rating: before?.rating ?? null,
            is_favourite: before?.is_favourite ?? false,
            watched_episodes: watched,
        };
        return commit(key, optimistic, async () => {
            const catalog = await api.catalogFor(item.id, 'tv', item.catalog, { exists: Boolean(before) });
            return api.setEpisodes({ id: item.id, season, episodes, catalog });
        }, 'Couldn’t save that episode.');
    }, [commit]);

    const value = {
        ready, entries, notice,
        dismissNotice: () => setNotice(null),
        entryFor,
        has: (mediaType, id) => Boolean(entries[api.keyOf(mediaType, id)]),
        save, drop, clearRating, setEpisodes,
    };

    return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

/** Which season numbers differ between two watched-episode maps. */
function changedSeasons(before, after) {
    if (!after) return [];
    const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after)]);
    const out = [];
    for (const k of keys) {
        const a = (before?.[k] ?? []).join(',');
        const b = (after[k] ?? []).join(',');
        if (a !== b) out.push(Number(k));
    }
    return out;
}

function omit(map, key) {
    if (!(key in map)) return map;
    const next = { ...map };
    delete next[key];
    return next;
}

/** The RPC returns the whole row; keep only what the app reads from it. */
const normalise = (r) => ({
    tmdb_id: r.tmdb_id,
    media_type: r.media_type,
    status: r.status,
    rating: r.rating,
    is_favourite: r.is_favourite,
    favourite_order: r.favourite_order ?? null,
    watched_episodes: r.watched_episodes ?? {},
    rewatch_count: r.rewatch_count ?? 0,
    recommended_by: r.recommended_by ?? null,
    notes: r.notes ?? null,
    added_at: r.added_at,
    started_at: r.started_at ?? null,
    completed_at: r.completed_at ?? null,
    updated_at: r.updated_at,
});

export function useLibrary() {
    return useContext(LibraryContext);
}

/**
 * What a poster tile should show for a title: its saved state, or nothing.
 * Returns a function rather than a value so a screen calls the hook once and
 * asks it per tile — hooks cannot run inside a map.
 */
export function useTileStates() {
    const lib = useLibrary();
    const entries = lib?.entries;
    return useCallback((item) => {
        const e = entries?.[api.keyOf(item.mediaType, item.id)];
        if (!e) return null;
        const meta = statusMeta(e.status);
        return { tone: statusTone(e.status), icon: meta?.icon, label: meta?.label };
    }, [entries]);
}

/**
 * What a tap on a tile's "+" does. A guest gets whatever the screen says —
 * the sign-in sheet, naming the title; a signed-in person saves it to "want
 * to watch" in one tap, with no sheet and no confirmation. A title that is
 * already saved does nothing: the tile reports, it does not toggle.
 */
export function useQuickAdd(onGuest) {
    const { isSignedIn, authReady } = useAuth();
    const lib = useLibrary();
    return useCallback((item) => {
        // Until the session question has an answer, a tap waits. Raising the
        // sign-in sheet at someone whose session is still being restored is the
        // same lie the Library screen used to tell, in a sheet.
        if (!isSignedIn) { if (authReady) onGuest?.(item); return; }
        if (lib.has(item.mediaType, item.id)) return;
        lib.save(item, { status: 'want_to_watch' });
    }, [isSignedIn, authReady, lib, onGuest]);
}
