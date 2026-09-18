import { useState } from 'react';
import { Icon } from '../../shared/ui/index.js';
import { useAsync } from '../../shared/hooks/useAsync.js';
import { providerList } from '../../shared/tmdb/endpoints.js';
import {
    KINDS, LENGTHS, RATINGS, DECADES, genresFor, readRegion, writeRegion, regionChoices,
    rememberProviders,
} from './browse.js';

/**
 * The panel is the editor. The chip row above the results is the record.
 *
 * Two places show state and they have different jobs — the chip row is always
 * visible and every chip is removable; this is closed most of the time. That is
 * the one duplication in the module and it is deliberate, because a closed
 * panel must never conceal a constraint.
 *
 * L8 — no Apply, no Cancel, nothing to commit. Every change applies at once and
 * the count above the grid is the feedback: 394 films becomes 41 films as the
 * chip goes on. That single number is what the old modal could not show, and it
 * is the difference between choosing a filter and guessing one. The panel stays
 * open while you work and the results move underneath it.
 *
 * L7 — a facet appears only when it can change the answer. The genre row
 * carries the current medium's vocabulary and nothing else; a control that
 * cannot do anything is worse than a missing one, because it is a promise the
 * screen breaks when you touch it.
 */

/* Indian languages first, and that is the point rather than a nicety: eight of
   the golden set's Hinglish queries name one, it is one TMDB parameter, and it
   is the facet almost no Western tracker offers at all. */
const LANGS = [
    { code: 'hi', label: 'Hindi' }, { code: 'ta', label: 'Tamil' },
    { code: 'te', label: 'Telugu' }, { code: 'ml', label: 'Malayalam' },
    { code: 'kn', label: 'Kannada' }, { code: 'en', label: 'English' },
    { code: 'ko', label: 'Korean' }, { code: 'ja', label: 'Japanese' },
];

/** One row of chips, where choosing the chip that is already on takes it off —
 *  which is the same gesture as removing it from the chip row above. */
function Row({ label, options, value, onPick }) {
    if (!options.length) return null;
    return (
        <div className="frow">
            <div className="frow-l">{label}</div>
            <div className="chips flush">
                {options.map((o) => (
                    <button
                        key={String(o.value)}
                        type="button"
                        className="chip"
                        aria-pressed={Array.isArray(value) ? value.includes(o.value) : value === o.value}
                        onClick={() => onPick(o.value)}
                    >{o.label}</button>
                ))}
            </div>
        </div>
    );
}

/**
 * The one row that needs two things before it can draw: a region, and a list
 * fetched for it.
 *
 * FB8 — the region is asked for once, at the moment this facet is first used,
 * and then remembered. Never guessed from an IP.
 *
 * FB7 — if the list cannot be fetched, the facet is absent for that session
 * rather than empty. An empty row of providers reads as "nothing streams this",
 * which is a different and wrong answer.
 */
function WhereToWatch({ facets, onPick }) {
    // The browse's own region when it has one — a shared link brings its own —
    // otherwise whatever was chosen here before.
    const [region, setRegion] = useState(() => facets.region || readRegion());
    const { data, error } = useAsync(
        ({ signal }) => providerList(facets.kind === 'tv' ? 'tv' : 'movie', region, { signal })
            .then((list) => { rememberProviders(list); return list; }),
        [region, facets.kind],
        { skip: !region },
    );

    if (!region) {
        return (
            <div className="frow">
                <div className="frow-l">Where to watch</div>
                <p className="frow-ask">Streaming services differ by country. Which is yours?</p>
                <div className="chips flush">
                    {regionChoices(navigator.language).map((code) => (
                        <button
                            key={code}
                            type="button"
                            className="chip"
                            onClick={() => { writeRegion(code); setRegion(code); }}
                        >{code}</button>
                    ))}
                </div>
            </div>
        );
    }

    // FB7 — absent, not empty.
    if (error || !data?.length) return null;

    return (
        <div className="frow">
            <div className="frow-l">Where to watch · {region}</div>
            <div className="chips flush">
                {data.slice(0, 12).map((p) => (
                    <button
                        key={p.id}
                        type="button"
                        className="chip"
                        aria-pressed={facets.provider === p.id}
                        onClick={() => onPick(facets.provider === p.id ? null : p.id, region)}
                    >{p.name}</button>
                ))}
            </div>
        </div>
    );
}

export default function FilterPanel({ facets, vocab, onChange, canHide }) {
    /* FB15 — the state is remembered for the session, so somebody who uses
       where to watch does not re-open it every time. */
    const [more, setMore] = useState(() => sessionStorage.getItem('cine_more') === '1');
    const openMore = (v) => {
        setMore(v);
        sessionStorage.setItem('cine_more', v ? '1' : '0');
    };

    const set = (patch) => onChange({ ...facets, ...patch });
    const genres = genresFor(facets.kind, vocab);

    return (
        <div className="panel">
            {/* Asked for least, placed first — because it is a precondition,
                not a peer: it decides which genre vocabulary exists. */}
            <div className="frow">
                <div className="frow-l">Kind</div>
                <div className="segs">
                    {KINDS.map((k) => (
                        <button
                            key={k.key}
                            type="button"
                            className="seg"
                            aria-pressed={facets.kind === k.key}
                            onClick={() => set({ kind: k.key })}
                        >{k.label}</button>
                    ))}
                </div>
            </div>

            {/* Single-select to start: two genres is an AND, and an AND of two
                genres is usually four films. FD-7. */}
            <Row
                label="Genre"
                options={genres.map((g) => ({ value: g.id, label: g.name }))}
                value={facets.genre}
                onPick={(v) => set({ genre: facets.genre.includes(v) ? facets.genre.filter((x) => x !== v) : [v] })}
            />
            <Row
                label="Language"
                options={LANGS.map((l) => ({ value: l.code, label: l.label }))}
                value={facets.language}
                onPick={(v) => set({ language: facets.language === v ? null : v })}
            />

            {more && (
                <>
                    <WhereToWatch facets={facets} onPick={(v, region) => set({ provider: v, region })} />
                    <Row
                        label="Decade"
                        options={DECADES.map((d) => ({ value: d, label: `${d}s` }))}
                        value={facets.decade}
                        onPick={(v) => set({ decade: facets.decade === v ? null : v })}
                    />
                    {/* Two rungs, not a slider: a slider implies a precision
                        nobody has about a runtime. */}
                    <Row
                        label="Length"
                        options={LENGTHS.map((l) => ({ value: l.value, label: l.label }))}
                        value={facets.length}
                        onPick={(v) => set({ length: facets.length === v ? null : v })}
                    />
                    {/* A band, never a sort — and two rungs, because the
                        difference between 7.4 and 7.6 is not a decision
                        anybody makes. */}
                    <Row
                        label="Rating"
                        options={RATINGS.map((r) => ({ value: r.value, label: r.label }))}
                        value={facets.rating}
                        onPick={(v) => set({ rating: facets.rating === v ? null : v })}
                    />
                </>
            )}

            <button type="button" className="morefilters" aria-expanded={more} onClick={() => openMore(!more)}>
                {more ? 'Fewer filters' : 'More filters'}
                <Icon name={more ? 'up' : 'down'} size={16} />
            </button>

            {/* The only filter that is not TMDB's, and the only one a catalogue
                app cannot offer. A switch rather than a chip because it is a
                lens on any result set, not a constraint within one.

                FB17 — absent for a guest, not disabled. There is no library to
                hide. */}
            {canHide && (
                <label className="hideseen">
                    <input
                        type="checkbox"
                        checked={facets.unseen}
                        onChange={(e) => set({ unseen: e.target.checked })}
                    />
                    <span>Hide what I&apos;ve seen</span>
                </label>
            )}
        </div>
    );
}
