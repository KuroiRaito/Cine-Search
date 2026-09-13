import { posterSrcSet } from '../tmdb/view.js';

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

