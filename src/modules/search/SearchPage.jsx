import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { search } from './lib/index.js';
import { fromItem } from '../../shared/tmdb/view.js';
import { useAsync } from '../../shared/hooks/useAsync.js';
import { Tile, Skeleton, Empty, ErrorBox, Icon, Chip, RemovableChip, Button} from '../../shared/ui/index.js';
import {
    discoverMovies, discoverTV, genres as fetchGenres, providerList,
} from '../../shared/tmdb/endpoints.js';
import FilterPanel from './FilterPanel.jsx';
import {
    fromParams, toParams, activeCount, toQuery, readCount, canLoadMore,
    reconcile, SORTS, KINDS, LENGTHS, RATINGS, genresFor, blame, blameTrials,
    providerName, rememberProviders, isBrowseUrl,
} from './browse.js';
import { useAuth } from '../../shared/auth/AuthProvider.jsx';
import { useLibrary } from '../library';
import { SignInPrompt } from '../entry';
import PeopleResults, { usePeopleSearch } from './PeopleResults.jsx';
import Presets from './Presets.jsx';
import { recentSearches, rememberSearch } from './recents.js';
import { destinationOf } from './destination.js';
import { findByImdb } from '../../shared/tmdb/endpoints.js';
import { useTileStates, useQuickAdd } from '../library';
import './search.css';

const DEBOUNCE_MS = 250;

export default function SearchPage() {
    // The query lives in the URL, so a search can be shared, bookmarked and
    // returned to with the back button.
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    const q = params.get('q') || '';
    /* FQ17. The year a paste carried, once the ladder has told us it was one.
       It lives on the URL rather than in state so the chip survives a reload
       and a shared link carries the same search — and so taking the chip off
       is one setParams rather than a second source of truth to keep level. */
    const yr = params.get('y') || '';
    const [draft, setDraft] = useState(q);
    const [open, setOpen] = useState(false);
    const [page, setPage] = useState(1);
    const { isSignedIn } = useAuth();
    const lib = useLibrary();

    /* L1 — a query and a facet never travel in the same request, because there
       is no endpoint that takes both. So the filter row is not one row: it is
       two that swap, and with text in the box the panel is not offered at all.
       Browse is /search with facets and no query. */
    const facets = fromParams(params);
    const browsing = !q.trim() && isBrowseUrl(params);
    /* What was taken off, and why. Held in state rather than derived, because
       the URL is corrected the moment a drop happens — so the fact of it would
       otherwise live for exactly one render, which is not long enough to read. */
    const [notice, setNotice] = useState(null);
    const setFacets = (next) => {
        setPage(1);
        setNotice(null);
        setParams(toParams(next, q ? { q } : {}), { replace: true });
    };
    const [prompt, setPrompt] = useState(null);
    const onAdd = useQuickAdd((x) => setPrompt({ title: x.title, poster: x.poster, action: 'save' }));
    const stateFor = useTileStates();

    useEffect(() => { setDraft(q); }, [q]);

    /* The genre vocabulary, fetched rather than typed: film and series share
       only eight of their entries and the ids move nothing but the names. */
    const vocab = useAsync(
        ({ signal }) => Promise.all([fetchGenres('movie', { signal }), fetchGenres('tv', { signal })])
            .then(([movie, tv]) => ({ movie, tv })),
        [],
    ).data || { movie: [], tv: [] };

    /* A browse can arrive by link with a provider nobody on this device has
       ever picked, and a chip reading "8" is not a filter anybody can decide to
       remove. One request, only when the name is missing. */
    useAsync(
        ({ signal }) => providerList(facets.kind === 'tv' ? 'tv' : 'movie', facets.region, { signal })
            .then(rememberProviders),
        [facets.provider, facets.region, facets.kind],
        { skip: !facets.provider || !facets.region || providerName(facets.provider) !== 'that service' },
    );

    /* FB3 / FB6 — a genre the current medium does not have is dropped and
       named. Silently mapping Thriller to Action & Adventure would invent an
       answer. */
    const { facets: live, dropped } = reconcile(facets, vocab);

    /* FB6 — a dropped facet comes off the URL too, once. Announcing the drop
       while leaving it in the address means a reload announces it again, and a
       shared link carries a constraint the chip row says is not there. */
    const drop = dropped[0]?.why || null;
    useEffect(() => {
        if (!drop) return;
        setNotice(drop);
        // `q ? { q } : {}` — an undefined value stringifies to the literal
        // "undefined", which then reads as a query and turns Browse off.
        setParams(toParams(live, q ? { q } : {}), { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [drop]);

    const browse = useAsync(
        ({ signal }) => {
            const media = live.kind === 'tv' ? 'tv' : 'movie';
            const call = media === 'tv' ? discoverTV : discoverMovies;
            /* discover returns the harness shape — media_type, poster_path,
               vote_count — and a Tile wants the view shape. Without this the
               grid draws posterless tiles linking to /title/undefined/123. */
            return call({ ...toQuery(live, media), page }, { signal })
                .then((r) => ({ ...r, results: (r.results || []).map(fromItem) }));
        },
        [JSON.stringify(live), page, browsing],
        { skip: !browsing },
    );

    useEffect(() => {
        const t = setTimeout(() => {
            if (draft === q) return;
            /* FQ18 — a link never becomes a query. It is about to be resolved
               into a route, and a URL in the `q` parameter would put a search
               nobody asked for into the history on the way past. */
            if (destinationOf(draft)) return;
            setParams(draft ? { q: draft } : {}, { replace: true });
        }, DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [draft, q, setParams]);

    // One request now carries both the titles and the people for a plain
    // query. `people` is null when the search fell back to v1 and carried none.
    const { data, error, loading, retry } = useAsync(
        ({ signal }) => search(q, yr ? { year: yr } : {}, { signal }).then((r) => ({
            titles: (r.results || []).map(fromItem),
            people: r.people ?? null,
            // At most one, ever. What the app decided the question was.
            interpretation: r.interpretation ?? null,
            /* Which rung answered, and with what. FQ17 reads it. */
            meta: r.meta ?? null,
        })),
        [q, yr],
        { skip: !q.trim() },
    );
    const titles = data?.titles;
    const said = data?.interpretation;

    /* Kept only when the search found something, and keyed to what the person
       typed rather than to whatever rung answered — tapping it re-runs their
       words, rescue and all. A recent that leads nowhere is not a way out, and
       the screen it would show on most is the one for a search that just
       failed. */
    const [recents, setRecents] = useState(recentSearches);
    useEffect(() => {
        if (!q.trim() || !data?.titles?.length) return;
        rememberSearch(q);
        setRecents(recentSearches());
    }, [data, q]);
    /* FQ18 — a pasted URL is a destination, not a search.

       TMDB's own link needs no request: the path carries the media type and the
       id, which are the two things the title route takes. IMDb's needs one
       lookup, because its ids are not TMDB's.

       `dead` is a third state and not the absence of a destination: a real
       IMDb id that TMDB has never catalogued has to say so, rather than sit on
       "Opening that link" for ever. */
    const dest = destinationOf(draft);
    const [dead, setDead] = useState(false);
    useEffect(() => {
        if (!dest) { setDead(false); return undefined; }
        let live = true;
        setDead(false);
        if (dest.kind === 'tmdb') {
            navigate(`/title/${dest.mediaType}/${dest.id}`, { replace: true });
            return undefined;
        }
        findByImdb(dest.imdbId)
            .then((r) => {
                if (!live) return;
                const movie = r?.movie_results?.[0];
                const tv = r?.tv_results?.[0];
                if (movie) navigate(`/title/movie/${movie.id}`, { replace: true });
                else if (tv) navigate(`/title/tv/${tv.id}`, { replace: true });
                else setDead(true);
            })
            .catch(() => { if (live) setDead(true); });
        return () => { live = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dest?.kind, dest?.mediaType, dest?.id, dest?.imdbId, navigate]);

    /* FQ17 — the paste becomes the search it was always asking for.
       `Inception (2010)` returned nothing; rung 1b finds the name and the year,
       and this moves both where a person can see and undo them: the name into
       the box, the year onto the URL as a chip. The box has to move too, or the
       debounce below sees draft ≠ q and types the parenthesis straight back.

       It costs one extra request — the rewritten URL re-runs a search whose
       answer we already have. Worth it: the path it is on currently returns
       zero results, and the alternative is a box and a URL that still say
       something the app has quietly stopped searching for. */
    const rescuedYear = data?.meta?.rung === '1b' ? data.meta.year : null;
    useEffect(() => {
        if (!rescuedYear || yr) return;
        setDraft(data.meta.query);
        setParams({ q: data.meta.query, y: String(rescuedYear) }, { replace: true });
    }, [rescuedYear, yr, data, setParams]);

    /* L2 — every rung that changed the name prints what it did and offers the
       original back in one tap. One line above the results: never a toast,
       which disappears, and never a dialog, which interrupts. */
    const keepOriginal = () => setParams({ q, exact: '1' }, { replace: true });
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

            {/* At rest: one control. The box, and a filter button beside it.
                No facet row, no chips, nothing to read. */}
            {!q.trim() && (
                <div className="pad">
                    <Button
                        variant="quiet"
                        className="filterbtn"

                        aria-expanded={open}
                        onClick={() => setOpen((v) => !v)}
                    >
                        <Icon name="filter" size={16} />
                        Filters
                        {/* The button carries the active count so a closed
                            panel never conceals a constraint. */}
                        {activeCount(live) > 0 && <em>{activeCount(live)}</em>}
                    </Button>
                </div>
            )}

            {!q.trim() && open && (
                <FilterPanel facets={live} vocab={vocab} onChange={setFacets} canHide={isSignedIn} />
            )}

            {/* The record. Always visible, each chip removable, nothing hidden
                — a hidden filter is a wrong answer with no visible cause. */}
            {browsing && (
                <ChipRow facets={live} vocab={vocab} notice={notice} onChange={setFacets} />
            )}

            {/* FQ17. Not a facet — L1 says a query and a facet never travel
                together, and this is a parameter on the query's own endpoint.
                Removable, because a filter nobody can undo is worse than one
                nobody asked for. */}
            {q.trim() && yr && (
                <div className="chips">
                    <RemovableChip
                        label={yr}
                        onRemove={() => setParams({ q }, { replace: true })}
                    />
                </div>
            )}

            {/* FQ18. Two states, because a link that resolves to nothing is
                not the same as one still resolving. */}
            {dest && !dead && (
                <Empty title="Opening that link…" body="Taking you to the title." />
            )}
            {dest && dead && (
                <Empty
                    title="That link points to nothing we can find"
                    body="The page exists, but it is not in the catalogue this app reads."
                    action={<Button onClick={() => setDraft('')}>Search instead</Button>}
                />
            )}

            {!q.trim() && !browsing && !dest && (
                <div className="nothing">
                    <WaysIn recents={recents} onPick={(r) => setParams({ q: r })} />
                </div>
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

            {said?.kind === 'correction' && (
                <p className="said">
                    Showing results for <b>{said.showing}</b>
                    <button type="button" className="said-undo" onClick={keepOriginal}>
                        search instead for “{said.original}”
                    </button>
                </p>
            )}

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
            {/* L3 — nothing found is a screen, not a sentence. It is the most
                common outcome in this module and it gets the most design, not
                the least. Each part is absent when it has nothing to give. */}
            {titles && titles.length === 0 && people.length === 0 && (
                <div className="nothing">
                    <h2>Nothing for “{q}”</h2>

                    {/* A guess asks. Rung 4 lands two of its four at rank 2,
                        behind a wrong answer, so it may not claim. */}
                    {said?.kind === 'guess' && (
                        <p className="said-ask">
                            Did you mean
                            <button type="button" className="said-undo" onClick={() => setParams({ q: said.guess })}>
                                {said.guess}
                            </button>?
                        </p>
                    )}

                    {/* The words parse as a kind of thing rather than a name. */}
                    {said?.kind === 'browse' && (
                        <p className="said-ask">
                            That reads like a kind of thing rather than a name.
                            <span className="saidchips">
                                {said.chips.map((c) => <Chip as="span" key={c.kind}>{c.label}</Chip>)}
                            </span>
                        </p>
                    )}

                    {/* The honest exit. We search names, not plots — said once,
                        plainly, rather than guessed at. */}
                    {said?.kind === 'nothing' && (
                        <p className="nothing-why">We search names, not plots.</p>
                    )}

                    <WaysIn recents={recents} onPick={(r) => setParams({ q: r })} />

                    <Button as={Link} variant="quiet" to="/">Browse instead</Button>
                </div>
            )}

            {browsing && <BrowseResults
                state={browse}
                facets={live}
                vocab={vocab}
                page={page}
                onPage={setPage}
                onSort={(sort) => setFacets({ ...live, sort })}
                lib={lib}
                onAdd={onAdd}
                stateFor={stateFor}
            />}

            {prompt && <SignInPrompt {...prompt} onClose={() => setPrompt(null)} />}
        </div>
    );
}

/**
 * The same offer in two places: what you searched before, and somewhere to
 * start if you have not.
 *
 * FQ0 — the resting state is recents then presets, and explicitly *not* "What
 * are you looking for?", which asks a question the person answered by
 * arriving. FQ11 — the nothing-found screen ends with the same two, because
 * what somebody needs after a dead end is a route back to something that
 * worked.
 *
 * One component rather than two copies: these are the same offer, and two
 * renderings of one offer is how they drift apart.
 */
function WaysIn({ recents, onPick }) {
    return (
        <>
            {recents.length > 0 && (
                <>
                    <p className="said-ask">Recent</p>
                    <div className="saidchips">
                        {recents.map((r) => (
                            <Chip key={r} onClick={() => onPick(r)}>{r}</Chip>
                        ))}
                    </div>
                </>
            )}
            <p className="said-ask">{recents.length ? 'Or start here' : 'Start here'}</p>
            <Presets />
        </>
    );
}

/* The few keywords a preset may carry, named so the chip can be read and
   removed. Not a vocabulary anybody picks from — §05 keeps keywords out of the
   facet set entirely. */
const KEYWORDS = { 156924: 'Tearjerker' };

const monthLabel = (f) => {
    if (!f.from || !f.to) return f.from ? `From ${f.from}` : `Until ${f.to}`;
    const d = new Date(`${f.from}T00:00:00`);
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
};

/** Everything currently constraining the list, each removable. */
function ChipRow({ facets, vocab, notice, onChange }) {
    const all = genresFor(facets.kind, vocab);
    const chips = [
        facets.kind !== 'all' && { key: 'kind', label: KINDS.find((k) => k.key === facets.kind)?.label, off: { kind: 'all' } },
        ...facets.genre.map((id) => ({
            key: `genre-${id}`,
            label: all.find((g) => g.id === id)?.name,
            off: { genre: facets.genre.filter((x) => x !== id) },
        })),
        facets.language && { key: 'lang', label: facets.language.toUpperCase(), off: { language: null } },
        facets.decade && { key: 'decade', label: `${facets.decade}s`, off: { decade: null } },
        /* A preset arrives with values the panel does not offer — 110 minutes,
           rated 6.5 — and every one of them still has to be a chip somebody can
           take off. That is the whole difference between a curated shelf and a
           starting point. */
        facets.length && { key: 'len', label: LENGTHS.find((l) => l.value === facets.length)?.label || `Under ${facets.length} min`, off: { length: null } },
        facets.rating && { key: 'rated', label: RATINGS.find((r) => r.value === facets.rating)?.label || `${facets.rating}+`, off: { rating: null } },
        facets.keyword && { key: 'kw', label: KEYWORDS[facets.keyword] || 'Tagged', off: { keyword: null } },
        facets.cert && { key: 'cert', label: 'Family-friendly', off: { cert: null } },
        (facets.from || facets.to) && { key: 'when', label: monthLabel(facets), off: { from: null, to: null } },
        facets.provider && { key: 'on', label: providerName(facets.provider), off: { provider: null } },
        facets.unseen && { key: 'unseen', label: 'Not seen', off: { unseen: false } },
    ].filter((c) => c && c.label);

    return (
        <>
            {notice && <p className="dropped">{notice}, so it came off.</p>}
            <div className="chips">
                {chips.map((c) => (
                    <RemovableChip
                        key={c.key}
                        label={c.label}
                        onRemove={() => onChange({ ...facets, ...c.off })}
                    />
                ))}
                {/* Past two, one control takes them all off. */}
                {chips.length > 2 && (
                    <Chip
                        onClick={() => onChange(chips.reduce((f, c) => ({ ...f, ...c.off }), facets))}
                    >Clear all</Chip>
                )}
            </div>
        </>
    );
}

/**
 * FB1 — chips, then a count line printing every constraint and the ordering,
 * then the grid. Every tile carries its vote count beside its score.
 */
/**
 * FB2 — empty because the chips exclude each other.
 *
 * Never a bare "no results". Each chip is dropped in turn and the one whose
 * removal yields the fewest results is the culprit: the rest of the browse was
 * nearly as narrow without it, so it is the constraint that did the excluding.
 *
 * Three or four count-only requests, fired exactly when somebody is already
 * looking at an empty screen — so it only runs when there is more than one chip
 * to blame, and it says the plain thing while it works rather than nothing.
 */
function WhyEmpty({ facets, vocab }) {
    const labels = {
        kind: KINDS.find((k) => k.key === facets.kind)?.label,
        genre: genresFor(facets.kind, vocab).filter((g) => facets.genre.includes(g.id)).map((g) => g.name).join(' or '),
        language: facets.language?.toUpperCase(),
        decade: facets.decade && `${facets.decade}s`,
        length: LENGTHS.find((l) => l.value === facets.length)?.label,
        rating: RATINGS.find((r) => r.value === facets.rating)?.label,
        provider: providerName(facets.provider),
    };
    const trials = blameTrials(facets, labels);

    const { data } = useAsync(
        async ({ signal }) => {
            const media = facets.kind === 'tv' ? 'tv' : 'movie';
            const call = media === 'tv' ? discoverTV : discoverMovies;
            const counted = [];
            for (const t of trials) {
                const r = await call({ ...toQuery(t.facets, media), page: 1 }, { signal });
                counted.push({ chip: t.chip, count: r.totalResults });
            }
            return blame(counted);
        },
        [JSON.stringify(facets)],
        { skip: trials.length < 2 },
    );

    return (
        <Empty
            title="Nothing matches all of those"
            body={data
                ? `${data.chip} is the one doing it — without it there are ${readCount(data.count)}.`
                : 'Take a filter off to widen it.'}
        />
    );
}

function BrowseResults({ state, facets, vocab, page, onPage, onSort, lib, onAdd, stateFor }) {
    const { data, error, loading, retry } = state;
    if (error) return <ErrorBox what="this browse" onRetry={retry} />;

    const rows = data?.results || [];
    /* FB16 — applied against the library in memory, so it is exact. But it
       filters what arrived, so the count says both: a page that silently
       returns twelve tiles looks broken. */
    const shown = facets.unseen
        ? rows.filter((r) => lib.entryFor(r.mediaType, r.id)?.status !== 'watched')
        : rows;
    const hidden = rows.length - shown.length;

    return (
        <>
            <div className="bbar">
                <span>
                    {loading && !data ? 'Counting…' : `${readCount(data?.totalResults || 0)} ${facets.kind === 'tv' ? 'series' : 'films'}`}
                    {hidden > 0 && ` · ${shown.length} of ${rows.length} shown · ${hidden} already watched`}
                </span>
                {/* Not a filter — it changes order, not membership — so it does
                    not live in the panel. FB9: a re-sort goes back to page one. */}
                <select
                    className="bsort"
                    value={facets.sort}
                    aria-label="Sort"
                    onChange={(e) => { onPage(1); onSort(e.target.value); window.scrollTo(0, 0); }}
                >
                    {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
            </div>

            <div className="grid results">
                {shown.map((it) => (
                    <Tile key={`${it.mediaType}-${it.id}`} item={it} onAdd={onAdd} state={stateFor(it)} votes />
                ))}
            </div>

            {loading && <div className="pad"><Skeleton h={40} /></div>}

            {data && !rows.length && <WhyEmpty facets={facets} vocab={vocab} />}

            {/* FB5 — Load more retires at TMDB's own last page. Not an error. */}
            {data && rows.length > 0 && (
                canLoadMore(page, data.totalPages)
                    ? <div className="pad"><Button variant="quiet" onClick={() => onPage(page + 1)}>Load more</Button></div>
                    : page >= 500 && <p className="dropped">That is as deep as TMDB goes — narrow it.</p>
            )}
        </>
    );
}
