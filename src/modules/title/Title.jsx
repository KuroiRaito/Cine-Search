import { useState, useCallback, useEffect, useRef } from 'react';
import './title.css';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { titleFull, season as fetchSeason } from '../../shared/tmdb/endpoints.js';
import { toTitleView, toSeasonView, compactCount } from '../../shared/tmdb/view.js';
import { useAsync } from '../../shared/hooks/useAsync.js';
import { useRegion } from '../../shared/hooks/useRegion.js';
import { Poster, Tile, PersonRow, ErrorBox, Empty, Toast, initialsOf } from '../../shared/ui/index.js';
import { TitleSkeleton } from './TitleSkeleton.jsx';
import SignInPrompt from '../../components/SignInPrompt.jsx';
import Editor from '../../components/Editor.jsx';
import { useAuth } from '../../shared/auth/AuthProvider.jsx';
import { useLibrary, useTileStates, useQuickAdd } from '../../context/LibraryProvider.jsx';
import {
    statusMeta, statusTone, episodesWatched, isWatched, runningOrder, nextUnwatched,
    rememberSeasonRuntime,
} from '../../lib/library.js';

const displayName = (type, code) => {
    if (!code) return null;
    try { return new Intl.DisplayNames(['en'], { type }).of(code) || code; }
    catch { return code; }
};
const countryName = (c) => displayName('region', c) || c;
const languageName = (c) => displayName('language', c);

/**
 * One of the four preview cards. Always these four, always this order — a card
 * with no data says so rather than vanishing, because a layout that reshuffles
 * from title to title is worse than an empty box.
 */
function PreviewCard({ label, summary, faces, open, onToggle, children }) {
    return (
        <div className={`pc${open ? ' open' : ''}`}>
            {/* The whole summary is the target, not just the chevron — the
                design puts the pointer on the card for a reason. */}
            <button type="button" className="pc-top" onClick={onToggle} aria-expanded={open}>
                <span className="pc-h">
                    <b>{label}</b>
                    <i aria-hidden="true">{open ? '⌃' : '⌄'}</i>
                </span>
                {faces}
                <span className="ptx">{summary}</span>
            </button>
            {open && children && <div className="pc-body">{children}</div>}
        </div>
    );
}

export default function Title() {
    const { mediaType, id } = useParams();
    const navigate = useNavigate();
    const { region } = useRegion();
    const [expanded, setExpanded] = useState(false);
    const [openCard, setOpenCard] = useState(null);
    const [prompt, setPrompt] = useState(null);
    const [editing, setEditing] = useState(false);
    const [toast, setToast] = useState(null);
    const dismissToast = useCallback(() => setToast(null), []);
    const { isSignedIn } = useAuth();
    const lib = useLibrary();
    const stateFor = useTileStates();
    const quickAdd = useQuickAdd((item) => setPrompt({ title: item.title, poster: item.poster, action: 'save' }));

    const valid = mediaType === 'movie' || mediaType === 'tv';

    const { data, error, loading, retry } = useAsync(
        ({ signal }) => titleFull(id, mediaType, { signal }).then((raw) => toTitleView(raw, mediaType, region)),
        [id, mediaType, region],
        { skip: !valid },
    );

    if (!valid) {
        return <Empty title="Not found" body="That isn’t a kind of thing we have."
            action={<Link className="btn" to="/">Go to Discover</Link>} />;
    }
    if (loading) return <TitleSkeleton />;

    if (error) {
        const gone = error?.status === 404;
        return (
            <Empty
                title={gone ? 'We couldn’t find that title' : 'Something went wrong'}
                body={gone ? 'It may have been removed from TMDB, or the link may be wrong.' : 'The Movie Database didn’t answer.'}
                action={gone
                    ? <Link className="btn" to="/">Go to Discover</Link>
                    : <button type="button" className="btn" onClick={retry}>Try again</button>}
            />
        );
    }

    const t = data;
    const isTV = t.mediaType === 'tv';
    const entry = lib.entryFor(t.mediaType, t.id);
    const saved = Boolean(entry);
    const state = entry ? statusMeta(entry.status) : null;

    // A guest still sees every control. Hiding them would hide the product from
    // exactly the people who haven't seen it yet — so they raise the sign-in
    // sheet instead, naming the thing that was being reached for.
    const ask = (action) => setPrompt({ title: t.title, poster: t.poster, action });
    // The verb follows the control, not the page. A guest tapping the heart was
    // being asked "Track this series?" — the same mismatch the sign-in sheet was
    // built to avoid, reintroduced by a single default.
    const gate = (verb, fn) => (isSignedIn ? fn() : ask(verb));
    const primaryVerb = isTV ? 'track' : 'want';

    const order = isTV ? runningOrder(t.seasons, t.airedEpisodes) : [];
    const seen = episodesWatched(entry?.watched_episodes);

    const quickSave = async () => {
        const ok = await lib.save(t, { status: 'want_to_watch' });
        if (ok) setToast({ message: `${t.title} · want to watch` });
    };

    /** Ticking is its own undo — tapping a ticked episode un-ticks it. */
    const tickEpisode = async (season, number, on) => {
        const list = new Set(entry?.watched_episodes?.[String(season)] ?? []);
        if (on) list.add(number); else list.delete(number);
        const ok = await lib.setEpisodes(t, season, [...list]);
        if (!ok || !on) return;

        // "Marking the final episode prompts 'Mark series as watched?' — it
        // proposes, never assumes, because unaired seasons exist."
        const after = { ...(entry?.watched_episodes ?? {}), [String(season)]: [...list] };
        const done = !nextUnwatched(order, after);
        if (done && entry?.status !== 'watched') {
            setToast({
                message: 'That was the last aired episode.',
                actionLabel: 'Mark watched',
                onAction: () => lib.save(t, { status: 'watched' }),
            });
        } else {
            setToast({ message: `${t.title} · S${season} E${number} watched` });
        }
    };

    /** Per season, never per series — a whole-series action is too destructive
        for a single tap. */
    const markSeason = async (season, numbers, on) => {
        const ok = await lib.setEpisodes(t, season, on ? numbers : []);
        if (ok) setToast({ message: on ? `Season ${season} marked watched` : `Season ${season} cleared` });
    };
    const toggle = (key) => setOpenCard((c) => (c === key ? null : key));
    const makers = t.crew.filter((c) => c.job === 'Director' || c.job === 'Creator');
    const lang = languageName(t.originalLanguage);

    const meta = [t.year, t.genres.join(', '), t.runtime,
        isTV && `${t.seasonCount} season${t.seasonCount === 1 ? '' : 's'}`].filter(Boolean).join(' · ');

    // Every control a guest can reach raises the sign-in sheet. They stay
    // visible rather than hidden: concealing them would hide the product from
    // exactly the people who haven't seen it yet.
    const actions = (
        <>
            <div className={`arow ${statusTone(entry?.status)}`}>
                {/* One button, two jobs: it invites while there is nothing to
                    report, and reports once there is. Tapping a saved title
                    opens the editor rather than toggling anything — a status is
                    not a thing that has an opposite. */}
                <button
                    type="button"
                    className={`spill${saved ? ' set' : ''}`}
                    onClick={() => gate(saved ? 'edit' : primaryVerb, () => (saved ? setEditing(true) : quickSave()))}
                >
                    {saved
                        ? <>{state?.icon} {state?.label} <span className="caret" aria-hidden="true">▾</span></>
                        : (isTV ? 'Track this series' : '+ Want to watch')}
                </button>
                <button
                    type="button"
                    className={`ibtn like${entry?.is_favourite ? ' on' : ''}`}
                    aria-pressed={isSignedIn ? Boolean(entry?.is_favourite) : undefined}
                    aria-label={entry?.is_favourite ? 'Remove from favourites' : 'Mark as favourite'}
                    onClick={() => gate('like', () => lib.save(t, { favourite: !entry?.is_favourite }))}
                >♥</button>
                <button
                    type="button"
                    className="ibtn"
                    aria-label="Edit"
                    onClick={() => gate('edit', () => setEditing(true))}
                >✎</button>
            </div>

            {/* Episodes, never seasons: "3 of 5 seasons" hides that season three
                is twenty-two episodes long. */}
            {isTV && saved && order.length > 0 && (
                <div className="prg">
                    <div className="prg-h">
                        <span>Progress</span>
                        <b>{seen} of {order.length}</b>
                    </div>
                    <div className="prg-bar">
                        <i style={{ width: `${Math.round((seen / order.length) * 100)}%` }} />
                    </div>
                </div>
            )}

            <div className="prov">
                <div className="prov-l">Where to watch · {countryName(t.providers.region)}</div>
                {t.providers.any ? (
                    <div className="provrow">
                        {[...t.providers.flatrate, ...t.providers.rent, ...t.providers.buy]
                            .filter((p, i, all) => all.findIndex((x) => x.id === p.id) === i)
                            .slice(0, 6)
                            .map((p) => (
                                <span className="pchip" key={p.id}>
                                    {p.logo && <img className="plogo" src={p.logo} alt="" loading="lazy" />}{p.name}
                                </span>
                            ))}
                    </div>
                ) : (
                    <p className="prov-none">
                        Not available in {countryName(t.providers.region)}.
                        {t.providers.link && <> <a href={t.providers.link} target="_blank" rel="noreferrer noopener">See options</a></>}
                    </p>
                )}
            </div>

            {makers.length > 0 && (
                <div className="prov">
                    <div className="prov-l">{isTV ? 'Created by' : 'Directed by'}</div>
                    {makers.slice(0, 2).map((p) => <PersonRow key={`${p.id}-${p.job}`} person={p} sub={p.job} />)}
                </div>
            )}
        </>
    );

    const cards = (
        <div className="cards">
            <PreviewCard
                label="Cast"
                open={openCard === 'cast'}
                onToggle={() => toggle('cast')}
                faces={t.cast.length > 0 && (
                    <span className="faces">
                        {t.cast.slice(0, 3).map((p) => (
                            <span className="face" key={p.id}>
                                {p.photo ? <img src={p.photo} alt="" loading="lazy" /> : initialsOf(p.name)}
                            </span>
                        ))}
                    </span>
                )}
                summary={t.cast.length
                    ? <>{t.cast.slice(0, 2).map((p) => p.name).join(', ')}
                        {t.cast.length > 2 && <><br />+{t.cast.length - 2} more</>}</>
                    : 'No cast listed'}
            >
                {t.cast.map((p) => <PersonRow key={p.id} person={p} sub={p.character} />)}
            </PreviewCard>

            <PreviewCard
                label="Crew"
                open={openCard === 'crew'}
                onToggle={() => toggle('crew')}
                summary={t.crew.length
                    ? <>{t.crew[0].name}<br />{t.crew[0].job}</>
                    : 'No crew listed'}
            >
                {t.crew.map((p) => <PersonRow key={`${p.id}-${p.job}`} person={p} sub={p.job} />)}
            </PreviewCard>

            <PreviewCard
                label="Themes"
                open={openCard === 'themes'}
                onToggle={() => toggle('themes')}
                summary={t.keywords.length
                    ? <>{t.keywords.slice(0, 2).map((k) => k.name).join(', ')}
                        {t.keywords.length > 2 && <><br />+{t.keywords.length - 2} more</>}</>
                    : 'None recorded'}
            >
                <div className="keywords">
                    {t.keywords.map((k) => <span className="kw" key={k.id}>{k.name}</span>)}
                </div>
            </PreviewCard>

            <PreviewCard
                label="Details"
                open={openCard === 'details'}
                onToggle={() => toggle('details')}
                summary={<>
                    {t.certification || `No ${t.providers.region} certificate`}
                    <br />{[lang, isTV ? `${t.episodeCount} episodes` : t.runtime].filter(Boolean).join(', ')}
                </>}
            >
                <dl className="facts">
                    <div><dt>Released</dt><dd>{t.year || 'Unknown'}</dd></div>
                    {t.runtime && <div><dt>Runtime</dt><dd>{t.runtime}</dd></div>}
                    {isTV && <div><dt>Episodes</dt><dd>{t.airedEpisodes} aired of {t.episodeCount}</dd></div>}
                    <div><dt>Certificate</dt><dd>{t.certification || `Not rated in ${countryName(t.providers.region)}`}</dd></div>
                    <div><dt>Language</dt><dd>{lang || 'Unknown'}</dd></div>
                    {t.originalTitle && t.originalTitle !== t.title && (
                        <div><dt>Original title</dt><dd>{t.originalTitle}</dd></div>
                    )}
                    {t.status && <div><dt>Status</dt><dd>{t.status}</dd></div>}
                </dl>
            </PreviewCard>
        </div>
    );

    return (
        <div className="page">
            <div className="hero">
                {t.backdrop && <img src={t.backdrop} alt="" fetchPriority="high" />}
                <div className="hero-nav">
                    <button type="button" className="circ on-image" onClick={() => navigate(-1)} aria-label="Back">‹</button>
                </div>
            </div>

            <div className="tgrid">
                <div className="tposter">
                    <Poster src={t.poster} path={t.posterPath} sizes="(min-width: 1100px) 210px, 82px"
                        title={t.title} eager />
                </div>

                <div className="thead">
                    <h1>{t.title}</h1>
                    <div className="metaline">
                        {t.certification && <span className="cert">{t.certification}</span>}{meta}
                    </div>
                    {t.tagline && <p className="tagline">“{t.tagline}”</p>}
                </div>

                <div className="tbody">
                    <div className="tside-inline">{actions}</div>

                    <div className="scores">
                        <div className="s gold">
                            <b>{t.voteAverage || '—'}</b>
                            <span>TMDB · {compactCount(t.voteCount)}</span>
                        </div>
                        {/* Never merged with TMDB's. The disagreement is the
                            interesting number. */}
                        <div className={`s${entry?.rating != null ? ' gold' : ' dim'}`}>
                            <b>{entry?.rating ?? '—'}</b>
                            <span className="lbl-short">Yours</span>
                            <span className="lbl-long">Your score</span>
                        </div>
                        <div className={`s${entry?.rewatch_count ? '' : ' dim'}`}>
                            <b>{entry?.rewatch_count || '—'}</b>
                            <span>Rewatches</span>
                        </div>
                    </div>

                    {t.overview && (
                        <div className="sect">
                            <div className="sect-h"><span>Overview</span></div>
                            <p className={`ov${expanded ? '' : ' clamped'}`}>{t.overview}</p>
                            <button type="button" className="more" onClick={() => setExpanded((v) => !v)}>
                                {expanded ? 'Less' : 'More'}
                            </button>
                        </div>
                    )}

                    {cards}

                    {isTV && (
                        <Episodes
                            title={t}
                            entry={entry}
                            onTick={tickEpisode}
                            onMarkSeason={markSeason}
                        />
                    )}

                    {t.related.length > 0 && (
                        <div className="sect">
                            <div className="sect-h"><span>More like this</span></div>
                            <div className="rail related">
                                {t.related.map((it) => (
                                    <Tile key={`${it.mediaType}-${it.id}`} item={it} onAdd={quickAdd} state={stateFor(it)} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <aside className="tside">{actions}</aside>
            </div>

            {prompt && <SignInPrompt {...prompt} onClose={() => setPrompt(null)} />}
            {editing && <Editor title={t} onClose={() => setEditing(false)} />}
            <Toast
                message={toast?.message}
                actionLabel={toast?.actionLabel}
                onAction={() => { toast?.onAction?.(); setToast(null); }}
                onDismiss={dismissToast}
            />
        </div>
    );
}

function Episodes({ title, entry, onTick, onMarkSeason }) {
    const { isSignedIn } = useAuth();
    const [prompt, setPrompt] = useState(null);
    const tabs = [...title.seasons, ...(title.specials ? [title.specials] : [])];
    const [active, setActive] = useState(tabs[0]?.season_number ?? 1);

    const load = useCallback(
        ({ signal }) => fetchSeason(title.id, active, { signal }).then(toSeasonView),
        [title.id, active],
    );
    const { data, error, loading, retry } = useAsync(load, [title.id, active]);

    // Once per season per session: the update fills a blank and never overwrites,
    // so repeating it would only cost a round trip.
    const recorded = useRef(new Set());
    useEffect(() => {
        if (!isSignedIn || !data?.episodes?.length) return;
        const key = `${title.id}-${active}`;
        if (recorded.current.has(key)) return;
        recorded.current.add(key);
        rememberSeasonRuntime(title.id, active, data.episodes);
    }, [isSignedIn, data, title.id, active]);

    if (!tabs.length) return null;

    const watched = entry?.watched_episodes;
    const aired = (data?.episodes || []).filter((e) => e.aired);
    const allSeen = aired.length > 0 && aired.every((e) => isWatched(watched, active, e.number));
    const seenHere = aired.filter((e) => isWatched(watched, active, e.number)).length;

    const tick = (e, on) => {
        if (!isSignedIn) {
            setPrompt({ title: title.title, poster: title.poster, action: 'watched' });
            return;
        }
        onTick(active, e.number, on);
    };

    const markAll = () => {
        if (!isSignedIn) {
            setPrompt({ title: title.title, poster: title.poster, action: 'watched' });
            return;
        }
        onMarkSeason(active, aired.map((e) => e.number), !allSeen);
    };

    return (
        <div className="sect">
            <div className="sect-h"><span>Episodes</span></div>
            <div className="seasonsw" role="tablist" aria-label="Seasons">
                {tabs.map((s) => (
                    <button
                        key={s.id ?? s.season_number}
                        type="button"
                        role="tab"
                        className="sw"
                        aria-pressed={active === s.season_number}
                        onClick={() => setActive(s.season_number)}
                    >
                        {s.season_number === 0 ? 'Specials' : `Season ${s.season_number}`}
                        <em>{s.episode_count}</em>
                    </button>
                ))}
            </div>

            {aired.length > 0 && (
                <div className="sect-h markrow">
                    {/* Per season, counted against that season. The run total is
                        already on the progress bar above; putting "5 of 62" next
                        to a seven-episode season measures one thing with the
                        other thing's ruler. */}
                    <span>
                        {active === 0 ? 'Specials' : `Season ${active}`}
                        {' · '}
                        {seenHere > 0 ? `${seenHere} of ${aired.length} watched` : `${aired.length} aired`}
                    </span>
                    {/* Per season, never per series. */}
                    <button type="button" className="markall" onClick={markAll}>
                        {allSeen ? 'Clear season' : 'Mark all'}
                    </button>
                </div>
            )}

            <div className="eplist">
                {loading && [0, 1, 2].map((i) => <div className="skel skel-ep" key={i} />)}
                {error && <ErrorBox what="these episodes" onRetry={retry} />}
                {data?.episodes.map((e) => {
                    const on = isWatched(watched, active, e.number);
                    return (
                        <div className={`eprow${e.aired ? '' : ' unaired'}`} key={e.id}>
                            <div className="still">{e.still && <img src={e.still} alt="" loading="lazy" />}</div>
                            <div className="body">
                                <div className="en">{e.number}. {e.name}</div>
                                <div className="ed">
                                    {[e.airDate || 'TBA', e.runtime].filter(Boolean).join(' · ')}
                                    {e.voteAverage > 0 && <> · <span className="sc">★ {e.voteAverage}</span></>}
                                </div>
                            </div>
                            {/* An unaired episode cannot be watched, so it cannot
                                be ticked — and says so rather than failing. */}
                            <button
                                type="button"
                                className={`epchk${on ? ' on' : ''}`}
                                disabled={!e.aired}
                                aria-pressed={on}
                                aria-label={`${on ? 'Un-mark' : 'Mark'} episode ${e.number} watched`}
                                title={e.aired ? undefined : 'Not aired yet'}
                                onClick={() => tick(e, !on)}
                            >{on ? '✓' : '○'}</button>
                        </div>
                    );
                })}
                {data && !data.episodes.length && <p className="prov-none">No episode information yet.</p>}
            </div>

            {prompt && <SignInPrompt {...prompt} onClose={() => setPrompt(null)} />}
        </div>
    );
}
