import { Link, useNavigate } from 'react-router-dom';
import { Empty } from '../components/ui.jsx';
import { useAuth } from '../context/AuthProvider.jsx';

/**
 * Library and You are real destinations once there are records to show. Until
 * then the tabs stay visible and explain themselves — a nav that changes shape
 * on sign-in is disorienting; a tab that says why is not.
 */
export default function Stub({ what }) {
    const { isSignedIn, profile, signOut } = useAuth();
    const navigate = useNavigate();
    const isLibrary = what === 'Library';

    if (isSignedIn) {
        return (
            <div className="page">
                <div className="page-head"><h1>{isLibrary ? 'Library' : profile?.username || 'You'}</h1></div>
                <Empty
                    title={isLibrary ? 'Nothing saved yet' : 'Nothing to work from yet'}
                    body={isLibrary
                        ? 'Save a film or series and it will appear here.'
                        : 'Your taste is worked out from what you’ve watched and rated.'}
                    action={<Link className="btn" to="/">Find something to watch</Link>}
                />
                {!isLibrary && (
                    <div className="pad" style={{ marginTop: 'var(--s6)' }}>
                        <button
                            type="button"
                            className="btn quiet"
                            style={{ width: '100%' }}
                            onClick={async () => { await signOut(); navigate('/', { replace: true }); }}
                        >
                            Sign out
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="page">
            <div className="page-head"><h1>{what}</h1></div>
            <Empty
                title={isLibrary ? 'Nothing saved yet' : 'Nothing to work from yet'}
                body={isLibrary
                    ? 'An account keeps your watchlist, ratings and episode progress.'
                    : 'Your taste is worked out from what you’ve watched and rated.'}
                action={<Link className="btn" to="/welcome/signup" state={{ from: isLibrary ? '/library' : '/you' }}>Create an account</Link>}
            />
        </div>
    );
}
