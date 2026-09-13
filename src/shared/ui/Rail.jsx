import { Tile } from './Tile.jsx';

/** `stateFor(item)` is optional: without it the rail's tiles carry no saved state. */
export function Rail({ title, action, items, onAdd, stateFor }) {
    if (!items?.length) return null;
    return (
        <>
            <div className="section">
                <div className="section-h"><span>{title}</span>{action}</div>
            </div>
            <div className="rail">
                {items.map((it) => (
                    <Tile key={`${it.mediaType}-${it.id}`} item={it} onAdd={onAdd} state={stateFor?.(it) ?? null} />
                ))}
            </div>
        </>
    );
}
