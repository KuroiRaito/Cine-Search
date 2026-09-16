import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { person as fetchPerson } from '../../shared/tmdb/endpoints.js';
import { toPersonView } from '../../shared/tmdb/view.js';
import { useAsync } from '../../shared/hooks/useAsync.js';
import { Tile, Skeleton, Empty, initialsOf } from '../../shared/ui/index.js';
import { SignInPrompt } from '../entry';
import { useAuth } from '../../shared/auth/AuthProvider.jsx';
import { usePersonFavourite } from '../profile';
import { useLibrary, useTileStates, useQuickAdd } from '../library';
import { collectionProgress } from '../library';
import './person.css';
import { Icon } from '../../shared/ui/index.js';

const year = (d) => (d ? new Date(d).getFullYear() : null);

function lifespan(p) {
    if (!p.birthday) return null;
    const born = year(p.birthday);
    if (p.deathday) return `${born}–${year(p.deathday)}`;
    const age = new Date().getFullYear() - born;
    return `Born ${born} · ${age}`;
}

export default function Person() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [role, setRole] = useState(null);
    const [prompt, setPrompt] = useState(null);
    const onAdd = useQuickAdd((x) => setPrompt({ title: x.title, poster: x.poster, action: 'save' }));
    const stateFor = useTileStates();
    const { isSignedIn, authReady } = useAuth();
    const fav = usePersonFavourite(p);
    const lib = useLibrary();

    const { data, error, loading, retry } = useAsync(
        ({ signal }) => fetchPerson(id, { signal }).then(toPersonView),
        [id],
    );

    if (loading) {
        return (
            <div className="page">
                <div className="phead">
                    <Skeleton h={68} w={68} className="skel-round" />
                    <div className="skel-lines">
                        <Skeleton h={20} w="60%" /><Skeleton h={12} w="40%" />
                    </div>
                </div>
                <div className="card"><Skeleton h={120} /></div>
            </div>
        );
    }

    if (error) {
        const gone = error?.status === 404;
        return (
            <Empty
                title={gone ? 'We couldn’t find that person' : 'Something went wrong'}
                body={gone ? 'They may have been removed from TMDB, or the link may be wrong.' : 'The Movie Database didn’t answer.'}
                action={gone
                    ? <Link className="btn" to="/">Go to Discover</Link>
                    : <button type="button" className="btn" onClick={retry}>Try again</button>}
            />
        );
    }

    const p = data;
    // Director leads where it exists — it's the role most people actually track.
    const activeKey = role || p.roles[0]?.key;
    const active = p.roles.find((r) => r.key === activeKey) || p.roles[0];

    // Free: the credits were fetched to draw this page, and the library is
    // already in memory. No request is made to work this out.
    const { seen, total, pct } = collectionProgress(active, lib.entryFor);

    return (
        <div className="page">
            <div className="page-head">
                <button type="button" className="circ" onClick={() => navigate(-1)} aria-label="Back"><Icon name="back" size={24} /></button>
            </div>

            <div className="phead">
                <div className="avatar">
                    {p.photo ? <img src={p.photo} alt="" fetchPriority="high" /> : initialsOf(p.name)}
                </div>
                <div className="phead-text">
                    <h1>{p.name}</h1>
                    <div className="sub">
                        {[p.department, lifespan(p)].filter(Boolean).join(' · ')}
                        {p.placeOfBirth && <><br />{p.placeOfBirth}</>}
                    </div>
                </div>
                {/* Actors and crew share one shelf on the profile, so this is
                    the same control on everybody's page. Hidden for a guest
                    rather than raising a sheet: there is no title here for one
                    to name. */}
                {fav.canFavourite && (
                    <button
                        type="button"
                        className={fav.on ? 'ibtn like on' : 'ibtn like'}
                        aria-pressed={fav.on}
                        aria-label={fav.on ? `Remove ${p.name} from favourites` : `Add ${p.name} to favourites`}
                        onClick={fav.toggle}
                    ><Icon name="heart" size={20} /></button>
                )}
            </div>

            {/* Above the filmography, not buried in stats: "6 of 10 directed"
                is the differentiator, so it is the first thing on the page.
                A guest must never see "0 of 10" — a real number that happens to
                be a lie about them — so they get the invitation instead. */}
            {isSignedIn && total > 0 ? (
                <div className="collectbar">
                    <div className="cb-t">
                        <b><i>{seen}</i> of {total} {active.verb}</b>
                        <span>{pct}%</span>
                    </div>
                    <div className="cb-track"><i style={{ width: `${pct}%` }} /></div>
                    <div className="cb-sub">
                        {seen === total
                            ? 'All of it'
                            : `${total - seen} to go`}
                        {active.filteredOut > 0 && ` · ${active.filteredOut} credit${active.filteredOut === 1 ? '' : 's'} filtered out`}
                    </div>
                </div>
            ) : (
                authReady && !isSignedIn && <p className="track-hint">Sign in to track what you&apos;ve seen</p>
            )}

            {/* Films before biography: this is a collection product, the work is the point. */}
            {p.roles.length > 0 && (
                <>
                    <div className="rolesw" role="tablist" aria-label="Roles">
                        {p.roles.map((r) => (
                            <button
                                key={r.key}
                                type="button"
                                role="tab"
                                className="sw"
                                aria-pressed={activeKey === r.key}
                                onClick={() => setRole(r.key)}
                            >
                                {r.label}<em>{r.items.length}</em>
                            </button>
                        ))}
                    </div>
                    <div className="grid filmography">
                        {active.items.map((it) => (
                            <Tile
                                key={`${it.mediaType}-${it.id}`}
                                item={it}
                                onAdd={onAdd}
                                state={stateFor(it)}
                            />
                        ))}
                    </div>
                </>
            )}

            {p.biography && (
                <div className="card">
                    <div className="card-label">Biography</div>
                    <p className="bio">{p.biography}</p>
                </div>
            )}

            {prompt && <SignInPrompt {...prompt} onClose={() => setPrompt(null)} />}
        </div>
    );
}
