import { useState } from 'react';
import { activeTheme, applyTheme } from './theme.js';
import { Icon } from '../ui/index.js';

export default function ThemeToggle() {
    const [theme, setTheme] = useState(activeTheme);

    const flip = () => {
        const next = theme === 'light' ? 'dark' : 'light';
        applyTheme(next);
        setTheme(next);
    };

    return (
        <button
            type="button"
            className="circ"
            onClick={flip}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
            <Icon name="dark" size={20} />
        </button>
    );
}
