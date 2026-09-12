import { Link } from 'react-router-dom';
import { Empty } from '../components/ui.jsx';

/**
 * Library and You are real destinations that arrive with accounts in Milestone 2.
 *
 * The tabs stay visible and explain themselves rather than disappearing: a nav
 * that changes shape on sign-in is disorienting, a tab that says why is not.
 */
export default function Stub({ what }) {
    return (
        <div className="page">
            <div className="page-head"><h1>{what}</h1></div>
            <Empty
                title={what === 'Library' ? 'Nothing saved yet' : 'Nothing to work from yet'}
                body={what === 'Library'
                    ? 'An account keeps your watchlist, ratings and episode progress.'
                    : 'Your taste is worked out from what you’ve watched and rated.'}
                action={<Link className="btn" to="/welcome">Create an account</Link>}
            />
        </div>
    );
}
