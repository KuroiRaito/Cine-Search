import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
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
    const { isSignedIn, profile } = useAuth();
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
                    {isSignedIn
                        ? <NavLink to="/you" className="btn quiet">{profile?.username || 'You'}</NavLink>
                        : <NavLink to="/welcome/signin" state={{ from: pathname }} className="btn quiet">Sign in</NavLink>}
                </div>
            </header>

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

export default function App() {
    return (
        <Suspense fallback={null}>
        <Routes>
            <Route path="/welcome" element={<Cover />} />
            <Route path="/welcome/:mode" element={<Auth />} />
            <Route
                path="*"
                element={
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
                }
            />
        </Routes>
        </Suspense>
    );
}
