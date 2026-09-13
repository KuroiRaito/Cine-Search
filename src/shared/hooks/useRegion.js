import { useState, useEffect } from 'react';

export function useRegion() {
    const [region, setRegionState] = useState(() => localStorage.getItem('user_region') || 'US');
    const [isResolving, setIsResolving] = useState(!localStorage.getItem('user_region'));

    useEffect(() => {
        if (localStorage.getItem('user_region')) {
            return;
        }

        let isMounted = true;
        const fetchRegion = async () => {
            try {
                const res = await fetch('https://ipapi.co/json/');
                if (res.ok) {
                    const data = await res.json();
                    if (data.country_code && isMounted) {
                        setRegionState(data.country_code);
                        localStorage.setItem('user_region', data.country_code);
                        setIsResolving(false);
                        return;
                    }
                }
            } catch (err) {
                console.warn('IP lookup failed, falling back to browser', err);
            }

            if (isMounted) {
                const browserLang = navigator.language || navigator.userLanguage;
                let fallbackRegion = 'US';
                if (browserLang && browserLang.includes('-')) {
                    fallbackRegion = browserLang.split('-')[1].toUpperCase();
                } else if (browserLang) {
                    fallbackRegion = browserLang.toUpperCase();
                    if (fallbackRegion === 'EN') fallbackRegion = 'US';
                }

                setRegionState(fallbackRegion);
                localStorage.setItem('user_region', fallbackRegion);
                setIsResolving(false);
            }
        };

        fetchRegion();

        return () => { isMounted = false; };
    }, []);

    const setRegion = (newRegion) => {
        if (!newRegion) return;
        setRegionState(newRegion);
        localStorage.setItem('user_region', newRegion);
    };

    return { region, setRegion, isResolving };
}
