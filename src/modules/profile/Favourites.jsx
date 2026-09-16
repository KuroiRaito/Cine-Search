import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Poster, Empty, Icon } from '../../shared/ui/index.js';
import { useLibrary, setFavouriteOrder, loadFavourites } from '../library';
import { useAsync } from '../../shared/hooks/useAsync.js';
import { SHELVES, PREVIEW, shelfOf, moved } from './favourites.js';
import './profile.css';

/**
 * The shelves, in two shapes.
 *
 * On Overview they are rails showing the first eight — the statement. On the
 * Favourites tab they are one grid at a time behind a chip row, which is the
 * fix for a page nobody reaches the bottom of: every shelf is one tap from the
 * top rather than up to twenty-one screens down.
 */
export function useFavourites() {
    const lib = useLibrary();
    const { data, error, loading, retry } = useAsync(() => loadFavourites(), [lib.ready]);

    // The fetch supplies the catalogue half — title, poster, year — which
    // cannot change while you are looking at it. Whether something is still a
    // favourite, and where it sits, comes from the provider, so a heart turned
    // off on a title page empties the shelf here without a refetch.
    const shelves = useMemo(() => Object.fromEntries(
        SHELVES.map((s) => [s.key, shelfOf(data, s.key, lib.entries)]),
    ), [data, lib.entries]);

    return { shelves, error, loading: loading || !lib.ready, retry };
}

/* ------------------------------ Overview ------------------------------ */

export function ShelfRail({ shelf, cards, onSeeAll }) {
    if (!cards.length) return null;
    return (
        <div className="shelf">
            <div className="shelf-h">
                <h2>Favourite {shelf.label.toLowerCase()}</h2>
                {cards.length > PREVIEW && (
                    <button type="button" className="linkish" onClick={onSeeAll}>
                        See all {cards.length} →
                    </button>
                )}
            </div>
            <div className="frail">
                {cards.slice(0, PREVIEW).map((c) => <FavCard key={`${c.mediaType}-${c.id}`} card={c} />)}
            </div>
        </div>
    );
}

/* ----------------------------- Favourites ----------------------------- */

export function FavouritesTab({ shelves }) {
    const [open, setOpen] = useState(SHELVES[0].key);
    const [busy, setBusy] = useState(false);
    const [order, setOrder] = useState(null);

    const cards = order?.key === open ? order.cards : shelves[open] || [];
    const shelf = SHELVES.find((s) => s.key === open);

    async function move(index, delta) {
        const next = moved(cards, index, delta);
        if (next === cards) return;
        // Optimistic, and the order is what the person sees immediately: a
        // reorder that waits for the server is a card that does not move when
        // you press the button.
        setOrder({ key: open, cards: next });
        setBusy(true);
        await setFavouriteOrder(open, next.map((c) => c.id)).catch(() => {});
        setBusy(false);
    }

    return (
        <>
            {/* Each chip carries its count, which does a second job: it shows
                the shape of somebody's taste before you open anything. */}
            <div className="chiprow" role="tablist" aria-label="Favourites">
                {SHELVES.map((s) => (
                    <button
                        key={s.key} type="button" role="tab"
                        aria-selected={open === s.key}
                        className={open === s.key ? 'fchip on' : 'fchip'}
                        onClick={() => { setOpen(s.key); setOrder(null); }}
                    >
                        {s.label}<em>{(shelves[s.key] || []).length}</em>
                    </button>
                ))}
            </div>

            {cards.length === 0 ? (
                // F4 — the selected chip reads 0 and its grid is replaced by
                // that shelf's invitation. The other chips keep their counts.
                <Empty
                    title={`No favourite ${shelf.label.toLowerCase()} yet`}
                    body="Open something you loved and tap the heart. It lands here, in the order you choose."
                    action={<Link className="btn" to="/">Find something</Link>}
                />
            ) : (
                <ol className="fgrid" aria-busy={busy || undefined}>
                    {cards.map((c, i) => (
                        <li key={`${c.mediaType}-${c.id}`}>
                            <FavCard card={c} rank={i + 1} />
                            {/* Drag is the touch idiom and arrows are the
                                keyboard one; both move the same list. Drag
                                lands with the character shelf, when a grid of
                                twenty-five makes it worth the weight. */}
                            <div className="fmove">
                                <button
                                    type="button" className="circ sm" aria-label={`Move ${c.title} earlier`}
                                    disabled={i === 0} onClick={() => move(i, -1)}
                                ><Icon name="earlier" size={16} /></button>
                                <button
                                    type="button" className="circ sm" aria-label={`Move ${c.title} later`}
                                    disabled={i === cards.length - 1} onClick={() => move(i, 1)}
                                ><Icon name="later" size={16} /></button>
                            </div>
                        </li>
                    ))}
                </ol>
            )}
        </>
    );
}

function FavCard({ card, rank }) {
    return (
        <Link className="fcard" to={`/title/${card.mediaType}/${card.id}`}>
            <div className="fart">
                <Poster path={card.posterPath} title={card.title} />
                {rank && <span className="frank">{rank}</span>}
            </div>
            <div className="fnm">{card.title}</div>
            <div className="fsub">{card.year || '—'}</div>
        </Link>
    );
}
