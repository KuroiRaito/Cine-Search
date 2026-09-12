import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Poster, Tile, Skeleton, Empty, Toast } from '../components/ui.jsx';
import { useAuth } from '../context/AuthProvider.jsx';
import { useLibrary } from '../context/LibraryProvider.jsx';
import { posterUrl, yearOf } from '../lib/tmdb/view.js';
import {
    statusMeta, episodesWatched, runningOrder, nextUnwatched, epLabel, loadEntries, keyOf,
} from '../lib/library.js';
import { useAsync } from '../hooks/useAsync.js';

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
    const { isSignedIn } = useAuth();
    const lib = useLibrary();
    const [filter, setFilter] = useState(null);
    const [toast, setToast] = useState(null);

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

    if (!isSignedIn) {
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

    if (loading) {
        return (
            <div className="page">
                <div className="page-head"><h1>Library</h1></div>
                <div className="chips">
                    {[0, 1, 2].map((i) => <Skeleton key={i} h={29} w={104} style={{ borderRadius: 99 }} />)}
                </div>
                <div className="grp">{[0, 1, 2].map((i) => <Skeleton key={i} h={70} style={{ borderRadius: 10, marginTop: 7 }} />)}</div>
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

    const shown = active === 'all' ? rows : rows.filter((r) => r.status === active);
    const series = shown.filter((r) => r.mediaType === 'tv');
    const films = shown.filter((r) => r.mediaType === 'movie');
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

            {/* Series always sits above Films, whether or not either has
                anything in it. A section that jumps above another because it
                happens to be empty makes the screen feel unstable. */}
            <Group
                title="Series"
                count={series.length}
                note={active === 'watching' ? 'in progress' : label.toLowerCase()}
                empty={<>Nothing here is marked “{label}”.</>}
            >
                {series.map((r) => <SeriesRow key={r.key} row={r} onBump={() => bump(r)} />)}
            </Group>

            <Group
                title="Films"
                count={films.length}
                note={label.toLowerCase()}
                empty={FILM_LESS.has(active)
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
                <div className="grid" style={{ paddingInline: 0 }}>
                    {films.map((r) => <Tile key={r.key} item={r} />)}
                </div>
            </Group>

            <Toast
                message={toast?.message}
                actionLabel={toast?.undo ? 'Undo' : undefined}
                onAction={() => { toast?.undo?.(); setToast(null); }}
                onDismiss={() => setToast(null)}
            />
        </div>
    );
}

/** One titled block. Holds its place in the order whether it has rows or not. */
function Group({ title, count, note, empty, children }) {
    return (
        <div className="grp">
            <div className="grp-h"><b>{title}</b><span>{count ? `${count} ${note}` : 'none'}</span></div>
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
        watched,
        seen: episodesWatched(watched),
        total,
        next: order.length ? nextUnwatched(order, watched) : null,
    };
}
