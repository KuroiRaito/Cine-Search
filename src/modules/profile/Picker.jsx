import { useState } from 'react';
import { Poster, Empty, Icon } from '../../shared/ui/index.js';
import { useLibrary } from '../library';
import { useAsync } from '../../shared/hooks/useAsync.js';
import { castOf, credit, searchMulti, searchPerson, personCredits } from '../../shared/tmdb/endpoints.js';
import { profileUrl } from '../../shared/tmdb/view.js';
import { castList, cleanCharacter, addFavourite, characterFromCredit } from './shelves.js';
import './profile.css';

/**
 * You cannot type "Walter White".
 *
 * `/search/character` is a 404 and there is no character index to build one
 * from. That single fact decides the whole interaction: the picker asks a
 * question it can answer — which title, or which actor — and arrives at the
 * character from there.
 */
export default function Picker({ have, onClose, onAdded }) {
    const [door, setDoor] = useState(null);
    const [title, setTitle] = useState(null);

    return (
        <div className="scrim" role="dialog" aria-modal="true" aria-label="Add a character" onClick={onClose}>
            <div className="sheet tall" onClick={(e) => e.stopPropagation()}>
                <div className="grab" />
                {!door && <Doors onPick={setDoor} onTitle={(t) => { setTitle(t); setDoor('title'); }} />}
                {door && !title && (
                    <Search
                        kind={door}
                        onBack={() => setDoor(null)}
                        onTitle={setTitle}
                    />
                )}
                {title && (
                    <Roles
                        title={title} have={have}
                        onBack={() => setTitle(null)}
                        onAdded={onAdded}
                    />
                )}
            </div>
        </div>
    );
}

/* --------------------------------- K1 ---------------------------------- */

function Doors({ onPick, onTitle }) {
    const lib = useLibrary();
    // Most favourites come from something you just finished, so the thing you
    // just finished is offered before anybody has to type.
    const recent = Object.values(lib.entries || {})
        .filter((e) => e.status === 'watched' || e.status === 'rewatching')
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
        .slice(0, 6);

    return (
        <>
            <h2 className="sheet-title">Add a character</h2>
            <p className="sheet-body">
                Characters live inside cast lists, so start with something you know.
            </p>
            <div className="doors">
                <button type="button" className="btn quiet" onClick={() => onPick('title')}>
                    <Icon name="film" size={16} /> From a film or series
                </button>
                <button type="button" className="btn quiet" onClick={() => onPick('person')}>
                    <Icon name="you" size={16} /> From an actor
                </button>
            </div>
            {recent.length > 0 && (
                <>
                    <div className="pick-lbl">Recently watched</div>
                    <ul className="picklist">
                        {recent.map((e) => (
                            <li key={`${e.media_type}-${e.tmdb_id}`}>
                                <button
                                    type="button" className="pickrow"
                                    onClick={() => onTitle({ id: e.tmdb_id, mediaType: e.media_type, name: e.title || 'Untitled' })}
                                >
                                    <b>{e.title || `#${e.tmdb_id}`}</b>
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </>
    );
}

/* ------------------------- K1 · the two doors -------------------------- */

function Search({ kind, onBack, onTitle }) {
    const [q, setQ] = useState('');
    const [term, setTerm] = useState('');

    const { data, loading } = useAsync(
        ({ signal }) => (kind === 'person'
            ? searchPerson(term, { signal })
            : searchMulti(term, {}, { signal })),
        [term, kind],
        { skip: !term },
    );

    const results = (data || []).filter((r) => (kind === 'person'
        ? r.known_for_department === 'Acting'
        : r.media_type === 'movie' || r.media_type === 'tv'));

    return (
        <>
            <button type="button" className="linkish back" onClick={onBack}>
                <Icon name="back" size={16} /> Back
            </button>
            <h2 className="sheet-title">{kind === 'person' ? 'Which actor?' : 'Which title?'}</h2>
            <form onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}>
                <input
                    className="searchbox" type="search" value={q} autoFocus
                    placeholder={kind === 'person' ? 'Search people' : 'Search films and series'}
                    onChange={(e) => setQ(e.target.value)}
                    aria-label={kind === 'person' ? 'Search people' : 'Search films and series'}
                />
            </form>
            {loading && <p className="pick-note">Looking…</p>}
            <ul className="picklist">
                {results.slice(0, 12).map((r) => (
                    <li key={`${r.media_type || 'p'}-${r.id}`}>
                        <button
                            type="button" className="pickrow"
                            onClick={() => (kind === 'person'
                                ? onTitle({ personId: r.id, name: r.name })
                                : onTitle({ id: r.id, mediaType: r.media_type, name: r.title || r.name }))}
                        >
                            <b>{r.title || r.name}</b>
                            <span>{(r.release_date || r.first_air_date || '').slice(0, 4)}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </>
    );
}

/* --------------------------- K2 · K3 · K5 ------------------------------ */

function Roles({ title, have, onBack, onAdded }) {
    const [filter, setFilter] = useState('');
    const [saving, setSaving] = useState(null);

    const { data, loading, error } = useAsync(
        ({ signal }) => (title.personId
            ? personCredits(title.personId, { signal }).then((d) => ({ cast: d.cast || [] }))
            : castOf(title.mediaType, title.id, { signal })),
        [title.id, title.personId, title.mediaType],
    );

    const roles = title.personId
        // An actor's own credits: each is already one character in one title.
        ? (data?.cast || [])
            .filter((c) => c.character && c.credit_id)
            .map((c) => ({
                creditId: c.credit_id,
                character: cleanCharacter(c.character),
                actor: title.name,
                profilePath: c.poster_path || null,
                subtitle: c.title || c.name,
                episodes: c.episode_count ?? null,
            }))
            .sort((a, b) => (b.episodes ?? 0) - (a.episodes ?? 0))
        : castList(data, title.mediaType);

    const shown = filter
        ? roles.filter((r) => `${r.character} ${r.actor}`.toLowerCase().includes(filter.toLowerCase()))
        : roles;

    async function pick(role) {
        setSaving(role.creditId);
        // The card is built from the credit itself rather than from the row we
        // happen to be looking at: one request, and every copied string comes
        // from the same place the card will later be refreshed from.
        const fresh = await credit(role.creditId).catch(() => null);
        const row = fresh
            ? characterFromCredit(role.creditId, fresh)
            : {
                kind: 'character', ref: role.creditId, name: role.character,
                subtitle: role.subtitle || title.name, actor: role.actor,
                image_path: role.profilePath, poster_path: null,
                media_type: title.mediaType || 'movie', tmdb_id: title.id ?? null, animated: false,
            };
        await addFavourite(row).catch(() => {});
        setSaving(null);
        onAdded(row);
    }

    return (
        <>
            <button type="button" className="linkish back" onClick={onBack}>
                <Icon name="back" size={16} /> Back
            </button>
            <h2 className="sheet-title">{title.name}</h2>
            {roles.length > 0 && (
                <p className="sheet-body">
                    {roles.length} {title.personId ? 'roles' : 'cast'}
                    {title.mediaType === 'tv' && ' · ordered by episode count'}
                </p>
            )}
            {roles.length > 8 && (
                <input
                    className="searchbox" type="search" value={filter}
                    placeholder="Filter by name" aria-label="Filter by name"
                    onChange={(e) => setFilter(e.target.value)}
                />
            )}

            {loading && <p className="pick-note">Loading the cast…</p>}

            {/* K5 — TMDB has no cast, or every role is "Self" and "Man in Bar".
                A character needs a name to be a favourite, so say so plainly
                rather than showing an empty list. */}
            {!loading && !error && roles.length === 0 && (
                <Empty
                    title="No named roles here"
                    body="TMDB has no cast for this one, or none of its roles carry a character name. Try another title."
                />
            )}

            <ul className="picklist">
                {shown.slice(0, 40).map((r) => {
                    const already = have.has(r.creditId);
                    return (
                        <li key={r.creditId}>
                            <button
                                type="button" className="pickrow"
                                disabled={already || saving === r.creditId}
                                onClick={() => pick(r)}
                            >
                                <span className="pickface">
                                    <Poster path={r.profilePath} src={r.profilePath ? profileUrl(r.profilePath, 'w185') : null} title={r.actor} />
                                </span>
                                <span className="pickmeta">
                                    <b>{r.character}</b>
                                    <span>
                                        {r.actor}
                                        {r.episodes ? ` · ${r.episodes} eps` : ''}
                                        {r.subtitle ? ` · ${r.subtitle}` : ''}
                                    </span>
                                </span>
                                {/* K3 — ticked and disabled, not hidden. Hiding
                                    it reads as missing data. */}
                                {already && (
                                    <span className="picktick">
                                        <Icon name="check" size={16} label="Already a favourite" />
                                    </span>
                                )}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </>
    );
}
