import { supabase } from '../../shared/auth/supabaseClient.js';

const unwrap = ({ data, error }) => { if (error) throw error; return data; };

/** TMDB's genre id for Animation. R-C2 turns on this one number. */
const ANIMATION = 16;

/**
 * R-C1 — strip the role qualifier.
 *
 * TMDB stores "Levi (voice)", "Walter White (uncredited)", "Young Paul
 * (archive footage)". The raw string is never shown. Nothing is lost by
 * cleaning it, because what we store is the credit_id.
 */
export function cleanCharacter(raw) {
    const s = String(raw || '').trim();
    const cut = s.replace(/\s*\([^()]*\)\s*$/, '').trim();
    return cut || s;
}

export const isVoiceRole = (raw) => /\(\s*voice[^)]*\)\s*$/i.test(String(raw || ''));

export const isAnimated = (genreIds) => (genreIds || []).includes(ANIMATION);

/**
 * One /credit/{id} response, as the row we store.
 *
 * Everything drawn on the card comes from here and is written down, because
 * the credit it came from can be deleted by anybody with a TMDB account.
 */
export function characterFromCredit(creditId, data) {
    const media = data?.media || {};
    const raw = media.character || '';
    return {
        kind: 'character',
        ref: creditId,
        name: cleanCharacter(raw),
        subtitle: media.name || media.title || null,
        actor: data?.person?.name || null,
        image_path: data?.person?.profile_path || null,
        poster_path: media.poster_path || null,
        media_type: data?.media_type === 'tv' ? 'tv' : 'movie',
        tmdb_id: media.id ?? null,
        // For live action the actor's photograph IS the character's face. For
        // animation it is a photograph of a stranger, which is worse than no
        // face at all — so the card falls back to the poster and the actor
        // line says "Voice ·".
        animated: isAnimated(media.genre_ids) || isVoiceRole(raw),
    };
}

/** One cast entry from a title's credits, as a pickable role. */
export function roleFromCast(entry, mediaType) {
    // aggregate_credits rolls a person's several roles into one entry; movie
    // credits put the character on the entry itself.
    const role = entry.roles?.[0];
    const raw = role?.character ?? entry.character ?? '';
    return {
        creditId: role?.credit_id || entry.credit_id,
        character: cleanCharacter(raw),
        rawCharacter: raw,
        actor: entry.name,
        profilePath: entry.profile_path || null,
        episodes: role?.episode_count ?? entry.total_episode_count ?? null,
        order: entry.order ?? null,
        mediaType,
    };
}

/**
 * The cast, in an order that makes a 221-name list usable.
 *
 * TMDB's default is billing order, which buries a recurring character behind
 * one-scene guests. Breaking Bad returns 221 cast and Attack on Titan returns
 * 221 as well; sorted by episode count the character somebody actually means
 * is in the first five. Films have no episode count, so billing order is
 * correct there and the list is short anyway.
 */
export function castList(payload, mediaType) {
    const rows = (payload?.cast || []).map((c) => roleFromCast(c, mediaType));
    const named = rows.filter((r) => r.creditId && r.character);
    if (mediaType === 'tv') {
        return named.sort((a, b) => (b.episodes ?? 0) - (a.episodes ?? 0)
            || String(a.actor).localeCompare(String(b.actor)));
    }
    return named.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/* ------------------------------- storage ------------------------------- */

export async function loadShelf(kind) {
    return supabase
        .from('user_favourites')
        .select('kind, ref, position, name, subtitle, actor, image_path, poster_path, media_type, tmdb_id, animated, added_at')
        .eq('kind', kind)
        .then(unwrap);
}

export async function addFavourite(row) {
    return supabase.from('user_favourites').upsert(row, { onConflict: 'user_id,kind,ref' }).then(unwrap);
}

export async function removeFavourite(kind, ref) {
    return supabase.from('user_favourites').delete().eq('kind', kind).eq('ref', ref).then(unwrap);
}

export async function setShelfOrder(kind, refs) {
    return supabase.rpc('favourites_order', { p_kind: kind, p_refs: refs }).then(unwrap);
}

/** Nulls last, by when they were added — the same rule as the title shelves. */
export function sortShelf(rows) {
    return [...(rows || [])].sort((a, b) => {
        if (a.position != null && b.position != null) return a.position - b.position;
        if (a.position != null) return -1;
        if (b.position != null) return 1;
        return String(a.added_at).localeCompare(String(b.added_at));
    });
}
