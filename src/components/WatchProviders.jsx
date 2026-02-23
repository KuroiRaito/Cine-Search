import React, { useState, useEffect } from 'react';
import { getWatchProviders } from '../lib/tmdb';

const providerCache = new Map();

export default function WatchProviders({ id, type, region }) {
    const [providers, setProviders] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!id || !type || !region) return;

        const cacheKey = `${id}-${type}-${region}`;
        if (providerCache.has(cacheKey)) {
            setProviders(providerCache.get(cacheKey));
            return;
        }

        let isMounted = true;
        setIsLoading(true);

        getWatchProviders(id, type).then(results => {
            if (!isMounted) return;

            // Tiered fallback: local -> US -> null
            let data = results[region];
            if (!data || Object.keys(data).length === 0) {
                console.log(`[WatchProviders] No data for region ${region}, falling back to US.`);
                data = results['US'];
            } else {
                console.log(`[WatchProviders] Found local data for region ${region}.`, data);
            }

            if (!data || Object.keys(data).length === 0) {
                console.log(`[WatchProviders] No data found for US either. Rendering null state.`);
                providerCache.set(cacheKey, null);
                setProviders(null);
                setIsLoading(false);
                return;
            }

            const streaming = data.flatrate || [];
            const rent = data.rent || [];
            const buy = data.buy || [];

            // Deduplication and logo check
            const formatProviders = (arr) => {
                return arr.filter(p => p.logo_path).reduce((acc, current) => {
                    const x = acc.find(item => item.provider_id === current.provider_id);
                    if (!x) {
                        return acc.concat([current]);
                    } else {
                        return acc;
                    }
                }, []);
            };

            const cleanStreaming = formatProviders(streaming);
            const streamingIds = new Set(cleanStreaming.map(p => p.provider_id));

            const cleanRent = formatProviders(rent).filter(p => !streamingIds.has(p.provider_id));
            const rentIds = new Set(cleanRent.map(p => p.provider_id));

            const cleanBuy = formatProviders(buy).filter(p => !streamingIds.has(p.provider_id) && !rentIds.has(p.provider_id));

            const finalData = {
                streaming: cleanStreaming,
                rent: cleanRent,
                buy: cleanBuy
            };

            providerCache.set(cacheKey, finalData);
            setProviders(finalData);
            setIsLoading(false);
        }).catch(err => {
            console.error('Failed to parse providers', err);
            if (isMounted) {
                setProviders(null);
                setIsLoading(false);
            }
        });

        return () => { isMounted = false; };
    }, [id, type, region]);

    if (isLoading) {
        return <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '15px' }}>Loading providers...</div>;
    }

    if (!providers || (providers.streaming.length === 0 && providers.rent.length === 0 && providers.buy.length === 0)) {
        return (
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#0f172a', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#f8fafc' }}>Where to Watch</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Not available for streaming/purchase in your region.</p>
            </div>
        );
    }

    const renderGroup = (title, items) => {
        if (items.length === 0) return null;
        return (
            <div style={{ marginBottom: '15px' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.5px' }}>{title}</span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {items.map(p => (
                        <div key={p.provider_id} title={p.provider_name}>
                            <img
                                src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                                alt={p.provider_name}
                                style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #334155', backgroundColor: '#fff' }}
                            />
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1rem', color: '#f8fafc' }}>Where to Watch</h3>
            {renderGroup('Streaming', providers.streaming)}
            {renderGroup('Rent', providers.rent)}
            {renderGroup('Buy', providers.buy)}
        </div>
    );
}
