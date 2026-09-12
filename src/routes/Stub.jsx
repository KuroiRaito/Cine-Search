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
                title={what === 'Library' ? 'Nothing saved yet' : 'Your taste, once you’ve watched a few things'}
                body={what === 'Library'
                    ? 'Create an account to keep a watchlist, rate what you’ve seen, and track series episode by episode.'
                    : 'Genres, directors and decades, worked out from your own records. Private by default.'}
                action={<Link className="btn" to="/welcome">Create an account</Link>}
            />
        </div>
    );
}
