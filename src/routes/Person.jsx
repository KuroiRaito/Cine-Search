import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { person as fetchPerson } from '../lib/tmdb/endpoints.js';
import { toPersonView } from '../lib/tmdb/view.js';
import { useAsync } from '../hooks/useAsync.js';
import { Tile, Skeleton, Empty, initialsOf } from '../components/ui.jsx';

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

    const { data, error, loading, retry } = useAsync(
        ({ signal }) => fetchPerson(id, { signal }).then(toPersonView),
        [id],
    );

    if (loading) {
        return (
            <div className="page">
                <div className="phead">
                    <Skeleton h={68} w={68} style={{ borderRadius: 99 }} />
                    <div style={{ flex: 1, display: 'grid', gap: 8 }}>
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

    return (
        <div className="page">
            <div className="page-head">
                <button type="button" className="circ" onClick={() => navigate(-1)} aria-label="Back">‹</button>
            </div>

            <div className="phead">
                <div className="avatar">
                    {p.photo ? <img src={p.photo} alt="" fetchPriority="high" /> : initialsOf(p.name)}
                </div>
                <div style={{ minWidth: 0 }}>
                    <h1>{p.name}</h1>
                    <div className="sub">
                        {[p.department, lifespan(p)].filter(Boolean).join(' · ')}
                        {p.placeOfBirth && <><br />{p.placeOfBirth}</>}
                    </div>
                </div>
            </div>

            {/* A guest must never see "0 of 10 directed" — a real number that
                happens to be a lie about them. One quiet line until there's a
                library to measure against. */}
            <p className="track-hint">Sign in to track what you&apos;ve seen</p>

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
                    <div className="grid" style={{ marginTop: 14 }}>
                        {active.items.map((it) => <Tile key={`${it.mediaType}-${it.id}`} item={it} />)}
                    </div>
                </>
            )}

            {p.biography && (
                <div className="card">
                    <div className="card-label">Biography</div>
                    <p className="bio">{p.biography}</p>
                </div>
            )}

        </div>
    );
}
