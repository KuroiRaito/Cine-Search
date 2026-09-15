import { Link, useNavigate, Navigate } from 'react-router-dom';
import { trending } from '../../shared/tmdb/endpoints.js';
import { posterUrl } from '../../shared/tmdb/view.js';
import { useAsync } from '../../shared/hooks/useAsync.js';
import { markSeen } from '../../app/firstVisit.js';
import { useAuth } from '../../shared/auth/AuthProvider.jsx';
import ThemeToggle from '../../shared/theme/ThemeToggle.jsx';
import './entry.css';

/**
 * First visit only. Skippable, and it never comes back.
 *
 * The backdrop is a full-bleed mosaic of real artwork — rotated, scaled past
 * the edges and held at half opacity behind a scrim. Never stock illustration:
 * the catalogue is the product, so showing it is the most honest pitch there is.
 *
 * Attribution lives here too. It's contractual, and this is the first screen —
 * the cheapest possible place to satisfy it.
 */
export default function Cover() {
    const navigate = useNavigate();
    const { authReady, isSignedIn } = useAuth();
    const { data, error } = useAsync(
        ({ signal }) => trending('week', { signal }).then((r) => r.filter((x) => x.poster_path).slice(0, 12)),
        [],
    );

    // A signed-in person has no business being pitched the product. This is
    // reachable: clearing site data leaves the cover flag gone and the session
    // intact, and so does anyone typing the URL.
    if (authReady && isSignedIn) {
        markSeen();
        return <Navigate to="/" replace />;
    }

    const go = (to) => { markSeen(); navigate(to, { replace: true }); };

    return (
        <div className="cover">
            {/* The cover is not broken without artwork, only plainer, so a
                failed fetch says nothing — it just falls back to a gradient. */}
            {(error || (data && data.length === 0)) && <div className="cover-fallback" aria-hidden="true" />}
            <div className="mosaic" aria-hidden="true">
                {(data || []).map((it) => (
                    <div
                        key={`${it.media_type}-${it.id}`}
                        className="mosaic-cell"
                        style={{ backgroundImage: `url(${posterUrl(it.poster_path, 'w342')})` }}
                    />
                ))}
            </div>
            <div className="cover-scrim" aria-hidden="true" />

            <div className="cover-theme"><ThemeToggle /></div>

            <div className="cover-in">
                <div className="cover-mark"><i />Cine Search</div>

                <h1>Everything you&apos;ve watched.<br />Everything you will.</h1>
                <p>Track films and series, see where to watch them, and keep the whole lot in one place.</p>

                <div className="cover-cta">
                    <button type="button" className="btn btn-lg" onClick={() => go('/welcome/signup')}>Create account</button>
                    <button type="button" className="btn btn-lg ghost" onClick={() => go('/welcome/signin')}>Sign in</button>
                </div>

                {/* A real, visible action — the whole point of this persona is
                    browsing before committing, and burying the skip loses them
                    at the door. */}
                <div className="cover-skip">
                    <button type="button" onClick={() => go('/')}>Browse without an account →</button>
                </div>

                <div className="cover-fine">
                    Data from <Link to="/about" onClick={markSeen}>TMDB and JustWatch</Link>
                </div>
            </div>
        </div>
    );
}
