import { useEffect } from 'react';

/**
 * Named, not generic. "Breaking Bad · S2 E4 watched" is worth reading; "Saved"
 * is not — and an undo that doesn't say what it would undo is a dare.
 *
 * Six seconds, because that is roughly how long an undo stays plausible. The
 * timer restarts whenever the message changes, so a run of quick actions never
 * leaves the last one on screen for a fraction of a second.
 */
export function Toast({ message, actionLabel, onAction, onDismiss, ttl = 6000 }) {
    useEffect(() => {
        if (!message) return undefined;
        const t = setTimeout(onDismiss, ttl);
        return () => clearTimeout(t);
    }, [message, onDismiss, ttl]);

    if (!message) return null;
    return (
        <div className="toast" role="status">
            <span>{message}</span>
            {actionLabel
                ? <button type="button" onClick={onAction}>{actionLabel}</button>
                : <button type="button" onClick={onDismiss} aria-label="Dismiss">✕</button>}
        </div>
    );
}
