import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton, Empty } from '../components/ui.jsx';
import { useAuth } from '../context/AuthProvider.jsx';
import { useLibrary } from '../context/LibraryProvider.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { posterUrl } from '../lib/tmdb/view.js';
import { tasteSummary, formatDays, formatSpan, SCORE_FLOOR } from '../lib/library.js';

/**
 * Your taste, worked out from your own records and nobody else's.
 *
 * Everything here is cumulative. No streaks, no nudges, nothing that decays —
 * skipping a month costs you nothing, because this is a record of what you have
 * watched and not a game you can be losing.
 */
export default function You() {
    const { isSignedIn, profile } = useAuth();
    const lib = useLibrary();
    const [order, setOrder] = useState('count');

    const { data, error, loading, retry } = useAsync(
        () => tasteSummary(),
        [isSignedIn, lib.ready],
        { skip: !isSignedIn },
    );

    if (!isSignedIn) {
        return (
            <div className="page">
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
    if (loading || (!data && !error)) {
        return (
            <div className="page">
                <div className="page-head"><h1>{profile?.username || 'You'}</h1></div>
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
                <div className="page-head"><h1>{profile?.username || 'You'}</h1></div>
                <Empty
                    title="Couldn’t work out your taste"
                    body="Your records are safe — this screen just couldn’t reach them."
                    action={<button type="button" className="btn" onClick={retry}>Try again</button>}
                />
            </div>
        );
    }

    const { totals } = data;

    if (!totals.titles) {
        return (
            <div className="page">
                <div className="page-head"><h1>{profile?.username || 'You'}</h1></div>
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
            <div className="page-head">
                <h1>{profile?.username || 'You'}</h1>
                <Link className="circ" to="/settings" aria-label="Settings">⚙</Link>
            </div>

            <div className="stiles">
                <div className="st-t"><b>{totals.titles}</b><span>Titles</span></div>
                <div className="st-t"><b>{totals.episodes}</b><span>Episodes</span></div>
                {/* Series minutes arrive as seasons are opened, so until then
                    this is a floor rather than a total, and says so. */}
                <div className="st-t">
                    <b>{formatDays(totals.minutes)}</b>
                    <span>{totals.partial ? 'Days, at least' : 'Days'}</span>
                </div>
            </div>

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
                ranked.map((c, i) => <TasteCard key={c.key} card={c} rank={i + 1} />)
            )}
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
            .sort((a, b) => b.avg - a.avg || b.count - a.count)
        : [...list].sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key))));

    // Genre first, then decade. People join this list in step 4, between them.
    const lanes = [rank(data.genres), rank(data.decades)].filter((l) => l.length);
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
function TasteCard({ card, rank }) {
    return (
        <div className="tastecard">
            <div className="tc-h"><b>{card.key}</b><i>{rank}</i></div>
            <div className="tc-m">
                <div><b>{card.count}</b><span>titles</span></div>
                <div><b>{card.avg ?? '—'}</b><span>avg</span></div>
                <div><b>{formatSpan(card.minutes)}</b><span>time</span></div>
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
