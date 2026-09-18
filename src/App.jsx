import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, NavLink, Link, useLocation } from 'react-router-dom';
// Every screen is a module, loaded on demand through its own index, as its own
// chunk with its own stylesheet. This table is the only place a module is named.
const Discover = lazy(() => import('./modules/discover'));
const SearchPage = lazy(() => import('./modules/search'));
const Title = lazy(() => import('./modules/title'));
const Person = lazy(() => import('./modules/person'));
const Library = lazy(() => import('./modules/library').then((m) => ({ default: m.Library })));
const Profile = lazy(() => import('./modules/profile').then((m) => ({ default: m.Profile })));
const Settings = lazy(() => import('./modules/profile').then((m) => ({ default: m.Settings })));
const Cover = lazy(() => import('./modules/entry').then((m) => ({ default: m.Cover })));
const Auth = lazy(() => import('./modules/entry').then((m) => ({ default: m.Auth })));
// Small, static, and always present: no reason to split these out.
import About from './app/About.jsx';
import NotFound from './app/NotFound.jsx';
import Boundary from './app/Boundary.jsx';
import { useAuth } from './shared/auth/AuthProvider.jsx';
import { hasSeenCover } from './app/firstVisit.js';
import ThemeToggle from './shared/theme/ThemeToggle.jsx';
import './shared/theme/tokens.css';
import './app/shell.css';
import './shared/ui/ui.css';
import { Icon } from './shared/ui/index.js';

// Tabs appear only on top-level destinations — never on a title or person page,
// which are places you arrive at and come back from.
const TABS = [
    { to: '/', label: 'Discover', icon: 'discover' },
    { to: '/search', label: 'Search', icon: 'search' },
    { to: '/library', label: 'Library', icon: 'library' },
    { to: '/you', label: 'You', icon: 'you' },
];

/* The routes that are destinations rather than places you arrive at from one.
   A title page is somewhere you came back from, so tabs there would offer four
   ways to abandon what you just opened. */
const KNOWN = ['/settings', '/about', '/title/', '/person/', '/welcome'];

/**
 * SH13 — an unknown path keeps the tab bar.
 *
 * A page that exists to recover from a wrong turn is the worst place to remove
 * the navigation: the 404 used to arrive with no tabs and exactly one button.
 * It gets the tabs, and keeps the button.
 */
const isTopLevel = (pathname) => TABS.some((t) => t.to === pathname)
    || !KNOWN.some((k) => pathname.startsWith(k));

function Shell({ children }) {
    const { pathname } = useLocation();
    const { isSignedIn, authReady, profile, sessionEnded, dismissSessionEnded } = useAuth();
    const showTabs = isTopLevel(pathname);

    return (
        <div className="app">
            <header className="topbar">
                <div className="topbar-in">
                    <NavLink to="/" className="wordmark"><i />Cine Search</NavLink>
                    <nav className="topnav">
                        {TABS.map((t) => (
                            <NavLink key={t.to} to={t.to} end={t.to === '/'}
                                className={({ isActive }) => (isActive ? 'on' : undefined)}>
                                {t.label}
                            </NavLink>
                        ))}
                    </nav>
                    <span className="topbar-spacer" />
                    <ThemeToggle />
                    {/* Neither "Sign in" nor a username until the session
                        question has an answer. Offering a signed-in person a
                        sign-in button for a second is the app telling them it
                        has forgotten who they are. */}
                    {!authReady ? <span className="btn quiet is-waiting" aria-hidden="true" />
                        : isSignedIn
                            ? <NavLink to="/you" className="btn quiet">{profile?.username || 'You'}</NavLink>
                            : <NavLink to="/welcome/signin" state={{ from: pathname }} className="btn quiet">Sign in</NavLink>}
                </div>
            </header>

            {/* A session that ended on its own — a refresh token revoked,
                expired or used twice. The person did not sign out, so dropping
                them onto a guest screen without a word reads as the app losing
                their library rather than their session. */}
            {sessionEnded && (
                <p className="session-note" role="status">
                    Your session ended.{' '}
                    <Link to="/welcome/signin" state={{ from: pathname }}>Sign in again</Link> to see your library.
                    <button type="button" onClick={dismissSessionEnded} aria-label="Dismiss">×</button>
                </p>
            )}

            <main className="app-main">{children}</main>

            {showTabs && (
                <nav className="tabs" aria-label="Main">
                    {TABS.map((t) => (
                        <NavLink key={t.to} to={t.to} end={t.to === '/'}
                            className={({ isActive }) => `tab-item${isActive ? ' on' : ''}`}>
                            <Icon name={t.icon} size={20} />
                            {t.label}
                        </NavLink>
                    ))}
                </nav>
            )}
        </div>
    );
}

function HomeOrCover() {
    // The cover greets a first visit to the front door — and only the front
    // door. A shared link to a title or person goes straight there: the
    // catalogue is never gated.
    return hasSeenCover() ? <Discover /> : <Navigate to="/welcome" replace />;
}

/**
 * An account with no profile row is a real state, not a corrupt one: Supabase
 * makes the account and we make the profile, so anything that interrupts the
 * gap between them lands here. It used to be a dead end — the person was signed
 * in, nameless, and the only screen that could fix it was the one that told
 * them their email was already registered. Now there is one thing left to do
 * and the app asks for it, wherever they are.
 */
function RequireProfile({ children }) {
    const { needsUsername } = useAuth();
    const { pathname } = useLocation();
    if (needsUsername && !pathname.startsWith('/welcome')) {
        return <Navigate to="/welcome/username" replace state={{ from: pathname }} />;
    }
    return children;
}

/**
 * SH1 — the shell never disappears while something loads.
 *
 * Every route is lazy and the fallback was `null`, so a route change painted
 * literally nothing until its chunk arrived. On a slow connection that is
 * indistinguishable from a crash, and the difference between the two is the
 * only thing the person cares about.
 *
 * The skeleton is the shell's rather than the module's, because the shell
 * cannot know which module is arriving: three blocks at the grid's own
 * geometry, close enough to every screen in the product that nothing jumps
 * more than a few pixels when the real thing lands.
 */
function RouteSkeleton() {
    return (
        <div className="page routewait" aria-busy="true">
            <div className="skel skel-flat" />
            <div className="skel skel-flat" />
            <div className="skel skel-flat" />
        </div>
    );
}

/** Keyed to the pathname, or one broken screen becomes a permanently broken
 *  tab. SH4. */
function RouteBoundary({ children }) {
    const { pathname } = useLocation();
    return <Boundary resetKey={pathname}>{children}</Boundary>;
}

export default function App() {
    return (
        /* SH3 — the last resort. If the shell itself throws, nothing below can
           be trusted: not the router, not the tabs, not a Link. */
        <Boundary level="app">
        <Suspense fallback={<RouteSkeleton />}>
        <Routes>
            <Route path="/welcome" element={<Cover />} />
            <Route path="/welcome/:mode" element={<Auth />} />
            <Route path="/welcome/*" element={<Navigate to="/welcome/signin" replace />} />
            <Route
                path="*"
                element={
                    <RequireProfile>
                    <Shell>
                        {/* A module arrives with its own CSS; until it does the
                            shell holds the space rather than flashing a spinner. */}
                        {/* SH2 — inside the Shell, so a module that throws
                            replaces the content area and nothing else: tabs,
                            top bar and every other route still work. That is
                            the entire point of catching at the route, and the
                            screen should prove it. */}
                        <RouteBoundary>
                        <Suspense fallback={<RouteSkeleton />}>
                        <Routes>
                            <Route path="/" element={<HomeOrCover />} />
                            <Route path="/search" element={<SearchPage />} />
                            <Route path="/title/:mediaType/:id" element={<Title />} />
                            <Route path="/person/:id" element={<Person />} />
                            <Route path="/library" element={<Library />} />
                            <Route path="/you" element={<Profile />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/about" element={<About />} />
                            <Route path="*" element={<NotFound />} />
                        </Routes>
                        </Suspense>
                        </RouteBoundary>
                    </Shell>
                    </RequireProfile>
                }
            />
        </Routes>
        </Suspense>
        </Boundary>
    );
}
