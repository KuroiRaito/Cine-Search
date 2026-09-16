import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Poster, Empty, Icon } from '../../shared/ui/index.js';
import { profileUrl, posterUrl } from '../../shared/tmdb/view.js';
import { useLibrary, setFavouriteOrder, loadFavourites } from '../library';
import { loadShelf, addFavourite, removeFavourite, setShelfOrder, sortShelf } from './shelves.js';
import Picker from './Picker.jsx';
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
    // People and characters live in their own table, with their display
    // strings copied rather than joined — see shelves.js and R-C3.
    const kept = useAsync(() => Promise.all([loadShelf('person'), loadShelf('character')])
        .then(([person, character]) => ({ person, character })), [lib.ready]);

    const shelves = useMemo(() => ({
        movie: shelfOf(data, 'movie', lib.entries),
        tv: shelfOf(data, 'tv', lib.entries),
        person: sortShelf(kept.data?.person).map(cardOf),
        character: sortShelf(kept.data?.character).map(cardOf),
    }), [data, lib.entries, kept.data]);

    return {
        shelves,
        error: error || kept.error,
        loading: loading || kept.loading || !lib.ready,
        retry: () => { retry(); kept.retry(); },
    };
}

/**
 * A stored row, as a card.
 *
 * R-C2 decides the face: for live action the actor's photograph IS the
 * character's face and the card is honest; for animation it is a photograph of
 * a stranger, which is worse than no face at all, so it falls back to the
 * poster and the actor line says so.
 */
function cardOf(row) {
    const animated = row.kind === 'character' && row.animated;
    const face = animated
        ? posterUrl(row.poster_path, 'w342')
        : profileUrl(row.image_path, 'w185') || posterUrl(row.poster_path, 'w342');
    return {
        kind: row.kind,
        ref: row.ref,
        title: row.name,
        sub: row.subtitle,
        // R-C3: a card whose credit has gone keeps its name and title from our
        // own row and drops only the face.
        actor: row.actor ? `${animated ? 'Voice · ' : ''}${row.actor}` : null,
        face,
        to: row.tmdb_id && row.media_type
            ? `/title/${row.media_type}/${row.tmdb_id}`
            : (row.kind === 'person' ? `/person/${row.ref}` : null),
        round: row.kind === 'person',
    };
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
                {cards.slice(0, PREVIEW).map((c) => (
                    <FavCard key={c.ref ? `${c.kind}-${c.ref}` : `${c.mediaType}-${c.id}`} card={c} />
                ))}
            </div>
        </div>
    );
}

/* ----------------------------- Favourites ----------------------------- */

export function FavouritesTab({ shelves, onChanged }) {
    const lib = useLibrary();
    const [open, setOpen] = useState(SHELVES[0].key);
    const [order, setOrder] = useState(null);
    const [picking, setPicking] = useState(false);
    const [undo, setUndo] = useState(null);

    const shelf = SHELVES.find((sh) => sh.key === open);
    const fromLibrary = shelf.from === 'library';
    const base = shelves[open] || [];
    const cards = order?.key === open ? order.cards : base;

    // Identity differs by shelf: a title is a number, a person or a character
    // is a string. One accessor so nothing below has to care which.
    const idOf = (c) => (fromLibrary ? c.id : c.ref);
    const keyOfCard = (c) => (fromLibrary ? `${c.mediaType}-${c.id}` : `${c.kind}-${c.ref}`);

    const have = useMemo(
        () => new Set((shelves.character || []).map((c) => c.ref)),
        [shelves.character],
    );

    async function move(index, delta) {
        const next = moved(cards, index, delta);
        if (next === cards) return;
        // Optimistic: a reorder that waits for the server is a card that does
        // not move when you press the button.
        setOrder({ key: open, cards: next });
        const ids = next.map(idOf);
        await (fromLibrary ? setFavouriteOrder(open, ids) : setShelfOrder(open, ids)).catch(() => {});
    }

    /** E8 — immediate, with an undo. No confirmation for a reversible act. */
    async function drop(card) {
        setOrder({ key: open, cards: cards.filter((c) => keyOfCard(c) !== keyOfCard(card)) });
        if (fromLibrary) {
            await lib.save({ id: card.id, mediaType: card.mediaType, title: card.title }, { favourite: false });
        } else {
            await removeFavourite(card.kind, card.ref).catch(() => {});
        }
        setUndo({ card, at: Date.now() });
    }

    async function putBack(card) {
        setUndo(null);
        if (fromLibrary) {
            await lib.save({ id: card.id, mediaType: card.mediaType, title: card.title }, { favourite: true });
        } else {
            await addFavourite(rowOf(card)).catch(() => {});
        }
        setOrder(null);
        onChanged?.();
    }

    return (
        <>
            {/* Each chip carries its count, which does a second job: it shows
                the shape of somebody's taste before you open anything. */}
            <div className="chiprow" role="tablist" aria-label="Favourites">
                {SHELVES.map((sh) => (
                    <button
                        key={sh.key} type="button" role="tab"
                        aria-selected={open === sh.key}
                        className={open === sh.key ? 'fchip on' : 'fchip'}
                        onClick={() => { setOpen(sh.key); setOrder(null); }}
                    >
                        {sh.label}<em>{(shelves[sh.key] || []).length}</em>
                    </button>
                ))}
            </div>

            {open === 'character' && (
                <div className="pad">
                    <button type="button" className="btn quiet" onClick={() => setPicking(true)}>
                        Add a character
                    </button>
                </div>
            )}

            {cards.length === 0 ? (
                // F4 — the selected chip reads 0 and its grid is replaced by
                // that shelf's invitation. The other chips keep their counts.
                <Empty
                    title={`No favourite ${shelf.label.toLowerCase()} yet`}
                    body={emptyBody(open)}
                    action={open === 'character'
                        ? <button type="button" className="btn" onClick={() => setPicking(true)}>Add a character</button>
                        : <Link className="btn" to={open === 'person' ? '/search' : '/'}>Find something</Link>}
                />
            ) : (
                <ol className="fgrid">
                    {cards.map((c, i) => (
                        <li key={keyOfCard(c)}>
                            <FavCard card={c} rank={i + 1} />
                            <div className="fmove">
                                <button
                                    type="button" className="circ sm" aria-label={`Move ${c.title} earlier`}
                                    disabled={i === 0} onClick={() => move(i, -1)}
                                ><Icon name="earlier" size={16} /></button>
                                <button
                                    type="button" className="circ sm" aria-label={`Move ${c.title} later`}
                                    disabled={i === cards.length - 1} onClick={() => move(i, 1)}
                                ><Icon name="later" size={16} /></button>
                                <button
                                    type="button" className="circ sm" aria-label={`Remove ${c.title}`}
                                    onClick={() => drop(c)}
                                ><Icon name="close" size={16} /></button>
                            </div>
                        </li>
                    ))}
                </ol>
            )}

            {undo && (
                <div className="undo" role="status">
                    <span>Removed {undo.card.title}.</span>
                    <button type="button" onClick={() => putBack(undo.card)}>Undo</button>
                    <button type="button" className="dismiss-x" aria-label="Dismiss" onClick={() => setUndo(null)}>
                        <Icon name="close" size={16} />
                    </button>
                </div>
            )}

            {picking && (
                <Picker
                    have={have}
                    onClose={() => setPicking(false)}
                    onAdded={() => { setPicking(false); setOrder(null); onChanged?.(); }}
                />
            )}
        </>
    );
}

const emptyBody = (kind) => ({
    movie: 'Open a film you loved and tap the heart. It lands here, in the order you choose.',
    tv: 'Open a series you loved and tap the heart. It lands here, in the order you choose.',
    person: 'Open someone whose work you follow and tap the heart on their page.',
    character: 'Characters live inside cast lists, so start from a title or an actor.',
}[kind]);

/** Turning a card back into the row it came from, for undo. */
const rowOf = (card) => ({
    kind: card.kind, ref: card.ref, name: card.title, subtitle: card.sub,
    actor: card.actor ? card.actor.replace(/^Voice · /, '') : null,
});

function FavCard({ card, rank }) {
    // A round face means *person* throughout this system — the cast rail, the
    // people shelf, .circ. A character is not a person, so its card is a 2:3
    // portrait like every poster around it, which is also what keeps a
    // favourites grid reading as one system.
    const to = card.to || (card.mediaType ? `/title/${card.mediaType}/${card.id}` : '/');
    return (
        <Link className="fcard" to={to}>
            <div className={card.round ? 'fart round' : 'fart'}>
                <Poster path={card.posterPath} src={card.face} title={card.title} />
                {rank && <span className="frank">{rank}</span>}
                {/* The face is the actor's, so the face says so. That removes
                    the lie rather than hiding it. */}
                {card.actor && <span className="fwho">{card.actor}</span>}
            </div>
            <div className="fnm">{card.title}</div>
            <div className="fsub">{card.sub || card.year || '—'}</div>
        </Link>
    );
}
