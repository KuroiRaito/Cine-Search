import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthProvider.jsx';
import './entry.css';

/**
 * Who you are signed in as, and how to stop being.
 *
 * This lives in entry because signing out is the other end of signing in, not
 * a setting — and putting the two ends in different modules is how the app
 * ended up with no way out at all. The gear that reached Settings was drawn
 * only in the You screen's populated state, so a new account, signed in with
 * nothing yet marked watched, had no route to it anywhere in the product.
 *
 * Drop it into any screen that should carry the account. It answers all three
 * session states itself, so the caller never has to.
 */
export default function AccountCard({ from = '/' }) {
    const navigate = useNavigate();
    const { authReady, isSignedIn, user, profile, signOut } = useAuth();
    const [confirming, setConfirming] = useState(false);
    const [leaving, setLeaving] = useState(false);

    // Until the session question has an answer, neither offer is honest.
    if (!authReady) {
        return (
            <div className="setblock">
                <div className="setlabel">Account</div>
                <div className="acct-wait" aria-hidden="true" />
            </div>
        );
    }

    if (!isSignedIn) {
        return (
            <div className="setblock">
                <div className="setlabel">Account</div>
                <p className="hint">
                    You&apos;re browsing without one. An account keeps your watchlist,
                    ratings and episode progress.
                </p>
                <Link className="btn" to="/welcome/signup" state={{ from }}>Create an account</Link>
            </div>
        );
    }

    async function out() {
        setLeaving(true);
        await signOut();
        // Home, not back to this screen: half of what was on it was theirs.
        navigate('/', { replace: true });
    }

    return (
        <div className="setblock">
            <div className="setlabel">Account</div>
            <div className="setrow"><span>Username</span><b>{profile?.username || '—'}</b></div>
            <div className="setrow"><span>Email</span><b>{user?.email}</b></div>

            {confirming ? (
                <div className="acct-out">
                    {/* Said before the irreversible-looking button, because the
                        fear this answers — "do I lose what I saved?" — is the
                        reason people do not press it. */}
                    <p className="del-confirm">
                        Your library stays exactly as it is — you&apos;ll just need to sign in
                        again to see it.
                    </p>
                    <div className="del-row">
                        <button type="button" className="btn quiet" onClick={() => setConfirming(false)}>
                            Stay signed in
                        </button>
                        <button type="button" className="del" onClick={out} disabled={leaving}>
                            {leaving ? 'Signing out…' : 'Sign out'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="acct-out">
                    <button type="button" className="del" onClick={() => setConfirming(true)}>Sign out</button>
                </div>
            )}
        </div>
    );
}
