import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { search } from './lib/index.js';
import { fromItem } from '../../shared/tmdb/view.js';
import { useAsync } from '../../shared/hooks/useAsync.js';
import { Tile, Skeleton, Empty, ErrorBox } from '../../shared/ui/index.js';
import { SignInPrompt } from '../entry';
import PeopleResults, { usePeopleSearch } from './PeopleResults.jsx';
import { useTileStates, useQuickAdd } from '../library';
import './search.css';

const DEBOUNCE_MS = 250;

export default function SearchPage() {
    // The query lives in the URL, so a search can be shared, bookmarked and
    // returned to with the back button.
    const [params, setParams] = useSearchParams();
    const q = params.get('q') || '';
    const [draft, setDraft] = useState(q);
    const [prompt, setPrompt] = useState(null);
    const onAdd = useQuickAdd((x) => setPrompt({ title: x.title, poster: x.poster, action: 'save' }));
    const stateFor = useTileStates();

    useEffect(() => { setDraft(q); }, [q]);

    useEffect(() => {
        const t = setTimeout(() => {
            if (draft === q) return;
            setParams(draft ? { q: draft } : {}, { replace: true });
        }, DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [draft, q, setParams]);

    // One request now carries both the titles and the people for a plain
    // query. `people` is null when the search fell back to v1 and carried none.
    const { data, error, loading, retry } = useAsync(
        ({ signal }) => search(q, {}, { signal }).then((r) => ({
            titles: (r.results || []).map(fromItem),
            people: r.people ?? null,
        })),
        [q],
        { skip: !q.trim() },
    );
    const titles = data?.titles;
    // After the fetch it reads from — hooks do not get to be conditional, and
    // `data` does not exist above this line.
    // Three states, kept apart on purpose: undefined = the search has not
    // answered yet, so wait; an array = it brought the people, use them;
    // null = it was a v1 fallback with none, so ask /search/person.
    const people = usePeopleSearch(q, data ? data.people : undefined);

    return (
        <div className="page">
            <div className="page-head"><h1>Search</h1></div>

            <div className="pad searchbox-wrap">
                <input
                    className="searchbox"
                    type="search"
                    value={draft}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Films, series, people"
                    aria-label="Search films and series"
                />
            </div>

            {!q.trim() && (
                <Empty
                    title="What are you looking for?"
                    body="Search by title, or by the person who made it."
                />
            )}

            {loading && (
                <div className="grid results">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                        <div className="tile" key={i}>
                            <Skeleton h={150} className="skel-poster" />
                            <Skeleton h={11} w="85%" />
                        </div>
                    ))}
                </div>
            )}

            {error && <ErrorBox what="these results" onRetry={retry} />}

            {titles && titles.length > 0 && (
                <div className="grid results">
                    {titles.map((it) => (
                        <Tile
                            key={`${it.mediaType}-${it.id}`}
                            item={it}
                            onAdd={onAdd}
                            state={stateFor(it)}
                        />
                    ))}
                </div>
            )}

            {/* After the titles, never above them — and still there when the
                title search is the half that failed. Errors are scoped to the
                section that failed, which cuts both ways. */}
            {(data || error) && <PeopleResults people={people} />}

            {/* A search that found a person found something. Saying "nothing
                for Villeneuve" above his own row would be a strange thing to
                read. */}
            {titles && titles.length === 0 && people.length === 0 && (
                <Empty
                    title={`Nothing for “${q}”`}
                    body="Check the spelling, or try fewer words."
                    action={<Link className="btn quiet" to="/">Browse instead</Link>}
                />
            )}

            {prompt && <SignInPrompt {...prompt} onClose={() => setPrompt(null)} />}
        </div>
    );
}
