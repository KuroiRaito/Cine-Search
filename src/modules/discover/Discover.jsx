import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trending, nowPlaying, upcoming, onTheAir } from '../../shared/tmdb/endpoints.js';
import { fromItem } from '../../shared/tmdb/view.js';
import { useAsync } from '../../shared/hooks/useAsync.js';
import { useRegion } from '../../shared/hooks/useRegion.js';
import { Rail, Skeleton, ErrorBox, Icon } from '../../shared/ui/index.js';
import { useAuth } from '../../shared/auth/AuthProvider.jsx';
import { useTileStates, useQuickAdd } from '../library';
import { SignInPrompt } from '../entry';
import { presetsFor, facetsFor, toParams, readRegion } from '../search';
import './discover.css';

/* L6 — every rail header is a link, and the link is a browse.
 *
 * A rail shows twenty of four thousand and then stops; today that is where the
 * journey ends. This is also how Browse gets discovered without a tab of its
 * own: it is not somewhere you go, it is what happens when you ask a rail for
 * more. */
const browseTo = (facets) => {
    const p = toParams({ ...facets });
    /* "Everything, most popular" is a real browse and its facets are all
       defaults, so toParams — which rightly omits defaults — returns nothing,
       and nothing is the search screen at rest rather than a browse. The rail
       says the ordering out loud instead. */
    if (![...p.keys()].length) p.set('sort', facets.sort || 'popular');
    return `/search?${p}`;
};

/* Formatted locally, never through toISOString: that converts to UTC first, so
   anybody east of Greenwich gets the 29th of a thirty-day month. */
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const thisMonth = () => {
    const now = new Date();
    return {
        from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
};

function FeedRail({ title, load, deps, onAdd, stateFor, more }) {
    const { data, error, loading, retry } = useAsync(load, deps);

    if (loading) {
        return (
            <>
                <div className="section"><div className="section-h"><span>{title}</span></div></div>
                <div className="rail">
                    {[0, 1, 2, 3].map((i) => (
                        <div className="tile" key={i}>
                            <Skeleton h={162} className="skel-poster" />
                            <Skeleton h={11} w="85%" />
                        </div>
                    ))}
                </div>
            </>
        );
    }
    // One dead feed must not take the page with it.
    if (error) return <ErrorBox what={title.toLowerCase()} onRetry={retry} />;
    return (
        <Rail
            title={title}
            items={data}
            onAdd={onAdd}
            stateFor={stateFor}
            action={more && <Link className="railmore" to={more}>All</Link>}
        />
    );
}

export default function Discover() {
    const { region } = useRegion();
    const { isSignedIn, authReady } = useAuth();
    const [prompt, setPrompt] = useState(null);

    // Tapping + on any tile is how a guest discovers what the product is for.
    const onAdd = useQuickAdd((item) => setPrompt({ title: item.title, poster: item.poster, action: 'save' }));
    const stateFor = useTileStates();

    return (
        <div className="page">
            <div className="page-head">
                <h1>Discover</h1>
                {/* The page's own search icon, theme toggle and sign-in
                    button used to live here, duplicating three controls the
                    shell's top bar already owns at desktop — and which the tab
                    bar owns on a phone. The module's own notes flagged it.
                    With the box reachable by tab and by rail, the page-level
                    copy has no job left. */}
            </div>

            {/* A chip row, not a rail. It moves up for a guest or an empty
                library — the person with nothing to continue is the one who
                most needs a way in. */}
            <Presets />

            <FeedRail
                title="Trending this week"
                more={browseTo({ sort: 'popular' })}
                onAdd={onAdd}
                stateFor={stateFor}
                load={({ signal }) => trending('week', { signal }).then((r) => r.map(fromItem))}
                deps={[]}
            />
            <FeedRail
                title="In cinemas now"
                more={browseTo({ kind: 'movie', sort: 'popular', ...thisMonth() })}
                onAdd={onAdd}
                stateFor={stateFor}
                load={({ signal }) => nowPlaying(region, { signal }).then((r) => r.map(fromItem))}
                deps={[region]}
            />

            {/* Exactly one sign-up card, after two rails — below the fold, once
                some value has been delivered. Gone entirely once you're in;
                selling an account to someone who has one is just noise. */}
            {authReady && !isSignedIn && (
                <div className="card signup">
                    <h2>Keep track of what you watch</h2>
                    <p>Your watchlist, ratings and episode progress — private by default.</p>
                    <Link className="btn" to="/welcome/signup" state={{ from: '/' }}>Create an account</Link>
                </div>
            )}

            <FeedRail
                title="On air now"
                more={browseTo({ kind: 'tv', sort: 'popular' })}
                onAdd={onAdd}
                stateFor={stateFor}
                load={({ signal }) => onTheAir({ signal }).then((r) => r.map(fromItem))}
                deps={[]}
            />
            <FeedRail
                title="Coming soon"
                more={browseTo({ kind: 'movie', sort: 'newest' })}
                onAdd={onAdd}
                stateFor={stateFor}
                load={({ signal }) => upcoming(region, { signal }).then((r) => r.map(fromItem))}
                deps={[region]}
            />

            {prompt && <SignInPrompt {...prompt} onClose={() => setPrompt(null)} />}
        </div>
    );
}

/**
 * Six guesses at six moods, each of which is only facets.
 *
 * Tapping one lands on /search with its facets in the chip row, where they can
 * be taken apart one at a time. That is the difference between a curated shelf
 * and a starting point.
 */
function Presets() {
    const region = readRegion();
    const offered = presetsFor(region);
    return (
        <div className="chips presets">
            {offered.map((p) => (
                <Link key={p.key} className="chip" to={browseTo(facetsFor(p, region))} title={p.definition}>
                    {p.label}
                </Link>
            ))}
        </div>
    );
}
