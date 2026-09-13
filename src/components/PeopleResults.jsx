import { useEffect, useState } from 'react';
import { PersonRow } from './ui.jsx';
import { useAuth } from '../context/AuthProvider.jsx';
import { useLibrary } from '../context/LibraryProvider.jsx';
import { searchPerson, person as fetchPerson } from '../lib/tmdb/endpoints.js';
import { toPersonView, profileUrl } from '../lib/tmdb/view.js';
import { collectionProgress } from '../lib/library.js';

/**
 * Whether a search result plausibly names someone.
 *
 * TMDB will find a person for almost any string: "dune" returns Aggy Dune and
 * Nea Dune, and "the matrix" returns a boxer. Both signals below are proxies for
 * "someone might actually be looking for this person", and neither is
 * sufficient alone — the boxer has a photo, and one of the Dunes has a pulse of
 * popularity. Together they pass Denis Villeneuve and both Zimmers and reject
 * every one of the others.
 */
const plausible = (p) => (p.popularity || 0) >= 1 && Boolean(p.profile_path);

const MAX = 3;

/**
 * People rank alongside titles, never above them: this sits after the grid, and
 * renders nothing at all when the query was about a film.
 *
 * The row carries collection progress — "Director · 6 of 10 seen" — which is
 * the whole wedge, surfaced at the first possible moment. That number needs the
 * person's full credits, so it arrives after the row has painted rather than
 * holding up a search.
 */
export function usePeopleSearch(query) {
    const [people, setPeople] = useState([]);

    useEffect(() => {
        if (!query.trim()) { setPeople([]); return undefined; }
        const controller = new AbortController();
        let live = true;

        // One retry. TMDB's person search has timed out and 502'd repeatedly,
        // and a transient failure here is indistinguishable on screen from
        // "no such person" — which is a wrong answer rather than a missing one.
        (async () => {
            for (let attempt = 0; attempt < 2; attempt += 1) {
                try {
                    const rows = await searchPerson(query, { signal: controller.signal });
                    if (live) setPeople((rows || []).filter(plausible).slice(0, MAX));
                    return;
                } catch (err) {
                    if (!live || err?.name === 'AbortError') return;
                    await new Promise((r) => { setTimeout(r, 600); });
                }
            }
            // Still nothing. The section is supplementary — a search that found
            // titles is not broken because it could not also find a face.
            if (live) setPeople([]);
        })();

        return () => { live = false; controller.abort(); };
    }, [query]);

    return people;
}

export default function PeopleResults({ people }) {
    if (!people.length) return null;

    return (
        <div className="sect pad" style={{ marginTop: 'var(--s6)' }}>
            <div className="sect-h"><span>People</span></div>
            {people.map((p) => <PersonResult key={p.id} person={p} />)}
        </div>
    );
}

function PersonResult({ person }) {
    const { isSignedIn } = useAuth();
    const lib = useLibrary();
    const [role, setRole] = useState(null);

    useEffect(() => {
        if (!isSignedIn) return undefined;
        const controller = new AbortController();
        let live = true;

        fetchPerson(person.id, { signal: controller.signal })
            .then((raw) => { if (live) setRole(toPersonView(raw).roles[0] ?? null); })
            // The row is worth having without the count; the count is not worth
            // holding the row for.
            .catch(() => {});

        return () => { live = false; controller.abort(); };
    }, [person.id, isSignedIn]);

    const progress = role && collectionProgress(role, lib.entryFor);

    return (
        <PersonRow
            person={{
                id: person.id,
                name: person.name,
                photo: profileUrl(person.profile_path),
            }}
            sub={progress
                ? `${role.label} · ${progress.seen} of ${progress.total} seen`
                : person.known_for_department}
        />
    );
}
