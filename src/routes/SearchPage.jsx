import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { search } from '../lib/search/index.js';
import { fromItem } from '../lib/tmdb/view.js';
import { useAsync } from '../hooks/useAsync.js';
import { Tile, Skeleton, Empty, ErrorBox } from '../components/ui.jsx';

const DEBOUNCE_MS = 250;

export default function SearchPage() {
    // The query lives in the URL, so a search can be shared, bookmarked and
    // returned to with the back button.
    const [params, setParams] = useSearchParams();
    const q = params.get('q') || '';
    const [draft, setDraft] = useState(q);

    useEffect(() => { setDraft(q); }, [q]);

    useEffect(() => {
        const t = setTimeout(() => {
            if (draft === q) return;
            setParams(draft ? { q: draft } : {}, { replace: true });
        }, DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [draft, q, setParams]);

    const { data, error, loading, retry } = useAsync(
        ({ signal }) => search(q, {}, { signal }).then((r) => (r.results || []).map(fromItem)),
        [q],
        { skip: !q.trim() },
    );

    return (
        <div className="page">
            <div className="page-head"><h1>Search</h1></div>

            <div className="pad" style={{ marginTop: 12 }}>
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
                <div className="grid" style={{ marginTop: 16 }}>
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                        <div className="tile" key={i}>
                            <Skeleton h={150} style={{ borderRadius: 8, marginBottom: 5 }} />
                            <Skeleton h={11} w="85%" />
                        </div>
                    ))}
                </div>
            )}

            {error && <ErrorBox what="these results" onRetry={retry} />}

            {data && data.length > 0 && (
                <div className="grid" style={{ marginTop: 16 }}>
                    {data.map((it) => <Tile key={`${it.mediaType}-${it.id}`} item={it} />)}
                </div>
            )}

            {data && data.length === 0 && (
                <Empty
                    title={`Nothing for “${q}”`}
                    body="Check the spelling, or try fewer words."
                    action={<Link className="btn quiet" to="/">Browse instead</Link>}
                />
            )}

        </div>
    );
}
