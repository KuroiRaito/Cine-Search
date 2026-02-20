import React, { useState, useEffect } from 'react';
import { getTVSeasonDetails } from '../lib/tmdb';

export default function DetailModal({ data, onClose }) {
    if (!data || !data.tmdb) return null;

    const { tmdb } = data;
    const title = tmdb.name || tmdb.title;
    const poster = tmdb.poster_path;
    const year = tmdb.year || (tmdb.first_air_date ? tmdb.first_air_date.substring(0, 4) : 'Unknown');
    const overview = tmdb.overview || 'No overview available.';

    // Additional TV Properties
    const isTV = Boolean(tmdb.first_air_date);
    const rating = tmdb.vote_average ? tmdb.vote_average.toFixed(1) : 'N/A';
    const genres = tmdb.genres ? tmdb.genres.map(g => g.name).join(', ') : '';
    const seasons = tmdb.seasons || [];
    const cast = tmdb.cast || [];

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex',
            justifyContent: 'center', alignItems: 'center', zIndex: 1000,
            padding: '20px', overflowY: 'auto'
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px',
                maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
                color: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '20px'
            }} onClick={e => e.stopPropagation()}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h2 style={{ margin: 0 }}>{title} ({year})</h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                </div>

                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    {poster ? (
                        <img src={`https://image.tmdb.org/t/p/w300${poster}`} alt={title} style={{ borderRadius: '8px', width: '200px', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '200px', height: '300px', backgroundColor: '#334155', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No Poster</div>
                    )}

                    <div style={{ flex: 1, minWidth: '300px' }}>

                        <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', color: '#94a3b8', fontSize: '0.9rem' }}>
                            {rating !== 'N/A' && <span>⭐ {rating}</span>}
                            {genres && <span>{genres}</span>}
                        </div>

                        <h3 style={{ marginTop: 0, borderBottom: '1px solid #334155', paddingBottom: '8px' }}>Overview</h3>
                        <p style={{ lineHeight: '1.6', color: '#cbd5e1' }}>{overview}</p>

                        {isTV && cast.length > 0 && (
                            <>
                                <h3 style={{ marginTop: '20px', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>Cast</h3>
                                <div style={{ display: 'flex', overflowX: 'auto', gap: '10px', paddingBottom: '10px' }}>
                                    {cast.map((c, i) => (
                                        <div key={i} style={{ flexShrink: 0, width: '80px', textAlign: 'center' }}>
                                            {c.profile_path ? (
                                                <img src={`https://image.tmdb.org/t/p/w185${c.profile_path}`} alt={c.name} style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#334155', margin: '0 auto' }} />
                                            )}
                                            <div style={{ fontSize: '0.75rem', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                                            <div style={{ fontSize: '0.65rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.character}</div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {isTV && seasons.length > 0 && (
                    <div>
                        <h3 style={{ borderBottom: '1px solid #334155', paddingBottom: '8px' }}>Seasons</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {seasons.map((season) => (
                                <SeasonBlock key={season.id} season={season} tvId={tmdb.id} />
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

function SeasonBlock({ season, tvId }) {
    const [expanded, setExpanded] = useState(false);
    const [episodes, setEpisodes] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (expanded && episodes.length === 0) {
            setLoading(true);
            getTVSeasonDetails(tvId, season.season_number)
                .then(data => {
                    if (data && data.episodes) {
                        setEpisodes(data.episodes);
                    }
                    setLoading(false);
                })
                .catch(e => {
                    console.error("Failed to load episodes for season", season.name, e);
                    setLoading(false);
                });
        }
    }, [expanded, tvId, season.season_number, episodes.length]);

    return (
        <div style={{ backgroundColor: '#0f172a', borderRadius: '6px', overflow: 'hidden' }}>
            <button
                onClick={() => setExpanded(!expanded)}
                style={{ width: '100%', padding: '12px', background: 'transparent', border: 'none', color: '#fff', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <strong>{season.name}</strong>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{season.episode_count} Episodes</span>
                </div>
                <span>{expanded ? '▲' : '▼'}</span>
            </button>
            {expanded && (
                <div style={{ padding: '0 12px 12px 12px' }}>
                    {loading ? (
                        <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '10px 0' }}>Loading episodes...</div>
                    ) : episodes.length > 0 ? (
                        episodes.map(ep => (
                            <div key={ep.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #1e293b', fontSize: '0.85rem' }}>
                                <div style={{ flex: 1 }}>
                                    <strong style={{ color: '#cbd5e1' }}>{ep.episode_number}. {ep.name}</strong>
                                    {ep.vote_average > 0 && (
                                        <span style={{ marginLeft: '10px', color: '#fbbf24', fontSize: '0.75rem' }}>★ {ep.vote_average.toFixed(1)}</span>
                                    )}
                                </div>
                                <span style={{ color: '#64748b', whiteSpace: 'nowrap', marginLeft: '10px' }}>{ep.air_date || 'TBA'}</span>
                            </div>
                        ))
                    ) : (
                        <div style={{ color: '#64748b', fontSize: '0.85rem', padding: '10px 0' }}>No episode information available.</div>
                    )}
                </div>
            )}
        </div>
    );
}
