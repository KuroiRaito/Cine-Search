import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../shared/auth/AuthProvider.jsx';
import { loadShelf, addFavourite, removeFavourite } from './shelves.js';

/**
 * The heart on a person's page.
 *
 * The People shelf lives in the profile module, so the rule for what goes on
 * it does too — the person page only has to draw a control and say when it was
 * pressed. Actors and crew share one shelf: a cinematographer and a lead actor
 * are both just people whose work you follow, and splitting them would mean
 * deciding what to do with somebody who is both.
 */
export function usePersonFavourite(person) {
    const { isSignedIn, authReady } = useAuth();
    const [on, setOn] = useState(false);
    const [known, setKnown] = useState(false);

    const ref = person?.id != null ? String(person.id) : null;

    useEffect(() => {
        if (!isSignedIn || !ref) { setKnown(authReady); return undefined; }
        let live = true;
        loadShelf('person')
            .then((rows) => { if (live) { setOn((rows || []).some((r) => r.ref === ref)); setKnown(true); } })
            .catch(() => live && setKnown(true));
        return () => { live = false; };
    }, [isSignedIn, authReady, ref]);

    const toggle = useCallback(async () => {
        if (!ref) return;
        const next = !on;
        setOn(next);   // optimistic; the control moves when it is pressed
        const write = next
            ? addFavourite({
                kind: 'person',
                ref,
                name: person.name,
                // "The role you know them for" — their own department, not the
                // job on whichever credit we happened to arrive from.
                subtitle: person.department || null,
                image_path: person.profilePath || null,
            })
            : removeFavourite('person', ref);
        await write.catch(() => setOn(!next));
    }, [on, ref, person]);

    return { on, known, canFavourite: isSignedIn, toggle };
}
