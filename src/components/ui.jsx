import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { posterSrcSet } from '../lib/tmdb/view.js';
import { useAuth } from '../context/AuthProvider.jsx';
import { useLibrary } from '../context/LibraryProvider.jsx';
import { statusMeta, statusTone } from '../lib/library.js';

/** A poster we have no artwork for still says which title it is. Never a broken image. */
/**
 * `eager` for anything above the fold. A lazily-loaded hero or title poster
 * arrives late enough that the page looks broken while you wait for it.
 */
export function Poster({ src, path, sizes, title, className = '', eager = false }) {
    if (src) {
        return (
            <img
                src={src}
                srcSet={path ? posterSrcSet(path) : undefined}
                sizes={path ? sizes : undefined}
                alt=""
                className={className}
                loading={eager ? 'eager' : 'lazy'}
                fetchPriority={eager ? 'high' : undefined}
            />
        );
    }
    return <div className="noart">{title}</div>;
}

// Matches the rail and grid tile widths in base.css, so the browser asks for a
// source that fits rather than one that has to be stretched.
export const TILE_SIZES =
    '(min-width: 1100px) 190px, (min-width: 600px) 168px, (min-width: 400px) 148px, 128px';

/**
 * The quick-add stays visible rather than appearing on hover. Hidden-until-hover
 * is undiscoverable, and on a guest's first visit this button IS the product —
 * tapping it is how the feature gets found.
 *
 * The control knows the library itself rather than being told by each screen,
 * so a title saved on the title page is already marked on the poster behind it.
 * `onAdd` is only called for a guest: it is the screen's job to raise the
 * sign-in sheet, because the sheet belongs to the page, not to one tile.
 */
export function Tile({ item, onAdd }) {
    const { isSignedIn } = useAuth();
    const lib = useLibrary();
    const entry = lib?.entryFor(item.mediaType, item.id) ?? null;
    const state = entry ? statusMeta(entry.status) : null;

    const press = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isSignedIn) { onAdd(item); return; }
        // Already saved: the tile reports, and changing a status is a decision
        // that belongs on the title page, not under a thumb on a poster.
        if (entry) return;
        lib.save(item, { status: 'want_to_watch' });
    };

    return (
        <Link to={`/title/${item.mediaType}/${item.id}`} className="tile">
            <div className="art">
                <Poster src={item.poster} path={item.posterPath} sizes={TILE_SIZES} title={item.title} />
                {onAdd && (
                    <button
                        type="button"
                        className={`quickadd${entry ? ` saved ${statusTone(entry.status)}` : ''}`}
                        aria-label={entry ? `${item.title} — ${state?.label}` : `Add ${item.title}`}
                        aria-disabled={entry ? true : undefined}
                        onClick={press}
                    >{entry ? state?.icon : '+'}</button>
                )}
                {item.voteAverage > 0 && (
                    <span className="score-badge">★ {Number(item.voteAverage).toFixed(1)}</span>
                )}
            </div>
            <div className="name">{item.title}</div>
            <div className="meta">{item.year || '—'}</div>
        </Link>
    );
}

export function Rail({ title, action, items, onAdd }) {
    if (!items?.length) return null;
    return (
        <>
            <div className="section">
                <div className="section-h"><span>{title}</span>{action}</div>
            </div>
            <div className="rail">
                {items.map((it) => <Tile key={`${it.mediaType}-${it.id}`} item={it} onAdd={onAdd} />)}
            </div>
        </>
    );
}

export const initialsOf = (name = '') =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/**
 * A person as a row rather than a chip — name, role, and somewhere to go. Used
 * wherever there's horizontal room, which is most places once the cast list
 * isn't fighting a rail for space.
 */
export function PersonRow({ person, sub }) {
    return (
        <Link to={`/person/${person.id}`} className="prow">
            <span className={`pf${person.photo ? '' : ' noimg'}`}>
                {person.photo ? <img src={person.photo} alt="" loading="lazy" /> : initialsOf(person.name)}
            </span>
            <span className="pb">
                <b>{person.name}</b>
                {sub && <span>{sub}</span>}
            </span>
            <span className="go" aria-hidden="true">›</span>
        </Link>
    );
}

export function Skeleton({ h = 16, w = '100%', style }) {
    return <div className="skel" style={{ height: h, width: w, ...style }} />;
}

/** Skeletons mirror the layout that's coming, so nothing shifts on arrival. */
export function TitleSkeleton() {
    return (
        <div className="page">
            <Skeleton h={170} style={{ borderRadius: 0 }} />
            <div className="title-head">
                <Skeleton h={123} w={82} style={{ borderRadius: 8 }} />
                <div style={{ flex: 1, display: 'grid', gap: 8, paddingBottom: 6 }}>
                    <Skeleton h={20} w="75%" />
                    <Skeleton h={12} w="55%" />
                </div>
            </div>
            <div className="card"><Skeleton h={40} /></div>
            <div className="card"><Skeleton h={90} /></div>
        </div>
    );
}

export function Empty({ title, body, action }) {
    return (
        <div className="empty">
            <h2>{title}</h2>
            {body && <p>{body}</p>}
            {action}
        </div>
    );
}

/** Scoped to the section that failed — never the whole page. */
export function ErrorBox({ what, onRetry }) {
    return (
        <div className="errbox">
            <b>Couldn&apos;t load {what}</b>
            <p>The Movie Database didn&apos;t answer. The rest of this page is unaffected.</p>
            {onRetry && <button type="button" className="btn quiet" onClick={onRetry}>Try again</button>}
        </div>
    );
}


/**
 * Named, not generic. "Breaking Bad · S2 E4 watched" is worth reading; "Saved"
 * is not — and an undo that doesn't say what it would undo is a dare.
 *
 * Six seconds, because that is roughly how long an undo stays plausible. The
 * timer restarts whenever the message changes, so a run of quick actions never
 * leaves the last one on screen for a fraction of a second.
 */
export function Toast({ message, actionLabel, onAction, onDismiss, ttl = 6000 }) {
    useEffect(() => {
        if (!message) return undefined;
        const t = setTimeout(onDismiss, ttl);
        return () => clearTimeout(t);
    }, [message, onDismiss, ttl]);

    if (!message) return null;
    return (
        <div className="toast" role="status">
            <span>{message}</span>
            {actionLabel
                ? <button type="button" onClick={onAction}>{actionLabel}</button>
                : <button type="button" onClick={onDismiss} aria-label="Dismiss">✕</button>}
        </div>
    );
}
