import { Link } from 'react-router-dom';

/** A poster we have no artwork for still says which title it is. Never a broken image. */
export function Poster({ src, title, className = '' }) {
    if (src) return <img src={src} alt="" loading="lazy" className={className} />;
    return <div className="noart">{title}</div>;
}

/**
 * The quick-add stays visible rather than appearing on hover. Hidden-until-hover
 * is undiscoverable, and on a guest's first visit this button IS the product —
 * tapping it is how the feature gets found.
 */
export function Tile({ item, onAdd }) {
    return (
        <Link to={`/title/${item.mediaType}/${item.id}`} className="tile">
            <div className="art">
                <Poster src={item.poster} title={item.title} />
                {onAdd && (
                    <button
                        type="button"
                        className="quickadd"
                        aria-label={`Add ${item.title}`}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAdd(item); }}
                    >+</button>
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

export function PersonChip({ person, sub }) {
    return (
        <Link to={`/person/${person.id}`} className="person-chip">
            <div className="pic">
                {person.photo ? <img src={person.photo} alt="" loading="lazy" /> : initialsOf(person.name)}
            </div>
            <div className="nm">{person.name}</div>
            {sub && <div className="role">{sub}</div>}
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

export function Attribution() {
    return (
        <p className="attribution">
            Data from <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer noopener">TMDB</a>.
            Streaming availability by <a href="https://www.justwatch.com" target="_blank" rel="noreferrer noopener">JustWatch</a>.
            <br />This product is not endorsed or certified by TMDB.
        </p>
    );
}
