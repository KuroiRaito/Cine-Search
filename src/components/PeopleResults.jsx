import { useEffect, useState } from 'react';
import { PersonRow } from '../shared/ui/index.js';
import { useAuth } from '../shared/auth/AuthProvider.jsx';
import { useLibrary } from '../context/LibraryProvider.jsx';
import { searchPerson, person as fetchPerson } from '../shared/tmdb/endpoints.js';
import { toPersonView, profileUrl, roleForJob } from '../shared/tmdb/view.js';
import {
    collectionProgress, totalsFromView, totalsAreFresh, personTotalsGet, personTotalsSet,
    creditsForPeople, isSeen,
} from '../lib/library.js';

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
/**
 * `provided` is the people list that arrived with the titles when the search
 * ran through /search/multi — one request instead of three. Only when it is
 * absent (a filtered search fell back to v1) is /search/person asked.
 */
export function usePeopleSearch(query, provided) {
    const [people, setPeople] = useState([]);

    useEffect(() => {
        if (!query.trim()) { setPeople([]); return undefined; }
        if (provided === undefined) return undefined;          // search still running
        if (Array.isArray(provided)) {
            setPeople(provided.filter(plausible).slice(0, MAX));
            return undefined;
        }
        const controller = new AbortController();               // v1 fallback: ask
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
    }, [query, provided]);

    return people;
}

export default function PeopleResults({ people }) {
    const cached = useCachedTotals(people);
    if (!people.length) return null;

    return (
        <div className="sect pad">
            <div className="sect-h"><span>People</span></div>
            {people.map((p) => (
                <PersonResult
                    key={p.id}
                    person={p}
                    // undefined = not looked up yet (wait); null = looked up, no
                    // row (ask TMDB). Conflating the two meant a person absent
                    // from the catalogue was never asked for at all.
                    cached={cached ? (cached.totals[p.id] ?? null) : undefined}
                    credits={cached?.credits?.filter((c) => c.person_id === p.id)}
                />
            ))}
        </div>
    );
}

/**
 * One read for every row at once. `undefined` until it answers for THESE ids,
 * so a row can tell "not looked up yet" from "looked up, nothing there" and
 * not fetch from TMDB in the gap.
 *
 * The answer is tagged with the ids it was for. Without that, the moment a new
 * list of people arrived, the previous answer was still in state for one
 * render — every row saw "no cached row" and asked TMDB before the real lookup
 * had a chance to land. Three needless requests on every search, from a race
 * that only shows up with a network fast enough to lose it.
 */
function useCachedTotals(people) {
    const [answer, setAnswer] = useState(null);
    const ids = people.map((p) => p.id).join(',');
    useEffect(() => {
        let live = true;
        if (!ids) { setAnswer({ ids, totals: {}, credits: [] }); return undefined; }
        const list = ids.split(',').map(Number);
        Promise.all([personTotalsGet(list), creditsForPeople(list)])
            .then(([totals, credits]) => { if (live) setAnswer({ ids, totals, credits }); })
            .catch(() => { if (live) setAnswer({ ids, totals: {}, credits: [] }); });
        return () => { live = false; };
    }, [ids]);
    return answer && answer.ids === ids ? answer : undefined;
}

function PersonResult({ person, cached, credits }) {
    const { isSignedIn } = useAuth();
    const lib = useLibrary();
    const [role, setRole] = useState(null);

    // The role is worth naming to anyone — it is the count that needs an
    // account, not the word. Reading "Sound" here and "Composer" everywhere else
    // was TMDB's department taxonomy leaking through one branch, and mapping one
    // to the other would have been a guess: "Sound" is also where TMDB files
    // boom operators.
    //
    // Lookup order: the catalogue's cached totals first, which costs no TMDB
    // request; TMDB only when the cache has nothing fresh, and then the answer
    // is stored for next time. The cache is awaited before TMDB is asked, or it
    // would never get the chance to save anything.
    useEffect(() => {
        if (cached === undefined) return undefined;
        const controller = new AbortController();
        let live = true;

        const fromCache = totalsAreFresh(cached) && largestRole(cached.credit_totals);
        if (fromCache) { setRole(fromCache); return undefined; }

        fetchPerson(person.id, { signal: controller.signal })
            .then((raw) => {
                const view = toPersonView(raw);
                if (!live) return;
                setRole(view.roles[0] ?? null);
                if (isSignedIn && view.roles.length) {
                    personTotalsSet({
                        id: person.id, name: person.name,
                        profilePath: person.profile_path, totals: totalsFromView(view),
                    });
                }
            })
            // The row is worth having without the count; the count is not worth
            // holding the row for.
            .catch(() => {});

        return () => { live = false; controller.abort(); };
    }, [person.id, person.name, person.profile_path, cached, isSignedIn]);

    // A guest has no library, so there is nothing to be "0 of 131" of.
    //
    // A role from the cache has a count but no items. What has been seen is
    // then counted from the stored credits — the same numerator the You screen
    // computes in SQL, so the two screens agree by construction.
    let progress = null;
    if (isSignedIn && role) {
        progress = role.items
            ? collectionProgress(role, lib.entryFor)
            : {
                seen: (credits || []).filter((c) => roleForJob(c.role, c.job)?.key === role.key
                    && isSeen(lib.entryFor(c.media_type, c.tmdb_id))).length,
                total: role.count,
            };
    }

    // The department is the fallback while the credits are in flight, or if
    // they never arrive — not the guest's answer.
    const sub = role
        ? [role.label, progress && `${progress.seen} of ${progress.total} seen`]
            .filter(Boolean).join(' · ')
        : person.known_for_department;

    return (
        <PersonRow
            person={{
                id: person.id,
                name: person.name,
                photo: profileUrl(person.profile_path),
            }}
            sub={sub}
        />
    );
}

/** The role a person is most known for, in the shape the cache stores. */
function largestRole(totals) {
    const entries = Object.entries(totals || {});
    if (!entries.length) return null;
    const [key, t] = entries.sort((a, b) => b[1].count - a[1].count)[0];
    return { key, label: t.label, verb: t.verb, count: t.count, items: null };
}
