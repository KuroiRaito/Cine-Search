import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Toast } from '../shared/ui/index.js';

/**
 * The toast belongs to the shell, and there is exactly one.
 *
 * SH15 — two modules rendered their own. Five screens can perform the action a
 * toast describes, and only two of them said anything:
 *
 *   Library          a named toast with an undo
 *   Title page       a named toast with an undo
 *   Discover         the tile's badge changes. Nothing else.
 *   Search · Browse  the tile's badge changes. Nothing else.
 *   Profile shelves  the tile's badge changes. Nothing else.
 *
 * So the same action reported differently depending on where it was done, which
 * is how one piece of furniture owned by two modules ends up meaning two
 * things. Any screen can raise one now; the shell decides where it sits and how
 * long it lives, and it already knew where — ui.css positions it above the tab
 * bar and clears the safe area.
 *
 * The component's own rule survives unchanged, because it is the right one:
 * "Breaking Bad · S2 E4 watched" is worth reading, "Saved" is not.
 */

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toast, setToast] = useState(null);

    const dismiss = useCallback(() => setToast(null), []);
    /* Identity matters: this goes into the dependency list of every hook that
       can report something, and a new function each render would restart their
       effects on every keystroke elsewhere in the tree. */
    const notify = useCallback((next) => setToast(next || null), []);

    const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <Toast
                message={toast?.message}
                actionLabel={toast?.actionLabel}
                onAction={() => { toast?.onAction?.(); dismiss(); }}
                onDismiss={dismiss}
            />
        </ToastContext.Provider>
    );
}

/** A screen outside the provider gets a no-op rather than a crash: reporting
 *  an action is never the reason a page should fail to render. */
export function useToast() {
    return useContext(ToastContext) || { notify: () => {}, dismiss: () => {} };
}
