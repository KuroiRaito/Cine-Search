import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Poster } from './ui.jsx';

const VERBS = {
    save: 'Save',
    track: 'Track',
    rate: 'Rate',
    watched: 'Mark watched',
};

/**
 * Raised when a guest taps a tracking control.
 *
 * It names the specific title and the specific action — never a generic "sign in
 * to continue". The person was doing something; the prompt should know what.
 *
 * Milestone 2 will carry the intent through sign-up so the action completes on
 * the way back. Until accounts exist, both buttons lead to the cover page.
 */
export default function SignInPrompt({ title, poster, action = 'save', onClose }) {
    const navigate = useNavigate();

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="scrim" role="dialog" aria-modal="true" aria-label={`${VERBS[action]} ${title}`} onClick={onClose}>
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
                <div className="grab" />
                <div className="sheet-head">
                    <div className="sheet-art"><Poster src={poster} title={title} /></div>
                    <h2 className="sheet-title">{VERBS[action]} {title}?</h2>
                </div>
                <p className="sheet-body">You’ll need an account to keep track of what you watch.</p>
                <ul className="benefits">
                    <li>Your watchlist, ratings and progress in one place</li>
                    <li>Pick up any series exactly where you left off</li>
                    <li>Private by default — nobody sees your library but you</li>
                </ul>
                <div className="sheet-actions">
                    <button type="button" className="btn" onClick={() => navigate('/welcome')}>Create account</button>
                    <button type="button" className="btn quiet" onClick={() => navigate('/welcome')}>Sign in</button>
                </div>
                <button type="button" className="dismiss" onClick={onClose}>Not now</button>
            </div>
        </div>
    );
}
