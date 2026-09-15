import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trending, nowPlaying, upcoming, onTheAir } from '../../shared/tmdb/endpoints.js';
import { fromItem } from '../../shared/tmdb/view.js';
import { useAsync } from '../../shared/hooks/useAsync.js';
import { useRegion } from '../../shared/hooks/useRegion.js';
import { Rail, Skeleton, ErrorBox } from '../../shared/ui/index.js';
import { useAuth } from '../../shared/auth/AuthProvider.jsx';
import { useTileStates, useQuickAdd } from '../library';
import { SignInPrompt } from '../entry';
import ThemeToggle from '../../shared/theme/ThemeToggle.jsx';
import './discover.css';

function FeedRail({ title, load, deps, onAdd, stateFor }) {
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
    return <Rail title={title} items={data} onAdd={onAdd} stateFor={stateFor} />;
}

export default function Discover() {
    const { region } = useRegion();
    const { isSignedIn, authReady, profile } = useAuth();
    const [prompt, setPrompt] = useState(null);

    // Tapping + on any tile is how a guest discovers what the product is for.
    const onAdd = useQuickAdd((item) => setPrompt({ title: item.title, poster: item.poster, action: 'save' }));
    const stateFor = useTileStates();

    return (
        <div className="page">
            <div className="page-head">
                <h1>Discover</h1>
                <div className="head-actions">
                    <Link to="/search" className="circ" aria-label="Search">⌕</Link>
                    <ThemeToggle />
                    {!authReady ? <span className="btn quiet is-waiting" aria-hidden="true" />
                        : isSignedIn
                            ? <Link to="/you" className="btn quiet">{profile?.username || 'You'}</Link>
                            : <Link to="/welcome/signin" state={{ from: '/' }} className="btn quiet">Sign in</Link>}
                </div>
            </div>

            <FeedRail
                title="Trending this week"
                onAdd={onAdd}
                stateFor={stateFor}
                load={({ signal }) => trending('week', { signal }).then((r) => r.map(fromItem))}
                deps={[]}
            />
            <FeedRail
                title="In cinemas now"
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
                onAdd={onAdd}
                stateFor={stateFor}
                load={({ signal }) => onTheAir({ signal }).then((r) => r.map(fromItem))}
                deps={[]}
            />
            <FeedRail
                title="Coming soon"
                onAdd={onAdd}
                stateFor={stateFor}
                load={({ signal }) => upcoming(region, { signal }).then((r) => r.map(fromItem))}
                deps={[region]}
            />

            {prompt && <SignInPrompt {...prompt} onClose={() => setPrompt(null)} />}
        </div>
    );
}
