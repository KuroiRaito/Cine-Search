import { useNavigate } from 'react-router-dom';
import { trending } from '../lib/tmdb/endpoints.js';
import { posterUrl } from '../lib/tmdb/view.js';
import { useAsync } from '../hooks/useAsync.js';
import { Attribution } from '../components/ui.jsx';
import { markSeen } from '../lib/firstVisit.js';

/**
 * First visit only. Skippable, and it never comes back.
 *
 * The mosaic is real artwork rather than stock illustration: the catalogue is
 * the product, so showing it is the most honest pitch available. Attribution
 * lives here too — it's contractual, and this is the cheapest place to satisfy it.
 */
export default function Cover() {
    const navigate = useNavigate();
    const { data } = useAsync(
        ({ signal }) => trending('week', { signal }).then((r) => r.filter((x) => x.poster_path).slice(0, 12)),
        [],
    );

    const go = (to) => { markSeen(); navigate(to, { replace: true }); };

    return (
        <div className="cover">
            <div className="mosaic" aria-hidden="true">
                {(data || []).map((it) => (
                    <img key={`${it.media_type}-${it.id}`} src={posterUrl(it.poster_path, 'w185')} alt="" />
                ))}
            </div>

            <div className="cover-body">
                <div className="wordmark"><i />Cine Search</div>
                <h1>Everything you watch,<br />in one place.</h1>
                <p>Films and series together. Track what you&apos;re watching, remember what you loved, and find the next thing.</p>

                <div className="cover-actions">
                    <button type="button" className="btn" onClick={() => go('/welcome/signup')}>Create account</button>
                    <button type="button" className="btn quiet" onClick={() => go('/welcome/signin')}>Sign in</button>
                </div>

                {/* A real, visible action — the Noob's whole persona is browsing
                    before committing, and burying the skip loses them at the door. */}
                <button type="button" className="skip" onClick={() => go('/')}>Browse without an account</button>

                <Attribution />
            </div>
        </div>
    );
}
