import { useState, useCallback, useEffect, useRef } from 'react';
import './title.css';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { titleFull, season as fetchSeason } from '../../shared/tmdb/endpoints.js';
import { toTitleView, toSeasonView, compactCount } from '../../shared/tmdb/view.js';
import { useAsync } from '../../shared/hooks/useAsync.js';
import { useRegion } from '../../shared/hooks/useRegion.js';
import { Poster, Tile, PersonRow, ErrorBox, Empty, Toast, Icon, initialsOf } from '../../shared/ui/index.js';
import { TitleSkeleton } from './TitleSkeleton.jsx';
import { SignInPrompt } from '../entry';
import { Editor } from '../library';
import { useAuth } from '../../shared/auth/AuthProvider.jsx';
import { useLibrary, useTileStates, useQuickAdd } from '../library';
import {
    statusMeta, statusTone, episodesWatched, isWatched, runningOrder, nextUnwatched,
    rememberSeasonRuntime,
} from '../library';
import {
    cohortOf, shows, leadsWithDate, longDate, yearsOf, primaryFor, seriesNote,
    NOT_PREMIERED, FINISHED,
} from './cohort.js';
import { orderTabs, tabLabel, tabCount, seasonTitle, episodeName } from './seasons.js';

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
                    <Icon name={open ? 'up' : 'down'} size={16} />
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
    /* §03b: ?season=2 deep-links with that tab selected, which is most of what
       a season page would have bought — for a query parameter rather than a
       route, a layout and a back-stack entry. Replaced rather than pushed, so
       tapping through six seasons does not bury the page somebody came from.

       Absent until somebody picks. Until then the band follows progress:
       landing on season 21 of 24 with the row showing S1–S4 is the failure the
       tabs exist to prevent. */
    const [params, setParams] = useSearchParams();
    /* Read as a string first. Number(null) is 0, and 0 is a real season — the
       specials — so treating "absent" as a number silently landed every arrival
       on Specials, which §03b says must never be first. */
    const raw = params.get('season');
    const asked = raw === null ? null : Number(raw);
    const picked = asked !== null && Number.isInteger(asked) && asked >= 0 ? asked : null;
    const setPicked = (n) => {
        const next = new URLSearchParams(params);
        next.set('season', String(n));
        setParams(next, { replace: true });
    };
    const [jumpTo, setJumpTo] = useState(null);
    const [stores, setStores] = useState(false);
    const [prompt, setPrompt] = useState(null);
    const [editing, setEditing] = useState(false);
    const [toast, setToast] = useState(null);
    const dismissToast = useCallback(() => setToast(null), []);
    const { isSignedIn, authReady } = useAuth();
    const lib = useLibrary();
    const stateFor = useTileStates();
    const quickAdd = useQuickAdd((item) => setPrompt({ title: item.title, poster: item.poster, action: 'save' }));

    const valid = mediaType === 'movie' || mediaType === 'tv';

    const { data, error, loading, retry } = useAsync(
        ({ signal }) => titleFull(id, mediaType, { signal }).then((raw) => toTitleView(raw, mediaType, region)),
        [id, mediaType, region],
        { skip: !valid },
    );

    /* Derived above the early returns, because the season fetch below is a hook
       and a hook cannot sit behind a `return`. Everything here tolerates `data`
       being null, which is the state the skeleton is drawn in. */
    const tvNow = data?.mediaType === 'tv';
    const entryNow = data ? lib.entryFor(data.mediaType, data.id) : null;
    const orderNow = tvNow ? runningOrder(data.seasons, data.airedEpisodes) : [];
    const nextNow = tvNow ? nextUnwatched(orderNow, entryNow?.watched_episodes) : null;
    const season = picked ?? nextNow?.season ?? data?.seasons?.[0]?.season_number ?? 1;

    /* The season the page is showing, fetched here rather than inside the
       episode band: the band draws it, but the primary button needs a name out
       of it — "next up Breakage" is an episode title, and only this payload
       knows it. */
    const seasonAsync = useAsync(
        ({ signal }) => fetchSeason(data.id, season, { signal }).then(toSeasonView),
        [data?.id, season],
        { skip: !tvNow },
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
    const isTV = tvNow;
    const entry = entryNow;
    const saved = Boolean(entry);
    const state = entry ? statusMeta(entry.status) : null;

    // A guest still sees every control. Hiding them would hide the product from
    // exactly the people who haven't seen it yet — so they raise the sign-in
    // sheet instead, naming the thing that was being reached for.
    const ask = (action) => setPrompt({ title: t.title, poster: t.poster, action });
    // The verb follows the control, not the page. A guest tapping the heart was
    // being asked "Track this series?" — the same mismatch the sign-in sheet was
    // built to avoid, reintroduced by a single default.
    // A tap in the second before the session answer arrives does nothing
    // rather than raising a sign-in sheet at someone who is already signed in.
    const gate = (verb, fn) => {
        if (isSignedIn) return fn();
        if (authReady) return ask(verb);
        return undefined;
    };
    const primaryVerb = isTV ? 'track' : 'want';

    const order = orderNow;
    const seen = episodesWatched(entry?.watched_episodes);

    /* One reading of the data, and everything below asks it rather than
       re-deriving its own answer from t.status. */
    const cohort = cohortOf(t);
    const next = nextNow;
    /* The name only exists when the loaded season is the one the next episode
       is in. When it is not, the button says where without saying what — which
       is still true, and better than waiting for a second request to say it. */
    const nextNamed = next && seasonAsync.data?.seasonNumber === next.season
        ? { ...next, name: seasonAsync.data.episodes.find((e) => e.number === next.episode)?.name || null }
        : next;

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

    /* A series is a run, and the run says whether it is over: "2022–" is still
       going, "2008–2013" is not. A cohort that has not premiered has a season
       count that describes nothing yet, so it does not carry one. */
    const headline = leadsWithDate(cohort)
        ? `${isTV ? 'First episode' : 'In cinemas'} ${longDate(t.releaseDate) || 'date to be announced'}`
        : null;
    const meta = [
        !headline && yearsOf(t, cohort),
        t.runtime,
        isTV && cohort !== NOT_PREMIERED && `${t.seasonCount} season${t.seasonCount === 1 ? '' : 's'}`,
        isTV && cohort !== NOT_PREMIERED && `${t.episodeCount} episodes`,
        isTV && cohort === FINISHED && (t.status === 'Canceled' || t.status === 'Cancelled' ? 'Cancelled' : 'Ended'),
        t.genres.join(', ') || null,
    ].filter(Boolean).join(' · ');

    // Every control a guest can reach raises the sign-in sheet. They stay
    // visible rather than hidden: concealing them would hide the product from
    // exactly the people who haven't seen it yet.
    /* Band 2. Five cohorts, five different buttons, one position — somebody
       arriving at a series from Search and a film from their library finds the
       thing they came to do in the same place on both. */
    const primary = primaryFor(t, cohort, {
        saved, statusLabel: state?.label, seen, aired: t.airedEpisodes, next: nextNamed,
    });
    const note = isTV ? seriesNote(t, cohort) : null;

    /* "Continue · S2 E5" goes to S2 E5. A button that names an episode and then
       opens a status editor is naming something it does not do. */
    const continueToNext = () => {
        if (!next) return;
        setPicked(next.season);
        setJumpTo({ ...next, at: Date.now() });
    };
    const isContinue = isTV && Boolean(next) && !primary.standalone && !primary.saved;

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
                    onClick={() => (isContinue
                        ? continueToNext()
                        : gate(saved ? 'edit' : primaryVerb, () => (saved ? setEditing(true) : quickSave())))}
                >
                    {primary.saved && state?.icon && <Icon name={state.icon} size={16} />}
                    {!saved && !isTV && !primary.standalone && <Icon name="add" size={16} />}
                    {primary.label}
                    {primary.saved && <Icon name="down" size={16} />}
                </button>
                <button
                    type="button"
                    className={`ibtn like${entry?.is_favourite ? ' on' : ''}`}
                    aria-pressed={isSignedIn ? Boolean(entry?.is_favourite) : undefined}
                    aria-label={entry?.is_favourite ? 'Remove from favourites' : 'Mark as favourite'}
                    onClick={() => gate('like', () => lib.save(t, { favourite: !entry?.is_favourite }))}
                ><Icon name="heart" size={20} /></button>
                <button
                    type="button"
                    className="ibtn"
                    aria-label="Edit"
                    onClick={() => gate('edit', () => setEditing(true))}
                ><Icon name="edit" size={20} /></button>
            </div>

            {/* §03d: the verb takes the button, the detail goes underneath on
                the line that already states progress. Stacking a label over a
                caption made the control read as two controls in a box.

                Episodes, never seasons: "3 of 5 seasons" hides that season
                three is twenty-two episodes long. */}
            {isTV && saved && shows(cohort, 'progress') && primary.detail && (
                <div className="prg">
                    <div className="prg-h"><span>{primary.detail}</span></div>
                    {order.length > 0 && !primary.standalone && (
                        <div className="prg-bar">
                            <i style={{ width: `${Math.round((seen / order.length) * 100)}%` }} />
                        </div>
                    )}
                </div>
            )}

            {note && <p className="snote">{note}</p>}

            {/* §03c. Two rows, not six: the three-tier draft pushed the scores,
                your rating and the synopsis below the fold on a 320px screen,
                which is the richest data on the page losing its place to a
                list of shops. Streaming is one row; rent is one chip. */}
            {shows(cohort, 'providers') && (
            <div className="prov">
                <div className="prov-l">Where to watch · {countryName(t.providers.region)}</div>
                {t.providers.any ? (
                    <>
                        {t.providers.streaming.length > 0 && (
                            <div className="provrow">
                                {t.providers.streaming.map((p) => (
                                    <span className="pchip" key={p.id}>
                                        {p.logo && <img className="plogo" src={p.logo} alt="" loading="lazy" />}
                                        {p.name}
                                        {p.note && <i className="pnote">{p.note}</i>}
                                    </span>
                                ))}
                            </div>
                        )}
                        {/* Seven storefronts for Oppenheimer in the US, and the
                            same seven for nearly everything. A list adds nothing
                            a count does not. */}
                        {t.providers.paid.length > 0 && (
                            <button type="button" className="pchip paid" onClick={() => setStores(true)}>
                                Rent or buy · {t.providers.paid.length}
                                <Icon name="forward" size={16} />
                            </button>
                        )}
                        {t.providers.streaming.length === 0 && (
                            <p className="prov-none">Not streaming in {countryName(t.providers.region)}.</p>
                        )}
                    </>
                ) : (
                    <p className="prov-none">
                        Not available in {countryName(t.providers.region)}.
                        {t.providers.link && <> <a href={t.providers.link} target="_blank" rel="noreferrer noopener">See options</a></>}
                    </p>
                )}
            </div>
            )}

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
                    <button type="button" className="circ on-image" onClick={() => navigate(-1)} aria-label="Back"><Icon name="back" size={24} /></button>
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
                    {headline && <p className="headline">{headline}</p>}
                    {t.tagline && !headline && <p className="tagline">“{t.tagline}”</p>}
                </div>

                <div className="tbody">
                    <div className="tside-inline">{actions}</div>

                    {shows(cohort, 'scores') && (
                    <div className="scores">
                        <div className="s gold">
                            <b>{t.voteAverage || '—'}</b>
                            <span>TMDB · {compactCount(t.voteCount)}</span>
                        </div>
                        {/* Never merged with TMDB's. The disagreement is the
                            interesting number. */}
                        <div className={`s${entry?.rating != null ? ' gold' : ' dim'}`}>
                            <b>{entry?.rating ?? '—'}</b>
                            <span>Your rating</span>
                        </div>
                        <div className={`s${entry?.rewatch_count ? '' : ' dim'}`}>
                            <b>{entry?.rewatch_count || '—'}</b>
                            <span>Rewatches</span>
                        </div>
                    </div>
                    )}

                    {t.overview && shows(cohort, 'overview') && (
                        <div className="sect">
                            <div className="sect-h"><span>Overview</span></div>
                            <p className={`ov${expanded ? '' : ' clamped'}`}>{t.overview}</p>
                            <button type="button" className="more" onClick={() => setExpanded((v) => !v)}>
                                {expanded ? 'Less' : 'More'}
                            </button>
                        </div>
                    )}

                    {/* Band 9 before band 10. The episode list is the reason a
                        series page exists; it used to sit below four preview
                        cards, which put "Themes" above "what do I watch next". */}
                    {isTV && shows(cohort, 'episodes') && (
                        <Episodes
                            title={t}
                            entry={entry}
                            season={season}
                            onSeason={setPicked}
                            jumpTo={jumpTo}
                            onJumped={() => setJumpTo(null)}
                            state={seasonAsync}
                            onTick={tickEpisode}
                            onMarkSeason={markSeason}
                        />
                    )}

                    {cards}

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

            {stores && (
                <StoreSheet
                    region={countryName(t.providers.region)}
                    stores={t.providers.paid}
                    link={t.providers.link}
                    onClose={() => setStores(false)}
                />
            )}
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

/**
 * The storefronts, behind a count.
 *
 * §03c keeps this off the page because the list is the same nearly everywhere —
 * and because putting it inline is what pushed the scores and the synopsis
 * below the fold at 320. No prices: TMDB does not carry them, and a made-up
 * "from £3.49" on a page somebody acts on is the one failure here that costs
 * them money.
 */
function StoreSheet({ region, stores, link, onClose }) {
    useEffect(() => {
        const opener = document.activeElement;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
        };
    }, [onClose]);

    return (
        <div className="scrim" role="dialog" aria-modal="true" aria-label="Rent or buy" onClick={onClose}>
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
                <div className="grab" />
                <h2 className="sheet-title">Rent or buy</h2>
                <p className="sheet-body">{stores.length} places in {region}. Prices are not ours to quote.</p>
                <div className="storelist">
                    {stores.map((p) => (
                        <span className="pchip" key={p.id}>
                            {p.logo && <img className="plogo" src={p.logo} alt="" loading="lazy" />}{p.name}
                        </span>
                    ))}
                </div>
                {link && (
                    <a className="btn quiet storelink" href={link} target="_blank" rel="noreferrer noopener">
                        See them on TMDB
                    </a>
                )}
            </div>
        </div>
    );
}

function Episodes({ title, entry, season, onSeason, jumpTo, onJumped, state, onTick, onMarkSeason }) {
    const { isSignedIn, authReady } = useAuth();
    const [prompt, setPrompt] = useState(null);
    const [open, setOpen] = useState(null);
    const tabs = orderTabs(title.seasons, title.specials);
    const active = season;
    const { data, error, loading, retry } = state;
    const row = useRef(null);

    /* Grey's Anatomy has 24 seasons. Landing on season 21 with the row showing
       S1–S4 is the failure the tabs exist to prevent, so the selected one is
       brought into view on arrival — and never a dropdown, because a dropdown
       hides how long the show is, and how long it is happens to be the most
       useful fact on the page. */
    useEffect(() => {
        const el = row.current?.querySelector('[aria-pressed="true"]');
        el?.scrollIntoView({ block: 'nearest', inline: 'center' });
    }, [active, tabs.length]);

    /* Arriving by way of "Continue · S2 E5". The season has already changed by
       the time this runs; wait for its episodes, then put the row somewhere a
       person can see it. */
    useEffect(() => {
        if (!jumpTo || jumpTo.season !== active || !data?.episodes?.length) return;
        document.getElementById(`ep-${active}-${jumpTo.episode}`)
            ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        onJumped();
    }, [jumpTo, active, data, onJumped]);

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
            if (authReady) setPrompt({ title: title.title, poster: title.poster, action: 'watched' });
            return;
        }
        onTick(active, e.number, on);
    };

    const markAll = () => {
        if (!isSignedIn) {
            if (authReady) setPrompt({ title: title.title, poster: title.poster, action: 'watched' });
            return;
        }
        onMarkSeason(active, aired.map((e) => e.number), !allSeen);
    };

    return (
        <div className="sect">
            <div className="sect-h"><span>Episodes</span></div>
            {/* §03b: with one season there is no tab row at all — a single tab
                is a label pretending to be a control. This is also TV5, the
                miniseries, which needs no rule of its own to get it right. */}
            {tabs.length > 1 && (
            <div className="seasonsw" role="tablist" aria-label="Seasons" ref={row}>
                {tabs.map((s) => (
                    <button
                        key={s.id ?? s.season_number}
                        type="button"
                        role="tab"
                        className="sw"
                        aria-pressed={active === s.season_number}
                        onClick={() => onSeason(s.season_number)}
                    >
                        {tabLabel(s)}
                        <em>{tabCount(s, watched)}</em>
                    </button>
                ))}
            </div>
            )}

            {/* TV9. The band header becomes the season — which is what a season
                page would have been for, and it costs a header rather than a
                route. Counted against this season: the run total is on the line
                under the primary, and putting "5 of 62" beside a seven-episode
                season measures one thing with the other thing's ruler. */}
            {data && (
                <div className="shead">
                    {data.poster && <img className="sposter" src={data.poster} alt="" loading="lazy" />}
                    <div className="sbody">
                        <div className="sect-h markrow">
                            <span>
                                {[
                                    seasonTitle({ ...data, season_number: active }),
                                    data.year,
                                    aired.length > 0 && (seenHere > 0
                                        ? `${seenHere} of ${aired.length}`
                                        : `${aired.length} aired`),
                                ].filter(Boolean).join(' · ')}
                            </span>
                            {/* Per season, never per series. */}
                            {aired.length > 0 && (
                                <button type="button" className="markall" onClick={markAll}>
                                    {allSeen ? 'Clear season' : 'Mark all'}
                                </button>
                            )}
                        </div>
                        {data.overview && <p className="sov">{data.overview}</p>}
                    </div>
                </div>
            )}

            <div className="eplist">
                {loading && [0, 1, 2].map((i) => <div className="skel skel-ep" key={i} />)}
                {error && <ErrorBox what="these episodes" onRetry={retry} />}
                {data?.episodes.map((e) => {
                    const on = isWatched(watched, active, e.number);
                    return (
                        <div className={`eprow${e.aired ? '' : ' unaired'}`} key={e.id} id={`ep-${active}-${e.number}`}>
                            <div className="still">{e.still && <img src={e.still} alt="" loading="lazy" />}</div>
                            <div className="body">
                                {/* Two targets, not one with a hotspot: the tick
                                    marks it, the name opens it, and the rest of
                                    the row does nothing. */}
                                <button type="button" className="en" onClick={() => setOpen(e)}>
                                    {e.number}. {episodeName(e)}
                                </button>
                                <div className="ed">
                                    {[e.airDate || 'TBA', e.runtime].filter(Boolean).join(' · ')}
                                    {e.voteAverage > 0 && <> · <span className="sc"><Icon name="star" size={12} /> {e.voteAverage}</span></>}
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
                            >{on ? <Icon name="check" size={16} /> : <span className="ep-dot" />}</button>
                        </div>
                    );
                })}
                {data && !data.episodes.length && <p className="prov-none">No episode information yet.</p>}
            </div>

            {open && (
                <EpisodeSheet
                    episode={open}
                    season={active}
                    watched={isWatched(watched, active, open.number)}
                    onTick={(on) => { tick(open, on); setOpen(null); }}
                    onClose={() => setOpen(null)}
                />
            )}
            {prompt && <SignInPrompt {...prompt} onClose={() => setPrompt(null)} />}
        </div>
    );
}

/**
 * TV10 — an episode is a sheet, not a page.
 *
 * You never arrive at an episode cold. You are always inside a list of
 * sixty-two, and a page would take you out of it, costing your scroll position
 * to show you a still and a paragraph.
 *
 * This is also where per-episode rating would go, and that is the point of
 * choosing a sheet: we do not support it — rating is per title today — and it
 * is a real product question rather than a layout one. A sheet leaves the room
 * for it without committing to it, and without a route that would have to be
 * un-built if the answer is no.
 */
function EpisodeSheet({ episode: e, season, watched, onTick, onClose }) {
    useEffect(() => {
        const opener = document.activeElement;
        const onKey = (k) => { if (k.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
        };
    }, [onClose]);

    const facts = [e.airDate || 'Not aired yet', e.runtime].filter(Boolean).join(' · ');
    return (
        <div className="scrim" role="dialog" aria-modal="true" aria-label={episodeName(e)} onClick={onClose}>
            <div className="sheet" onClick={(ev) => ev.stopPropagation()}>
                <div className="grab" />
                {e.still && <img className="epstill" src={e.still} alt="" />}
                <h2 className="sheet-title">{episodeName(e)}</h2>
                <p className="sheet-body">S{season} E{e.number} · {facts}</p>
                {e.overview && <p className="epov">{e.overview}</p>}
                {e.guests.length > 0 && (
                    <div className="epguests">
                        <div className="prov-l">Guest stars</div>
                        {e.guests.map((g) => (
                            <PersonRow key={g.id} person={g} sub={g.character} />
                        ))}
                    </div>
                )}
                {e.aired && (
                    <button type="button" className="btn epmark" onClick={() => onTick(!watched)}>
                        {watched ? 'Un-mark watched' : 'Mark watched'}
                    </button>
                )}
            </div>
        </div>
    );
}
