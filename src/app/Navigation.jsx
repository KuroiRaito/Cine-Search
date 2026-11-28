import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { isClamp, reachable } from './restore.js';

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

        /* The page getting shorter is not the person scrolling up.
           
           This listener writes under the outgoing entry's key until React runs
           this effect again — and the DOM swap happens first. So when a tall
           list is replaced by a shorter page, the browser clamps the scroll
           position to the new maximum, that clamp raises a scroll event, and
           the event lands here while `leaving` still points at the list. The
           position recorded for the list was therefore whatever the *next*
           page could hold, which for a title page arriving at the top is zero.

           Measured, not reasoned: three pages into Browse at y=946.5, the map
           held 0 for that entry. Every restore in this app was reading a
           position destroyed by the navigation it was meant to survive, which
           is why the feature looked like "scroll restore is flaky" rather than
           like a bug with a cause.

           So a scroll event is ignored when the document just got shorter and
           the new position is the most that document can hold — that pair is a
           clamp, and a clamp is the page moving, not the person. */
        let tall = document.documentElement.scrollHeight;
        const remember = () => {
            const height = document.documentElement.scrollHeight;
            const before = tall;
            tall = height;
            if (isClamp(window.scrollY, height, window.innerHeight, before)) return;
            positions.set(leaving.current, window.scrollY);
        };

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
           
           So it waits: each frame, take the focus if a heading has appeared,
           and restore the position once the document is tall enough to hold
           it. It stops as soon as both are done.

           It used to stop after a second either way, and the reason given was
           not to fight somebody who had started scrolling themselves. That is
           the right thing to avoid and the wrong way to detect it. A second is
           a guess about how long a fetch takes, and on the screen this matters
           most — three pages deep in Browse, where every page has to come back
           before the document is tall enough — it is a guess that is wrong on
           any connection worse than a desk.

           So it watches for the person instead of the clock. A wheel, a touch
           or a key is somebody taking over, and restoring under them would be
           rude; our own scrollTo raises none of those. The timer stays as a
           backstop at five seconds, for a fetch that never answers at all. */
        let done = target === 0;
        let focused = false;
        let taken = false;
        const until = performance.now() + 5000;
        let frame;

        /* Input events, deliberately, not 'scroll' — scroll fires for our own
           restore too, so listening for it would cancel the thing it is meant
           to protect. */
        const takeOver = () => { taken = true; };
        const INPUT = ['wheel', 'touchstart', 'keydown'];
        INPUT.forEach((e) => window.addEventListener(e, takeOver, { passive: true }));

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
            /* Follow the document down as it grows, rather than waiting for
               one perfect moment and latching.

               The previous rule restored only once the page was tall enough to
               put the target at the top of the viewport:

                   scrollHeight >= target + innerHeight

               which a position at the bottom of a list can never satisfy. The
               greatest legal scrollY is exactly scrollHeight - innerHeight, so
               for a target at the very bottom the test is asking whether a
               number is greater than itself — and measured on a real page it
               failed by half a pixel: 1714 >= 1714.5. Three pages into Browse,
               at the bottom, tapping a film and coming back restored nothing,
               and that is the single most likely way to arrive here.

               So: each frame, go as close to the target as the document can
               currently hold, and keep going as the rest of it arrives. There
               is no moment to pick correctly, which means there is no moment
               to pick wrongly — a clamped early guess is corrected by the next
               frame instead of being the final answer. It is finished only
               when the page can hold the whole position. */
            if (!done) {
                const here = reachable(target, document.documentElement.scrollHeight, window.innerHeight);
                if (Math.abs(window.scrollY - here) > 1) window.scrollTo(0, here);
                done = here >= target;
            }
            if ((!done || !focused) && !taken && performance.now() < until) {
                frame = requestAnimationFrame(settle);
            }
        };

        window.scrollTo(0, back ? window.scrollY : 0);
        frame = requestAnimationFrame(settle);

        setAnnounced(nameOf(location.pathname));
        return () => {
            cancelAnimationFrame(frame);
            INPUT.forEach((e) => window.removeEventListener(e, takeOver));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.key]);

    /* Polite, so it waits for the reader to finish its sentence. Visually
       hidden with the same idiom every screen-reader utility uses. */
    return <p className="vh" role="status" aria-live="polite">{announced}</p>;
}
