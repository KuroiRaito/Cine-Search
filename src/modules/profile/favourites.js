import { keyOf } from '../library';

/**
 * The shelves. docs/profile-module.html §03.
 *
 * Four of them, and the two built here are the two whose ♥ already exists on a
 * title page. People and characters need a picker, so they arrive with it.
 *
 * Studios is a fifth shelf in the design and is deliberately not built: it
 * needs a company page that no module owns. It stays documented for v2.
 */
export const SHELVES = [
    { key: 'movie', label: 'Films' },
    { key: 'tv', label: 'Series' },
];

/**
 * Eight is a display rule, not a limit.
 *
 * Overview previews the first eight of a shelf; the Favourites tab shows the
 * whole thing. Nothing ever refuses a ninth favourite and there is no "which
 * one does this replace?" sheet — the constraint does its work on the rail,
 * where the first eight are the statement, and the tab behind it is the full
 * collection.
 */
export const PREVIEW = 8;

/** A gap-based sequence, so moving one card is one row's update. */
export const GAP = 10;

/**
 * One shelf, in the person's order.
 *
 * A favourite with no order has no opinion about where it sits — every one
 * that existed before the column did is in that state — so it sorts after the
 * ones that do, by when it was added. Inventing an order for them would be the
 * app deciding something the person did not.
 */
export function shelfOf(rows, mediaType, live) {
    return (rows || [])
        .filter((r) => r.media_type === mediaType)
        // The provider holds the truth about what is still a favourite: a
        // heart turned off on the title page must empty the shelf here without
        // a refetch.
        .filter((r) => live?.[keyOf(r.media_type, r.tmdb_id)]?.is_favourite !== false)
        .map((r) => ({
            id: r.tmdb_id,
            mediaType: r.media_type,
            title: r.catalog_titles?.title || 'Untitled',
            year: (r.catalog_titles?.release_date || '').slice(0, 4) || null,
            posterPath: r.catalog_titles?.poster_path || null,
            order: live?.[keyOf(r.media_type, r.tmdb_id)]?.favourite_order ?? r.favourite_order ?? null,
            addedAt: r.added_at,
        }))
        .sort((a, b) => {
            if (a.order != null && b.order != null) return a.order - b.order;
            if (a.order != null) return -1;
            if (b.order != null) return 1;
            return String(a.addedAt).localeCompare(String(b.addedAt));
        });
}

/** Where a card lands after moving it one place. Pure, so it can be tested. */
export function moved(list, index, delta) {
    const to = index + delta;
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    const [card] = next.splice(index, 1);
    next.splice(to, 0, card);
    return next;
}
