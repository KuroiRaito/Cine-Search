import { useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { titleFull, season as fetchSeason } from '../lib/tmdb/endpoints.js';
import { toTitleView, toSeasonView, compactCount } from '../lib/tmdb/view.js';
import { useAsync } from '../hooks/useAsync.js';
import { useRegion } from '../hooks/useRegion.js';
import { Poster, Rail, PersonChip, TitleSkeleton, ErrorBox, Empty } from '../components/ui.jsx';
import SignInPrompt from '../components/SignInPrompt.jsx';

/**
 * Two whole labels, not one label with half of it hidden — splitting a word
 * across a toggled span breaks the moment the hidden half is forced visible by
 * a more specific rule, which is exactly what happened here.
 */
function Label({ short, long }) {
    return (
        <>
            <span className="lbl-short">{short}</span>
            <span className="lbl-long">{long}</span>
        </>
    );
}

const countryName = (code) => {
    try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code; }
    catch { return code; }
};

export default function Title() {
    const { mediaType, id } = useParams();
    const navigate = useNavigate();
    const { region } = useRegion();
    const [expanded, setExpanded] = useState(false);
    const [prompt, setPrompt] = useState(null);

    const valid = mediaType === 'movie' || mediaType === 'tv';

    const { data, error, loading, retry } = useAsync(
        ({ signal }) => titleFull(id, mediaType, { signal }).then((raw) => toTitleView(raw, mediaType, region)),
        [id, mediaType, region],
        { skip: !valid },
    );

    if (!valid) return <Empty title="Not found" body="That isn't a kind of thing we have." action={<Link className="btn" to="/">Go to Discover</Link>} />;
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
    const directors = t.crew.filter((c) => c.job === 'Director' || c.job === 'Creator');

    return (
        <div className="page">
            <div className="hero">
                {t.backdrop && <img src={t.backdrop} alt="" fetchPriority="high" />}
                <div className="hero-nav">
                    <button type="button" className="circ on-image" onClick={() => navigate(-1)} aria-label="Back">‹</button>
                </div>
            </div>

            <div className="title-head">
                <div className="poster"><Poster src={t.poster} title={t.title} eager /></div>
                <div className="who">
                    <h1>{t.title}</h1>
                    {/* A missing certification is simply absent — the line reflows around it. */}
                    <div className="metaline">
                        {t.certification && <span className="cert">{t.certification}</span>}
                        {[t.year, t.runtime, isTV && `${t.seasonCount} season${t.seasonCount === 1 ? '' : 's'}`]
                            .filter(Boolean).join(' · ')}
                        {t.genres.length > 0 && <><br />{t.genres.join(', ')}</>}
                    </div>
                </div>
            </div>

            {t.tagline && <p className="tagline">“{t.tagline}”</p>}

            <div className="card">
                <button
                    type="button"
                    className="btn"
                    style={{ width: '100%' }}
                    onClick={() => setPrompt({ title: t.title, action: isTV ? 'track' : 'save' })}
                >
                    {isTV ? 'Track this series' : 'Add to your library'}
                </button>

                <div className="card-label" style={{ marginTop: 14 }}>
                    Where to watch · {countryName(t.providers.region)}
                </div>
                {t.providers.any ? (
                    <>
                        {[['Stream', t.providers.flatrate], ['Rent', t.providers.rent], ['Buy', t.providers.buy]]
                            .filter(([, list]) => list.length)
                            .map(([label, list]) => (
                                <div key={label} style={{ marginTop: 8 }}>
                                    <div className="card-label" style={{ marginBottom: 6 }}>{label}</div>
                                    <div className="provrow">
                                        {list.map((p) => (
                                            <span className="pchip" key={p.id}>
                                                {p.logo && <img src={p.logo} alt="" loading="lazy" />}{p.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                    </>
                ) : (
                    <p className="prov-none">
                        Not streaming in {countryName(t.providers.region)}.
                        {t.providers.link && <> <a href={t.providers.link} target="_blank" rel="noreferrer noopener">See options on TMDB</a></>}
                    </p>
                )}
            </div>

            <div className="scores">
                <div className="s gold">
                    <b>{t.voteAverage || '—'}</b>
                    <span><Label short="TMDB" long={`TMDB · ${compactCount(t.voteCount)}`} /></span>
                </div>
                <div className="s dim">
                    <b>—</b>
                    <span><Label short="You" long="Your score" /></span>
                </div>
                {isTV && (
                    <div className="s">
                        <b>{t.airedEpisodes}</b>
                        <span><Label short="Aired" long="Aired episodes" /></span>
                    </div>
                )}
            </div>

            {t.overview && (
                <div className="card">
                    <div className="card-label">Synopsis</div>
                    <p className={`overview${expanded ? '' : ' clamped'}`}>{t.overview}</p>
                    <button type="button" className="more" onClick={() => setExpanded((v) => !v)}>
                        {expanded ? 'Show less' : 'Read more'}
                    </button>
                </div>
            )}

            {directors.length > 0 && (
                <>
                    <div className="section"><div className="section-h"><span>{isTV ? 'Created by' : 'Director'}</span></div></div>
                    <div className="people">
                        {directors.map((p) => <PersonChip key={`${p.id}-${p.job}`} person={p} sub={p.job} />)}
                    </div>
                </>
            )}

            {t.cast.length > 0 && (
                <>
                    <div className="section"><div className="section-h"><span>Cast</span></div></div>
                    <div className="people">
                        {t.cast.map((p) => <PersonChip key={p.id} person={p} sub={p.character} />)}
                    </div>
                </>
            )}

            {isTV && <Episodes showId={t.id} seasons={t.seasons} specials={t.specials} />}

            {t.keywords.length > 0 && (
                <div className="card">
                    <div className="card-label">Themes</div>
                    <div className="keywords">
                        {t.keywords.map((k) => <span className="kw" key={k.id}>{k.name}</span>)}
                    </div>
                </div>
            )}

            <Rail title="More like this" items={t.related} />

            {prompt && <SignInPrompt {...prompt} onClose={() => setPrompt(null)} />}
        </div>
    );
}

function Episodes({ showId, seasons, specials }) {
    const tabs = [...seasons, ...(specials ? [specials] : [])];
    const [active, setActive] = useState(tabs[0]?.season_number ?? 1);

    const load = useCallback(
        ({ signal }) => fetchSeason(showId, active, { signal }).then(toSeasonView),
        [showId, active],
    );
    const { data, error, loading, retry } = useAsync(load, [showId, active]);

    if (!tabs.length) return null;

    return (
        <>
            <div className="section" style={{ marginBottom: 0 }}>
                <div className="section-h"><span>Episodes</span></div>
            </div>
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

            <div className="card">
                {loading && <div style={{ display: 'grid', gap: 10 }}>
                    {[0, 1, 2].map((i) => <div className="skel" key={i} style={{ height: 44 }} />)}
                </div>}
                {error && <ErrorBox what="these episodes" onRetry={retry} />}
                {data?.episodes.map((e) => (
                    <div className={`eprow${e.aired ? '' : ' unaired'}`} key={e.id}>
                        <div className="still">{e.still && <img src={e.still} alt="" loading="lazy" />}</div>
                        <div className="body">
                            <div className="en">{e.number}. {e.name}</div>
                            <div className="ed">
                                {[e.airDate || 'TBA', e.runtime].filter(Boolean).join(' · ')}
                                {e.voteAverage > 0 && <> · <span className="sc">★ {e.voteAverage}</span></>}
                            </div>
                        </div>
                    </div>
                ))}
                {data && !data.episodes.length && <p className="prov-none">No episode information yet.</p>}
            </div>
        </>
    );
}
