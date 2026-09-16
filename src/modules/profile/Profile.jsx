import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton, Empty, initialsOf } from '../../shared/ui/index.js';
import { useAuth } from '../../shared/auth/AuthProvider.jsx';
import { useLibrary } from '../library';
import { useAsync } from '../../shared/hooks/useAsync.js';
import { posterUrl, profileUrl, toPersonView, roleForJob } from '../../shared/tmdb/view.js';
import { person as fetchPerson } from '../../shared/tmdb/endpoints.js';
import { totalsFromView, totalsAreFresh, personTotalsSet } from '../library';
import { profileStats, distribution, scoreSpread, formatDays, formatSpan, SCORE_FLOOR } from './stats.js';
import Identity from './Identity.jsx';
import { useFavourites, ShelfRail, FavouritesTab } from './Favourites.jsx';
import { SHELVES } from './favourites.js';
import './profile.css';

/**
 * Your taste, worked out from your own records and nobody else's.
 *
 * Everything here is cumulative. No streaks, no nudges, nothing that decays —
 * skipping a month costs you nothing, because this is a record of what you have
 * watched and not a game you can be losing.
 */
/**
 * The same head on every state of this screen.
 *
 * It used to be written out four times, and the gear — the only route to
 * Settings, and therefore the only route to signing out anywhere in the
 * product — was in exactly one of them: the populated one. A new account with
 * nothing yet marked watched sits on the empty state, which had no gear, so
 * there was no way to sign out at all.
 */
function YouHead({ name, status }) {
    return (
        <>
            <div className="page-head">
                <h1 className="vh">{name || 'You'}</h1>
                <Link className="circ" to="/settings" aria-label="Settings">⚙</Link>
            </div>
            <Identity status={status} />
        </>
    );
}

export default function You() {
    const { isSignedIn, authReady, profile } = useAuth();
    const lib = useLibrary();
    const [order, setOrder] = useState('count');
    const [tab, setTab] = useState('Overview');
    const fav = useFavourites();

    const { data, error, loading, retry } = useAsync(
        () => profileStats(),
        [isSignedIn, lib.ready],
        { skip: !isSignedIn },
    );

    // Must sit after the fetch it reads from, and before any early return —
    // hooks do not get to be conditional.
    const filmographies = usePersonTotals(data?.people);

    // Same order, same reason as Library: "we don't know yet" is not "you are
    // a guest", and only one of the two is worth showing someone.
    if (authReady && !isSignedIn) {
        return (
            <div className="page">
                {/* No identity band for a guest: a banner and an initial would
                    be asserting an account that does not exist. G1 sends them
                    to the sign-in sheet from the control they reached for. */}
                <div className="page-head"><h1>You</h1></div>
                <Empty
                    title="Nothing to work from yet"
                    body="Your taste is worked out from what you’ve watched and rated — and only ever shown to you."
                    action={<Link className="btn" to="/welcome/signup" state={{ from: '/you' }}>Create an account</Link>}
                />
            </div>
        );
    }

    // Signed in, but the fetch has not started yet: the session arrives a beat
    // after the first render, so there is a frame where nothing is loading and
    // nothing has loaded. Treating that as loaded shows an empty library to
    // someone who has one.
    if (!authReady || loading || (!data && !error)) {
        return (
            <div className="page">
                <YouHead name={profile?.username} status={loading ? 'loading' : 'ready'} />
                <div className="stiles">
                    {[0, 1, 2].map((i) => <Skeleton key={i} h={40} />)}
                </div>
                {[0, 1, 2].map((i) => (
                    <div className="tastecard" key={i}><Skeleton h={74} /></div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="page">
                <YouHead name={profile?.username} status={loading ? 'loading' : 'ready'} />
                <Empty
                    title="Couldn’t work out your taste"
                    body="Your records are safe — this screen just couldn’t reach them."
                    action={<button type="button" className="btn" onClick={retry}>Try again</button>}
                />
            </div>
        );
    }

    // The database always answers with a totals object, even for an account
    // that has watched nothing. Read it defensively anyway: this screen is the
    // only route to Settings, so a shape that surprises it would take signing
    // out down with it.
    const totals = data?.totals || { titles: 0, episodes: 0, minutes: 0, partial: false };

    if (!totals.titles) {
        return (
            <div className="page">
                <YouHead name={profile?.username} status={loading ? 'loading' : 'ready'} />
                <Empty
                    title="Nothing watched yet"
                    body="Mark something watched and this fills in — genres, decades and the people whose work you keep coming back to."
                    action={<Link className="btn" to="/">Find something to watch</Link>}
                />
            </div>
        );
    }

    const ranked = interleave(data, order);

    return (
        <div className="page">
            <YouHead name={profile?.username} status={loading ? 'loading' : 'ready'} />

            {/* One column of everything is a page nobody reaches the bottom
                of. The banner, name and handle persist above the tabs. */}
            <div className="ptabs" role="tablist" aria-label="Profile">
                {['Overview', 'Favourites', 'Stats'].map((t) => (
                    <button
                        key={t} type="button" role="tab" aria-selected={tab === t}
                        className={tab === t ? 'ptab on' : 'ptab'}
                        onClick={() => setTab(t)}
                    >{t}</button>
                ))}
                {/* Not a tab: the library is a screen the library module owns,
                    and pretending otherwise would put two routes behind one
                    control. */}
                <Link className="ptab" to="/library">Library →</Link>
            </div>

            {tab === 'Overview' && (
                <>
            {/* A film has a runtime and no episodes; a series has both. One
                blended "titles" number hid which of the two you actually are. */}
            <MediumBlock
                title="Films" block={data.films} dist={data.distribution?.movie}
                second={{ label: data.films?.partial ? 'Days, at least' : 'Days',
                    value: formatDays(data.films?.minutes) }}
            />
            <MediumBlock
                title="Series" block={data.series} dist={data.distribution?.tv}
                second={{ label: 'Episodes', value: data.series?.episodes ?? 0 }}
            />

            <ScoreSpread spread={data.spread} />

                    {/* The first eight are the statement; the tab behind them
                        is the whole collection. */}
                    {SHELVES.map((sh) => (
                        <ShelfRail
                            key={sh.key} shelf={sh} cards={fav.shelves[sh.key] || []}
                            onSeeAll={() => setTab('Favourites')}
                        />
                    ))}
                </>
            )}

            {tab === 'Favourites' && <FavouritesTab shelves={fav.shelves} />}

            {tab === 'Stats' && (
                <>
            <div className="sect taste-head">
                <div className="sect-h">
                    <span>Your taste · by {order}</span>
                    <button type="button" className="linkish" onClick={() => setOrder(order === 'count' ? 'score' : 'count')}>
                        {order === 'count' ? 'Score' : 'Count'} ▾
                    </button>
                </div>
            </div>

            {ranked.length === 0 ? (
                <p className="whynot">
                    Rate at least {SCORE_FLOOR} titles in something to rank by score.
                    <br />One film you loved isn’t a taste.
                </p>
            ) : (
                ranked.map((c, i) => (
                    // A genre and a decade are identified by their name; a
                    // person is not, and had no key at all until this.
                    <TasteCard
                        key={c.person_id ? `p${c.person_id}-${c.job || c.role}` : c.key}
                        card={c}
                        rank={i + 1}
                        total={filmographies[c.person_id]}
                    />
                ))
            )}
                </>
            )}
        </div>
    );
}

/**
 * One medium's headline numbers and the bar under them.
 *
 * The labels never skeleton and the block never disappears: a person who has
 * watched no series still sees the Series block reading zero, because a hidden
 * section is indistinguishable from a section that failed.
 */
function MediumBlock({ title, block, dist, second }) {
    const { total, rows } = distribution(dist);
    const watched = block?.watched ?? 0;
    // "Mean score still reads — below three ratings." A single 10 is not an
    // average, it is one opinion.
    const mean = (block?.rated ?? 0) >= SCORE_FLOOR ? block.mean : null;

    return (
        <div className="sblock">
            <div className="sblock-h">
                <b>{title}</b>
                {block?.partial && <span>at least</span>}
            </div>
            <div className="snums">
                <div className="snum-i"><dt>Watched</dt><dd>{watched}</dd></div>
                <div className="snum-i"><dt>{second.label}</dt><dd>{second.value}</dd></div>
                <div className="snum-i"><dt>Mean</dt><dd className="rate">{mean ?? '—'}</dd></div>
            </div>

            {total > 0 && (
                <>
                    <div className="dbar">
                        {rows.map((r) => (
                            <i key={r.key} className={r.tone} style={{ width: `${r.pct}%` }} />
                        ))}
                    </div>
                    {/* Six hues in a row is exactly the case the foundations
                        warn about, so the bar is never the only carrier. */}
                    <div className="dlegend">
                        {rows.map((r) => (
                            <span key={r.key}><i className={r.tone} />{r.label} {r.n}</span>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

/**
 * The most personal line on the page, and it is the same number as "σ 1.4".
 */
function ScoreSpread({ spread }) {
    const said = scoreSpread(spread);
    if (!said) return null;
    return (
        <div className="sblock">
            <div className="sblock-h"><b>Score spread</b><span>σ {said.sigma}</span></div>
            <p className="spread-line">{said.sentence}</p>
        </div>
    );
}

/**
 * One ranked list, drawn from every kind — but not ranked by raw count.
 *
 * Counting everything together lets decades win, and a decade winning says
 * almost nothing: "you watch a lot of 2010s films" is close to a tautology for
 * anyone watching films now. On the test library a tie already put 2010s above
 * Science Fiction, and with a real library the top three would all be decades.
 *
 * So each kind is ranked against its own, and the lists are then interleaved in
 * order of how much the answer tells you: your top genre, your top person, your
 * top decade, then the second of each. The top of the screen is three different
 * kinds of observation rather than three versions of the same one.
 */
function interleave(data, order) {
    const rank = (list) => (order === 'score'
        ? list.filter((c) => c.rated >= SCORE_FLOOR)
            .sort((a, b) => b.mean - a.mean || b.count - a.count)
        : [...list].sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key))));

    // Genre, person, decade — in order of how much the answer tells you.
    const d = data.dimensions || {};
    const lanes = [rank(d.genre || []), rank(data.people || []), rank(d.decade || [])]
        .filter((l) => l.length);
    const out = [];
    for (let i = 0; out.length < lanes.reduce((n, l) => n + l.length, 0); i += 1) {
        for (const lane of lanes) if (lane[i]) out.push(lane[i]);
    }
    return out;
}

/**
 * One card shape serves genres, people and decades: name, rank, three measures
 * and poster evidence. Only the first measure's denominator differs.
 */
function TasteCard({ card, rank, total }) {
    const isPerson = Boolean(card.person_id);
    return (
        <div className="tastecard">
            <div className="tc-h">
                <b>
                    {isPerson && (
                        <span className={`tc-face${card.profile_path ? '' : ' noimg'}`}>
                            {card.profile_path
                                ? <img src={profileUrl(card.profile_path, 'w185')} alt="" loading="lazy" />
                                : initialsOf(card.name)}
                        </span>
                    )}
                    {card.name ?? card.key}
                </b>
                <i>{rank}</i>
            </div>
            <div className="tc-m">
                {/* "6 of 11" is the headline for a person: it is what tells you
                    whether six means anything. The denominator is their whole
                    filmography, which lives at TMDB rather than here, so it
                    arrives a moment after the card and the card does not wait. */}
                <div>
                    <b>{card.count}</b>
                    <span>
                        {isPerson && total
                            ? `of ${total.count} ${total.verb}`
                            : `title${card.count === 1 ? '' : 's'}`}
                    </span>
                </div>
                <div><b>{card.mean ?? '—'}</b><span>mean</span></div>
                {/* A season whose runtime has not been gathered yet contributes
                    nothing, so the figure is a floor. The "+" says so without
                    turning a card into a footnote. */}
                <div>
                    <b>{formatSpan(card.minutes)}{card.partial && card.minutes > 0 ? '+' : ''}</b>
                    <span>time</span>
                </div>
            </div>
            {card.posters?.length > 0 && (
                <div className="tc-r" aria-hidden="true">
                    {card.posters.map((path) => (
                        <i key={path} style={{ backgroundImage: `url(${posterUrl(path, 'w92')})` }} />
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * How much of each person's work exists, so "6" can become "6 of 11".
 *
 * The denominator is not ours: it is the whole filmography, which lives at
 * TMDB. It used to be fetched for every person card on every visit — twelve
 * requests to redraw numbers that change a few times a year. The taste query
 * now brings each person's cached totals along; only a person whose totals
 * are missing or a month old is asked for, and the answer is stored for next
 * time, so the second visit asks for nobody.
 */
function usePersonTotals(people) {
    const [totals, setTotals] = useState({});
    const asked = useRef(new Set());

    useEffect(() => {
        if (!people?.length) return undefined;
        let live = true;

        // What the query already carried, applied at once.
        const known = {};
        for (const p of people) {
            const role = roleForJob(p.role, p.job);
            const t = role && totalsAreFresh(p) && p.credit_totals?.[role.key];
            if (t) known[p.person_id] = { count: t.count, verb: t.verb };
        }
        if (Object.keys(known).length) setTotals((prev) => ({ ...prev, ...known }));

        (async () => {
            for (const p of people) {
                if (!live || known[p.person_id] || asked.current.has(p.person_id)) continue;
                // TMDB returns the occasional 502. Marking a person as asked
                // before the attempt meant one transient failure left that card
                // reading "6 titles" for the rest of the session, with no way
                // back — so the mark goes on only once there is an answer.
                for (let attempt = 0; attempt < 3 && live; attempt += 1) {
                    try {
                        const view = toPersonView(await fetchPerson(p.person_id));
                        const role = roleForJob(p.role, p.job);
                        const found = role && view.roles.find((r) => r.key === role.key);
                        asked.current.add(p.person_id);
                        if (live && found) {
                            setTotals((t) => ({
                                ...t,
                                [p.person_id]: { count: found.items.length, verb: found.verb },
                            }));
                        }
                        if (view.roles.length) {
                            personTotalsSet({
                                id: p.person_id, name: p.name,
                                profilePath: p.profile_path, totals: totalsFromView(view),
                            });
                        }
                        break;
                    } catch {
                        // A card reading "6 titles" is worse than "6 of 11" and
                        // far better than no card, so a person who cannot be
                        // reached is left alone rather than hidden.
                        await new Promise((r) => { setTimeout(r, 400 * (attempt + 1)); });
                    }
                }
            }
        })();

        return () => { live = false; };
    }, [people]);

    return totals;
}
