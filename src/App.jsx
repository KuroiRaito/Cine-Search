import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import Discover from './routes/Discover.jsx';
import SearchPage from './routes/SearchPage.jsx';
import Title from './routes/Title.jsx';
import Person from './routes/Person.jsx';
import Cover from './routes/Cover.jsx';
import Stub from './routes/Stub.jsx';
import NotFound from './routes/NotFound.jsx';
import { hasSeenCover } from './lib/firstVisit.js';
import './styles/tokens.css';
import './styles/base.css';

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
                    <NavLink to="/welcome" className="btn quiet">Sign in</NavLink>
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
        <Routes>
            <Route path="/welcome/*" element={<Cover />} />
            <Route
                path="*"
                element={
                    <Shell>
                        <Routes>
                            <Route path="/" element={<HomeOrCover />} />
                            <Route path="/search" element={<SearchPage />} />
                            <Route path="/title/:mediaType/:id" element={<Title />} />
                            <Route path="/person/:id" element={<Person />} />
                            <Route path="/library" element={<Stub what="Library" />} />
                            <Route path="/you" element={<Stub what="You" />} />
                            <Route path="*" element={<NotFound />} />
                        </Routes>
                    </Shell>
                }
            />
        </Routes>
    );
}
