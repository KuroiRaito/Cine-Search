import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthProvider.jsx';
import { useRegion } from '../../shared/hooks/useRegion.js';
import { activeTheme, applyTheme } from '../../shared/theme/theme.js';
import './you.css';

/**
 * Plain and conventional by decision, not by omission — settings has no bespoke
 * design because it does not need one. Standard rows and toggles.
 */
export default function Settings() {
    const navigate = useNavigate();
    const { user, profile, signOut, isSignedIn, authReady } = useAuth();
    const { region, setRegion } = useRegion();
    const [theme, setTheme] = useState(activeTheme);
    const [confirming, setConfirming] = useState(false);

    const flip = (next) => { applyTheme(next); setTheme(next); };

    // Only the countries TMDB actually returns providers for are worth offering;
    // the rest would be a menu of ways to see "not available here".
    const REGIONS = [
        ['IN', 'India'], ['US', 'United States'], ['GB', 'United Kingdom'],
        ['CA', 'Canada'], ['AU', 'Australia'], ['DE', 'Germany'],
        ['FR', 'France'], ['JP', 'Japan'], ['BR', 'Brazil'],
    ];

    return (
        <div className="page">
            <div className="page-head">
                <button type="button" className="circ" onClick={() => navigate(-1)} aria-label="Back">‹</button>
                <h1>Settings</h1>
                <span className="head-spacer" />
            </div>

            <div className="setblock">
                <div className="setlabel">Appearance</div>
                <div className="segs two">
                    {['dark', 'light'].map((t) => (
                        <button
                            key={t}
                            type="button"
                            className={`seg${theme === t ? ' on st-done' : ''}`}
                            aria-pressed={theme === t}
                            onClick={() => flip(t)}
                        >
                            {t === 'dark' ? '◐' : '◑'}<i>{t === 'dark' ? 'Dark' : 'Light'}</i>
                        </button>
                    ))}
                </div>
            </div>

            <div className="setblock">
                <label className="setlabel" htmlFor="set-region">Where to watch</label>
                <select
                    id="set-region"
                    className="inp"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                >
                    {REGIONS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
                {/* "Region is stated, not implied" — a silent wrong region is the
                    most confusing failure available, so say where the current
                    one came from. */}
                <p className="hint">
                    Streaming availability is shown for this country. It was detected from
                    your connection, and travelling changes it — set it here to stop that.
                </p>
            </div>

            {/* Theme and region are as useful to a guest as to anyone — they are
                about this browser, not this account. Everything below is not. */}
            {authReady && !isSignedIn && (
                <div className="setblock">
                    <div className="setlabel">Account</div>
                    <p className="hint">
                        You&apos;re browsing without one. An account keeps your watchlist,
                        ratings and episode progress.
                    </p>
                    <Link className="btn" to="/welcome/signup" state={{ from: '/settings' }}>Create an account</Link>
                </div>
            )}

            {authReady && isSignedIn && (
            <div className="setblock">
                <div className="setlabel">Account</div>
                <div className="setrow"><span>Username</span><b>{profile?.username || '—'}</b></div>
                <div className="setrow"><span>Email</span><b>{user?.email}</b></div>
            </div>
            )}

            {authReady && isSignedIn && (
            <div className="setblock">
                {confirming ? (
                    <>
                        <p className="del-confirm">
                            Your library stays exactly as it is — you&apos;ll just need to sign in again to see it.
                        </p>
                        <div className="del-row">
                            <button type="button" className="btn quiet" onClick={() => setConfirming(false)}>Stay signed in</button>
                            <button
                                type="button"
                                className="del"
                                onClick={async () => { await signOut(); navigate('/', { replace: true }); }}
                            >Sign out</button>
                        </div>
                    </>
                ) : (
                    <button type="button" className="del" onClick={() => setConfirming(true)}>Sign out</button>
                )}
            </div>
            )}
        </div>
    );
}
