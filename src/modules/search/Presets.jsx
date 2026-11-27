import { Link } from 'react-router-dom';
import { Chip } from '../../shared/ui/index.js';
import { presetsFor, facetsFor } from './presets.js';
import { toParams, readRegion } from './browse.js';

/**
 * The preset row, shared.
 *
 * It was Discover's own component, and FQ0 and FQ11 both ask for it on Search
 * — the resting state and the nothing-found screen. Two copies of a row whose
 * whole job is to be the same offer in both places is how they drift.
 *
 * `className` exists because the styling does not travel. `.chips` is shared
 * in ui.css, but `.chips.presets` — a padding-top, which §4 allows a module to
 * set because it is positioning — lives in discover.css and is not loaded on
 * /search. So Discover keeps its modifier and Search uses the bare row, rather
 * than Search quietly rendering a class whose rule never arrives.
 */
export default function Presets({ className = 'chips' }) {
    const region = readRegion();
    const offered = presetsFor(region);
    if (!offered.length) return null;
    return (
        <div className={className}>
            {offered.map((p) => (
                <Chip key={p.key} as={Link} to={`/search?${toParams(facetsFor(p, region))}`} title={p.definition}>
                    {p.label}
                </Chip>
            ))}
        </div>
    );
}
