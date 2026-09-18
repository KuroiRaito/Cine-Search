import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountCard } from '../entry';
import { useRegion } from '../../shared/hooks/RegionProvider.jsx';
import { themeSetting, applyTheme } from '../../shared/theme/theme.js';
import './profile.css';
import { Icon } from '../../shared/ui/index.js';

/**
 * Plain and conventional by decision, not by omission — settings has no bespoke
 * design because it does not need one. Standard rows and toggles.
 */
const THEME_ICON = { system: 'settings', light: 'light', dark: 'dark' };
const THEME_LABEL = { system: 'System', light: 'Light', dark: 'Dark' };

export default function Settings() {
    const navigate = useNavigate();
    const { region, setRegion } = useRegion();
    const [theme, setTheme] = useState(themeSetting);

    const flip = (next) => { applyTheme(next); setTheme(next); };

    // Only the countries TMDB actually returns providers for are worth offering;
    // the rest would be a menu of ways to see "not available here".
    const REGIONS = [
        ['IN', 'India'], ['US', 'United States'], ['GB', 'United Kingdom'],
        ['CA', 'Canada'], ['AU', 'Australia'], ['DE', 'Germany'],
        ['FR', 'France'], ['JP', 'Japan'], ['BR', 'Brazil'],
    ];

    return (
        <div className="page">
            <div className="page-head">
                <button type="button" className="circ" onClick={() => navigate(-1)} aria-label="Back"><Icon name="back" size={24} /></button>
                <h1>Settings</h1>
                <span className="head-spacer" />
            </div>

            <div className="setblock">
                <div className="setlabel">Appearance</div>
                {/* Three segments, because the system has three states and the
                    control had two. System is what everybody gets until their
                    first tap; it was the one state nobody could return to. */}
                <div className="segs">
                    {['system', 'light', 'dark'].map((t) => (
                        <button
                            key={t}
                            type="button"
                            className={`seg${theme === t ? ' on st-done' : ''}`}
                            aria-pressed={theme === t}
                            onClick={() => flip(t)}
                        >
                            <Icon name={THEME_ICON[t]} size={20} /><i>{THEME_LABEL[t]}</i>
                        </button>
                    ))}
                </div>
            </div>

            <div className="setblock">
                <label className="setlabel" htmlFor="set-region">Where to watch</label>
                <select
                    id="set-region"
                    className="inp"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                >
                    {REGIONS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
                {/* "Region is stated, not implied" — a silent wrong region is the
                    most confusing failure available, so say where the current
                    one came from. */}
                <p className="hint">
                    Streaming availability is shown for this country. It was detected from
                    your connection, and travelling changes it — set it here to stop that.
                </p>
            </div>

            {/* Theme and region are as useful to a guest as to anyone — they are
                about this browser, not this account. Everything below is not,
                and belongs to the module that owns sessions. */}
            <AccountCard from="/settings" />
        </div>
    );
}
