import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * What should happen between two routes, and did not.
 *
 * SH11 — a push scrolls to the top, moves focus to the heading, and says the
 * name of the page.
 * SH12 — a pop restores where you were.
 *
 * Both halves matter and they are different mechanisms: a new destination gets
 * a new scroll position, and going back gets the one you left. Today neither
 * happened, so opening a title from halfway down Discover landed you halfway
 * down the title page, and coming back put you at the top of a list you had
 * scrolled through.
 *
 * The focus half is the larger one. Focus stayed wherever it was, which for
 * somebody using a screen reader means a tab press silently replaces the page:
 * the content changes, nothing is announced, and the cursor is still on a
 * control that no longer exists. The design calls it the single largest
 * accessibility gap in the product.
 */

/* Keyed by the history entry, not the path: two visits to /library are two
   entries with two scroll positions, and the same path can be on the stack
   twice. Kept in memory rather than sessionStorage — a restored position from
   a previous session would point into a list that has since changed. */
const positions = new Map();

/** The name a route announces. Derived rather than declared, so a route added
 *  without a name still says something true. */
function nameOf(pathname) {
    if (pathname === '/') return 'Discover';
    if (pathname.startsWith('/search')) return 'Search';
    if (pathname.startsWith('/library')) return 'Library';
    if (pathname.startsWith('/you')) return 'You';
    if (pathname.startsWith('/settings')) return 'Settings';
    if (pathname.startsWith('/title/')) return 'Title';
    if (pathname.startsWith('/person/')) return 'Person';
    if (pathname.startsWith('/about')) return 'About';
    return 'Page';
}

export default function Navigation() {
    const location = useLocation();
    const type = useNavigationType();
    const [announced, setAnnounced] = useState('');
    const leaving = useRef(location.key);

    /* Remember where the outgoing entry was before the new one paints. A
       listener rather than a read on unmount, because by the time an effect
       cleanup runs the browser may already have scrolled. */
    useEffect(() => {
        leaving.current = location.key;
        const remember = () => positions.set(leaving.current, window.scrollY);
        window.addEventListener('scroll', remember, { passive: true });
        return () => {
            remember();
            window.removeEventListener('scroll', remember);
        };
    }, [location.key]);

    useEffect(() => {
        const back = type === 'POP';
        const target = back ? positions.get(location.key) ?? 0 : 0;

        /* Every route in this app is lazy and most of them fetch, so at the
           moment the location changes there is no heading to focus and no
           height to scroll into — which is exactly what the first version did,
           landing focus on <body> and the scroll at zero.
           
           So it waits, briefly and on a budget: each frame, take the focus if a
           heading has appeared, and restore the position once the document is
           tall enough to hold it. It stops as soon as both are done, and gives
           up after a second either way rather than fighting somebody who has
           started scrolling themselves. */
        let done = target === 0;
        let focused = false;
        const until = performance.now() + 1000;
        let frame;

        const settle = () => {
            if (!focused) {
                /* Made focusable only for this, and never a tab stop: tabIndex
                   -1 takes focus programmatically and stays out of the tab
                   order. It is a destination for the page change, not a
                   control. */
                const heading = document.querySelector('.page-head h1, h1');
                if (heading) {
                    heading.setAttribute('tabindex', '-1');
                    heading.focus({ preventScroll: true });
                    focused = true;
                }
            }
            if (!done && document.documentElement.scrollHeight >= target + window.innerHeight) {
                window.scrollTo(0, target);
                done = true;
            }
            if ((!done || !focused) && performance.now() < until) {
                frame = requestAnimationFrame(settle);
            }
        };

        window.scrollTo(0, back ? window.scrollY : 0);
        frame = requestAnimationFrame(settle);

        setAnnounced(nameOf(location.pathname));
        return () => cancelAnimationFrame(frame);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.key]);

    /* Polite, so it waits for the reader to finish its sentence. Visually
       hidden with the same idiom every screen-reader utility uses. */
    return <p className="vh" role="status" aria-live="polite">{announced}</p>;
}
