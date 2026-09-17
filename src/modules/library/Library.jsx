import { useMemo, useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Poster, Tile, Skeleton, Empty, Toast, Icon } from '../../shared/ui/index.js';
import { useAuth } from '../../shared/auth/AuthProvider.jsx';
import { useLibrary } from './LibraryProvider.jsx';
import { posterUrl, yearOf } from '../../shared/tmdb/view.js';
import {
    statusMeta, episodesWatched, runningOrder, nextUnwatched, epLabel, loadEntries, keyOf,
} from './library.js';
import { useAsync } from '../../shared/hooks/useAsync.js';
import { matches, isFinding } from './find.js';
import { applySort, availableSorts, defaultSortFor, sortNote } from './sort.js';
import './library.css';

/* Which statuses get a chip. "All" is last and has no count of its own — the
   sum is already the sum of the others. */
const FILTERS = ['watching', 'want_to_watch', 'watched', 'on_hold', 'rewatching', 'dropped'];

/* Statuses a film cannot hold. "Watching" is meaningless for a two-hour film,
   so an empty Films section under those filters has a real answer rather than
   an apology. */
const FILM_LESS = new Set(['watching', 'on_hold', 'rewatching']);

/**
 * Series as rows, films as a grid, inside one filter.
 *
 * A series carries progress, which a poster cannot show and a row can. A film
 * carries nothing a poster doesn't already say, so it stays a poster.
 */
export default function Library() {
    const { isSignedIn, authReady } = useAuth();
    const lib = useLibrary();
    const [filter, setFilter] = useState(null);
    const [toast, setToast] = useState(null);
    const [term, setTerm] = useState('');
    /* Remembered per shelf, not globally: sorting Watched by rating must not
       reorder Watching the next time it is opened. Six shelves, six memories —
       and in state rather than storage, because a sort is a preference for this
       session, not a record. */
    const [sorts, setSorts] = useState({});
    const [sorting, setSorting] = useState(false);

    // The catalogue half — titles and posters — is joined server-side rather
    // than held in the provider, which only ever tracks a person's own state.
    const { data, error, loading, retry } = useAsync(
        () => loadEntries(),
        [isSignedIn, lib.ready],
        { skip: !isSignedIn },
    );

    // The fetch supplies the catalogue half — title, poster, season shape —
    // which never changes while you are looking at it. Everything a person can
    // alter is read from the provider, so a tick here and a tick on the title
    // page are the same fact rather than two copies of it. A row the provider
    // no longer holds has been removed, and goes immediately.
    const rows = useMemo(
        () => (data || [])
            .map((r) => [r, lib.entries[keyOf(r.media_type, r.tmdb_id)]])
            .filter(([, entry]) => entry)
            .map(([r, entry]) => shape(r, entry)),
        [data, lib.entries],
    );

    const counts = useMemo(() => {
        const c = {};
        for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
        return c;
    }, [rows]);

    // "Default filter is Watching when anything is in progress, otherwise Want
    // to watch." Chosen once from the data, then the person's choice wins.
    //
    // With the third case spelled out: the rule assumes a library where "want
    // to watch" is rarely empty. Early on it usually is, and landing on an
    // empty filter shows a person with one saved title two empty boxes and no
    // chip selected. Fall through to whichever status actually has something.
    const fallback = (counts.watching && 'watching')
        || (counts.want_to_watch && 'want_to_watch')
        || FILTERS.find((k) => counts[k])
        || 'all';
    const active = filter ?? fallback;

    // `authReady` before `isSignedIn`, and that order is the whole fix: a
    // returning session takes a network round trip to renew, and asking
    // "are they signed in?" during it answers no. This screen used to offer a
    // signed-in person a "Create an account" button for a second and a half.
    if (authReady && !isSignedIn) {
        return (
            <div className="page">
                <div className="page-head"><h1>Library</h1></div>
                <Empty
                    title="Nothing saved yet"
                    body="An account keeps your watchlist, ratings and episode progress — private by default."
                    action={<Link className="btn" to="/welcome/signup" state={{ from: '/library' }}>Create an account</Link>}
                />
            </div>
        );
    }

    // Signed in, but the fetch has not started yet: the session arrives a beat
    // after the first render, so there is a frame where nothing is loading and
    // nothing has loaded. Treating that as loaded shows an empty library to
    // someone who has one.
    if (!authReady || loading || (!data && !error)) {
        return (
            <div className="page">
                <div className="page-head"><h1>Library</h1></div>
                <div className="chips">
                    {[0, 1, 2].map((i) => <Skeleton key={i} h={29} w={104} className="skel-round" />)}
                </div>
                <div className="grp">{[0, 1, 2].map((i) => <Skeleton key={i} h={70} className="skel-row" />)}</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="page">
                <div className="page-head"><h1>Library</h1></div>
                <Empty
                    title="Couldn’t load your library"
                    body="Your records are safe — this screen just couldn’t reach them."
                    action={<button type="button" className="btn" onClick={retry}>Try again</button>}
                />
            </div>
        );
    }

    if (!rows.length) {
        return (
            <div className="page">
                <div className="page-head"><h1>Library</h1></div>
                <Empty
                    title="Nothing saved yet"
                    body="Save a film or series and it will appear here."
                    action={<Link className="btn" to="/">Find something to watch</Link>}
                />
            </div>
        );
    }

    /* Find ignores the status filter on purpose: you are looking for a title,
       not a shelf. Somebody who types "dune" while Watching is selected wants
       the film, and being told it is not on this shelf is a worse answer than
       the film. */
    const finding = isFinding(term);
    const shown = finding
        ? rows.filter((r) => matches(r.title, term))
        : (active === 'all' ? rows : rows.filter((r) => r.status === active));
    /* Find has no shelf, so it has no remembered sort — the answer to "where
       did I put it" is the title you typed, in the order the shelf already
       had. */
    const sortKey = sorts[active] || defaultSortFor(active);
    const options = availableSorts(shown);
    // A remembered sort can stop being offered when the shelf's contents change
    // — rating on a shelf whose last rated title was removed. Fall back rather
    // than sort by something that is no longer there.
    const effective = options.some((o) => o.key === sortKey) ? sortKey : defaultSortFor(active);

    const ordered = applySort(shown, effective);
    const series = ordered.filter((r) => r.mediaType === 'tv');
    const films = ordered.filter((r) => r.mediaType === 'movie');
    const label = statusMeta(active)?.label ?? 'Everything';

    /* "The + marks the next unwatched episode — never add one to a number — so
       the toast can name the episode." */
    const bump = async (row) => {
        if (!row.next) return;
        const key = String(row.next.season);
        const list = [...(row.watched[key] ?? []), row.next.episode];
        const ok = await lib.setEpisodes({ id: row.id, mediaType: 'tv' }, row.next.season, list);
        if (ok) {
            setToast({
                message: `${row.title} · ${epLabel(row.next)} watched`,
                undo: () => lib.setEpisodes({ id: row.id, mediaType: 'tv' }, row.next.season, row.watched[key] ?? []),
            });
        }
    };

    return (
        <div className="page">
            <div className="page-head"><h1>Library</h1></div>

            {/* One line in the header, not a screen of its own. The reason
                somebody opens a five-hundred-title library is usually one
                title, and four characters gets them there. */}
            <div className={finding ? 'lfind on' : 'lfind'}>
                <Icon name="search" size={16} />
                <input
                    type="search" value={term} className="lfind-in"
                    placeholder="Find in your library"
                    aria-label="Find in your library"
                    onChange={(e) => setTerm(e.target.value)}
                />
                {finding && (
                    <button type="button" className="lfind-x" aria-label="Clear" onClick={() => setTerm('')}>
                        <Icon name="close" size={16} />
                    </button>
                )}
            </div>

            {finding && shown.length > 0 && (
                <p className="lfind-n">
                    {shown.length} of {rows.length} · searching your library, not the catalogue
                </p>
            )}

            {/* The chips are about shelves and find is not, so they go while
                it is in use rather than sitting there contradicting it. */}
            {!finding && (
            <div className="chips" role="tablist" aria-label="Filter by status">
                {FILTERS.filter((k) => counts[k]).map((k) => (
                    <button
                        key={k}
                        type="button"
                        role="tab"
                        className="chip"
                        aria-pressed={active === k}
                        onClick={() => setFilter(k)}
                    >
                        {statusMeta(k).label}<em>{counts[k]}</em>
                    </button>
                ))}
                <button type="button" role="tab" className="chip" aria-pressed={active === 'all'} onClick={() => setFilter('all')}>
                    All<em>{rows.length}</em>
                </button>
            </div>
            )}

            {/* L6 — find failed, so the honest next step is Search, carrying
                the typed text rather than making somebody type it twice. This
                is the one place the two are allowed to know about each other. */}
            {finding && shown.length === 0 && (
                <Empty
                    title={`Nothing in your library matches “${term.trim()}”.`}
                    body="It may still be out there."
                    action={
                        <Link className="btn" to={`/search?q=${encodeURIComponent(term.trim())}`}>
                            Search the catalogue
                        </Link>
                    }
                />
            )}

            {/* Series always sits above Films, whether or not either has
                anything in it. A section that jumps above another because it
                happens to be empty makes the screen feel unstable. */}
            {!(finding && shown.length === 0) && <>
            <Group
                title="Series"
                count={series.length}
                note={finding ? 'found' : sortNote(effective)}
                onSort={finding ? null : () => setSorting(true)}
                empty={finding ? null : <>Nothing here is marked “{label}”.</>}
            >
                {series.map((r) => <SeriesRow key={r.key} row={r} onBump={() => bump(r)} />)}
            </Group>

            <Group
                title="Films"
                count={films.length}
                note={finding ? 'found' : sortNote(effective)}
                onSort={finding ? null : () => setSorting(true)}
                empty={finding ? null : FILM_LESS.has(active)
                    ? (
                        <>
                            Films don’t have a “{label}” state.<br />
                            <button type="button" className="linkish" onClick={() => setFilter('want_to_watch')}>
                                See your saved films
                            </button>
                        </>
                    )
                    : <>Nothing here is marked “{label}”.</>}
            >
                <div className="grid flush">
                    {films.map((r) => <Tile key={r.key} item={r} />)}
                </div>
            </Group>
            </>}

            {sorting && (
                <SortSheet
                    shelf={label}
                    current={effective}
                    options={options}
                    onPick={(key) => { setSorts((m) => ({ ...m, [active]: key })); setSorting(false); }}
                    onClose={() => setSorting(false)}
                />
            )}

            <Toast
                message={toast?.message}
                actionLabel={toast?.undo ? 'Undo' : undefined}
                onAction={() => { toast?.undo?.(); setToast(null); }}
                onDismiss={() => setToast(null)}
            />
        </div>
    );
}

/**
 * L4 — the options change with the shelf, and the choice is remembered for it.
 *
 * Said on the sheet rather than left to be discovered: somebody who sorts
 * Watched by rating and then opens Watching should not wonder why it did not
 * follow them, and somebody who wanted it to follow should find out here
 * rather than by being surprised later.
 */
function SortSheet({ shelf, current, options, onPick, onClose }) {
    const box = useRef(null);
    useEffect(() => {
        const opener = document.activeElement;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
        };
    }, [onClose]);

    return (
        <div className="scrim" role="dialog" aria-modal="true" aria-label={`Sort ${shelf}`} onClick={onClose}>
            <div className="sheet" ref={box} onClick={(e) => e.stopPropagation()}>
                <div className="grab" />
                <h2 className="sheet-title">Sort {shelf}</h2>
                <p className="sheet-body">Remembered for this shelf only.</p>
                <div className="sortgrid">
                    {options.map((o) => (
                        <button
                            key={o.key}
                            type="button"
                            className={o.key === current ? 'sortopt on' : 'sortopt'}
                            aria-pressed={o.key === current}
                            onClick={() => onPick(o.key)}
                        >
                            <b>{o.label}</b>
                            <span>{o.answers}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

/** One titled block. Holds its place in the order whether it has rows or not. */
function Group({ title, count, note, empty, onSort, children }) {
    // An empty section explains itself — "a film is never on hold" is a real
    // answer where an empty grid is not. But while finding there is no shelf to
    // explain, so `empty` is null and the box goes rather than sitting there
    // blank.
    if (!count && empty == null) return null;
    return (
        <div className="grp">
            <div className="grp-h">
                <b>{title}</b>
                {/* The note already says what the order is, so it is also the
                    way to change it. A separate Sort button would be a second
                    control saying the same thing. */}
                {count && onSort
                    ? (
                        <button type="button" className="linkish" onClick={onSort}>
                            {count} {note}<Icon name="down" size={16} />
                        </button>
                    )
                    : <span>{count ? `${count} ${note}` : 'none'}</span>}
            </div>
            {count ? children : <p className="whynot">{empty}</p>}
        </div>
    );
}

function SeriesRow({ row, onBump }) {
    const pct = row.total ? Math.round((row.seen / row.total) * 100) : 0;
    return (
        <div className="srow">
            <Link to={`/title/tv/${row.id}`} className="th">
                <Poster src={row.poster} title={row.title} />
            </Link>
            <Link to={`/title/tv/${row.id}`} className="bd">
                <span className="nm">{row.title}</span>
                <span className="ep">
                    {row.total
                        ? <>{row.next ? `${epLabel(row.next)} · ` : 'Complete · '}{row.seen} of {row.total}</>
                        : <>{statusMeta(row.status)?.label}</>}
                </span>
            </Link>
            <button
                type="button"
                className="plus"
                disabled={!row.next}
                aria-label={row.next ? `Mark ${epLabel(row.next)} watched` : 'Every episode watched'}
                onClick={onBump}
            >+</button>
            <span className="track" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
        </div>
    );
}

/**
 * One saved row: the catalogue half from the join, the person's half from the
 * provider. Two sources because they change on different clocks — a poster does
 * not move while you are looking at it, and a tick has to.
 */
function shape(r, entry) {
    const cat = r.catalog_titles || {};
    const total = cat.number_of_episodes || 0;
    const order = r.media_type === 'tv' ? runningOrder(cat.seasons, total) : [];
    const watched = entry.watched_episodes || {};
    return {
        key: `${r.media_type}-${r.tmdb_id}`,
        id: r.tmdb_id,
        mediaType: r.media_type,
        title: cat.title || 'Untitled',
        year: yearOf(cat.release_date),
        poster: posterUrl(cat.poster_path, 'w342'),
        posterPath: cat.poster_path,
        voteAverage: null,
        status: entry.status,
        rating: entry.rating,
        updatedAt: r.updated_at,
        addedAt: r.added_at,
        watched,
        seen: episodesWatched(watched),
        total,
        next: order.length ? nextUnwatched(order, watched) : null,
    };
}
