import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Poster } from '../../shared/ui/index.js';
import './entry.css';

// The verb must match the control that was tapped. A pill reading "Want to
// watch" that raises a sheet asking "Mark watched?" tells the user the app
// wasn't listening.
const VERBS = {
    save: 'Save',
    want: 'Add',
    track: 'Track',
    rate: 'Rate',
    like: 'Like',
    edit: 'Edit',
    watched: 'Mark watched',
};

/**
 * Raised when a guest taps a tracking control.
 *
 * It names the specific title and the specific action — never a generic "sign in
 * to continue". The person was doing something; the prompt should know what.
 *
 * Carrying the intent through sign-up — so the ♥ that raised this completes on
 * the way back — is still open. See MODULE.md.
 */
export default function SignInPrompt({ title, poster, action = 'save', onClose }) {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const go = (mode) => navigate(`/welcome/${mode}`, { state: { from: pathname } });
    const sheet = useRef(null);

    /**
     * S6 — a modal that does not hold focus is a modal only to the eye.
     *
     * Three things, and the third is the one that gets forgotten: focus moves
     * in, Tab cannot leave, and on close it goes back to the control that
     * raised this. Returning focus to the top of the page instead would make a
     * keyboard user re-find the heart they just pressed.
     */
    useEffect(() => {
        const opener = document.activeElement;
        const focusables = () => Array.from(
            sheet.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || [],
        ).filter((el) => !el.hasAttribute('disabled'));

        focusables()[0]?.focus();

        const onKey = (e) => {
            if (e.key === 'Escape') return onClose();
            if (e.key !== 'Tab') return undefined;
            const items = focusables();
            if (!items.length) return undefined;
            const first = items[0];
            const last = items[items.length - 1];
            // Only the two ends need handling; everything between them is the
            // browser doing the right thing already.
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            return undefined;
        };

        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
        };
    }, [onClose]);

    return (
        <div className="scrim" role="dialog" aria-modal="true" aria-label={`${VERBS[action]} ${title}`} onClick={onClose}>
            <div className="sheet" ref={sheet} onClick={(e) => e.stopPropagation()}>
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
                    <button type="button" className="btn" onClick={() => go('signup')}>Create account</button>
                    <button type="button" className="btn quiet" onClick={() => go('signin')}>Sign in</button>
                </div>
                <button type="button" className="dismiss" onClick={onClose}>Not now</button>
            </div>
        </div>
    );
}
