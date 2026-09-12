import { Link } from 'react-router-dom';
import { trending, nowPlaying, upcoming, onTheAir } from '../lib/tmdb/endpoints.js';
import { fromItem } from '../lib/tmdb/view.js';
import { useAsync } from '../hooks/useAsync.js';
import { useRegion } from '../hooks/useRegion.js';
import { Rail, Skeleton, ErrorBox, Attribution } from '../components/ui.jsx';

function FeedRail({ title, load, deps }) {
    const { data, error, loading, retry } = useAsync(load, deps);

    if (loading) {
        return (
            <>
                <div className="section"><div className="section-h"><span>{title}</span></div></div>
                <div className="rail">
                    {[0, 1, 2, 3].map((i) => (
                        <div className="tile" key={i}>
                            <Skeleton h={162} style={{ borderRadius: 8, marginBottom: 5 }} />
                            <Skeleton h={11} w="85%" />
                        </div>
                    ))}
                </div>
            </>
        );
    }
    // One dead feed must not take the page with it.
    if (error) return <ErrorBox what={title.toLowerCase()} onRetry={retry} />;
    return <Rail title={title} items={data} />;
}

export default function Discover() {
    const { region } = useRegion();

    return (
        <div className="page">
            <div className="page-head">
                <h1>Discover</h1>
                <Link to="/search" className="circ" aria-label="Search">⌕</Link>
            </div>

            <FeedRail
                title="Trending this week"
                load={({ signal }) => trending('week', { signal }).then((r) => r.map(fromItem))}
                deps={[]}
            />
            <FeedRail
                title="In cinemas now"
                load={({ signal }) => nowPlaying(region, { signal }).then((r) => r.map(fromItem))}
                deps={[region]}
            />

            {/* Exactly one sign-up card, after two rails — below the fold, once
                some value has been delivered. Not a banner, not a modal. */}
            <div className="card signup">
                <h2>Keep track of what you watch</h2>
                <p>Your watchlist, ratings and episode progress — private by default.</p>
                <Link className="btn" to="/welcome">Create an account</Link>
            </div>

            <FeedRail
                title="On air now"
                load={({ signal }) => onTheAir({ signal }).then((r) => r.map(fromItem))}
                deps={[]}
            />
            <FeedRail
                title="Coming soon"
                load={({ signal }) => upcoming(region, { signal }).then((r) => r.map(fromItem))}
                deps={[region]}
            />

            <Attribution />
        </div>
    );
}
