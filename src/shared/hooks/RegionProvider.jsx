import { createContext, useContext, useEffect, useState } from 'react';
import { onCountry } from '../tmdb/client.js';

/**
 * Region is one value, held by the shell.
 *
 * SH8 — useRegion was a hook with its own useState, called in three places, so
 * three screens each held their own copy synchronised by nothing but
 * localStorage at mount. Change it in Settings and Discover kept showing the
 * old country until it happened to remount: two screens, two answers, one
 * question.
 *
 * SH7 — and the value itself no longer costs a request to a stranger. It used
 * to come from ipapi.co, fetched on first load before anybody had tapped
 * anything, sending the visitor's IP to a company this product has no
 * relationship with, with no consent and no mention anywhere in the interface.
 * It now rides a call the app already makes: /api/tmdb runs on our own
 * deployment, Vercel hands that function the requester's country, and it echoes
 * it back on every response.
 *
 * Same technique, same accuracy, one request fewer, one company fewer, and
 * nothing to disclose.
 */

const RegionContext = createContext(null);
const KEY = 'user_region';

/* In local development there is no Vercel edge, so no header arrives. The time
   zone is the fallback — local, free, and a far better locator than language:
   a phone in Mumbai set to English (United States) says en-US and
   Asia/Kolkata, and only one of those is about where it is. */
function fromTimeZone() {
    try {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        return ZONES[zone] || ZONES[zone.split('/')[0]] || null;
    } catch {
        return null;
    }
}

/* Short and honest: the places this product is actually for, plus the regions
   whose zone prefix is unambiguous. Anything else waits for the header. */
const ZONES = {
    'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Colombo': 'LK',
    'Asia/Karachi': 'PK', 'Asia/Dhaka': 'BD', 'Asia/Kathmandu': 'NP',
    'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN',
    'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR',
    'Europe/Berlin': 'DE', 'Europe/Madrid': 'ES', 'Europe/Rome': 'IT',
    'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU',
    'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Sao_Paulo': 'BR',
    US: 'US', Canada: 'CA', Australia: 'AU',
};

const stored = () => {
    try { return localStorage.getItem(KEY); } catch { return null; }
};

export function RegionProvider({ children }) {
    /* A choice outranks a guess, always and permanently. Nothing here ever
       overwrites a region somebody set in Settings. */
    const [chosen, setChosen] = useState(stored);
    const [guessed, setGuessed] = useState(fromTimeZone);

    useEffect(() => onCountry((code) => setGuessed(code)), []);

    const setRegion = (code) => {
        if (!code) return;
        setChosen(code);
        try { localStorage.setItem(KEY, code); } catch { /* private mode */ }
    };

    const value = {
        region: chosen || guessed || 'US',
        setRegion,
        /* Whether anybody actually said so. A block that names the country can
           offer a one-tap correction when it is a guess, and say nothing when
           it is not. SH7. */
        chosen: Boolean(chosen),
    };

    return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

export function useRegion() {
    const ctx = useContext(RegionContext);
    /* A default rather than a throw: a screen rendered outside the provider —
       a test, a story — should draw, not explode. */
    return ctx || { region: 'US', setRegion: () => {}, chosen: false };
}
