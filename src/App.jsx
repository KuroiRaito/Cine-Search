import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, NavLink, Link, useLocation } from 'react-router-dom';
// Every screen is a module, loaded on demand through its own index, as its own
// chunk with its own stylesheet. This table is the only place a module is named.
const Discover = lazy(() => import('./modules/discover'));
const SearchPage = lazy(() => import('./modules/search'));
const Title = lazy(() => import('./modules/title'));
const Person = lazy(() => import('./modules/person'));
const Library = lazy(() => import('./modules/library').then((m) => ({ default: m.Library })));
const You = lazy(() => import('./modules/you').then((m) => ({ default: m.You })));
const Settings = lazy(() => import('./modules/you').then((m) => ({ default: m.Settings })));
const Cover = lazy(() => import('./modules/entry').then((m) => ({ default: m.Cover })));
const Auth = lazy(() => import('./modules/entry').then((m) => ({ default: m.Auth })));
// Small, static, and always present: no reason to split these out.
import About from './app/About.jsx';
import NotFound from './app/NotFound.jsx';
import { useAuth } from './shared/auth/AuthProvider.jsx';
import { hasSeenCover } from './app/firstVisit.js';
import ThemeToggle from './shared/theme/ThemeToggle.jsx';
import './shared/theme/tokens.css';
import './app/shell.css';
import './shared/ui/ui.css';

// Tabs appear only on top-level destinations — never on a title or person page,
// which are places you arrive at and come back from.
const TABS = [
    { to: '/', label: 'Discover', icon: '◎' },
    { to: '/search', label: 'Search', icon: '⌕' },
    { to: '/library', label: 'Library', icon: '▤' },
    { to: '/you', label: 'You', icon: '◍' },
];

const isTopLevel = (pathname) => TABS.some((t) => t.to === pathname);

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
                            <span className="ico" aria-hidden="true">{t.icon}</span>
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

export default function App() {
    return (
        <Suspense fallback={null}>
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
                        <Suspense fallback={null}>
                        <Routes>
                            <Route path="/" element={<HomeOrCover />} />
                            <Route path="/search" element={<SearchPage />} />
                            <Route path="/title/:mediaType/:id" element={<Title />} />
                            <Route path="/person/:id" element={<Person />} />
                            <Route path="/library" element={<Library />} />
                            <Route path="/you" element={<You />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/about" element={<About />} />
                            <Route path="*" element={<NotFound />} />
                        </Routes>
                        </Suspense>
                    </Shell>
                    </RequireProfile>
                }
            />
        </Routes>
        </Suspense>
    );
}
