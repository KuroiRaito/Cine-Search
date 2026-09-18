import { Link } from 'react-router-dom';
import { Poster, TILE_SIZES } from './Poster.jsx';
import Icon from './Icon.jsx';

/**
 * The quick-add stays visible rather than appearing on hover. Hidden-until-hover
 * is undiscoverable, and on a guest's first visit this button IS the product —
 * tapping it is how the feature gets found.
 *
 * Pure. The tile knows nothing about libraries or sessions: `state` is whatever
 * the screen says this title's saved state is ({ tone, icon, label } or null),
 * and `onAdd` is whatever the screen wants a tap on "+" to do. The library
 * module supplies both through useTileStates() and useQuickAdd(), so this
 * primitive can be drawn, designed and tested on its own.
 */
export function Tile({ item, state, onAdd, votes = false }) {
    const press = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Already saved: the tile reports, and changing a status is a decision
        // that belongs on the title page, not under a thumb on a poster.
        if (!state) onAdd(item);
    };

    return (
        <Link to={`/title/${item.mediaType}/${item.id}`} className="tile">
            <div className="art">
                <Poster src={item.poster} path={item.posterPath} sizes={TILE_SIZES} title={item.title} />
                {onAdd && (
                    <button
                        type="button"
                        className={`quickadd${state ? ` saved ${state.tone}` : ''}`}
                        aria-label={state ? `${item.title} — ${state.label}` : `Add ${item.title}`}
                        aria-disabled={state ? true : undefined}
                        onClick={press}
                    >{state ? <Icon name={state.icon} size={16} /> : <Icon name="add" size={16} />}</button>
                )}
                {item.voteAverage > 0 && (
                    <span className="score-badge"><Icon name="star" size={16} /> {Number(item.voteAverage).toFixed(1)}</span>
                )}
            </div>
            <div className="name">{item.title}</div>
            {/* The year is never omitted on a search grid, even when it is
                unknown — FQ21, where four results share a name and the year is
                the only thing telling them apart. */}
            <div className="meta">
                {item.year || '—'}
                {votes && item.voteCount > 0 && ` · ${item.voteCount.toLocaleString('en-GB')} votes`}
            </div>
        </Link>
    );
}
