import { useState } from 'react';
import { activeTheme, applyTheme } from './theme.js';
import { Icon } from '../ui/index.js';

/* `onImage` because the cover sits the control on artwork, which has no
   theme -- it needs the glass variant in both light and dark. The cover used
   to get that by repainting `.circ` from `entry.css` with four declarations
   that were byte-for-byte the shell's `.circ.on-image`: the same glass,
   invented twice, neither file aware of the other. Asking for the variant is
   now the only way to get it. */
export default function ThemeToggle({ onImage = false }) {
    const [theme, setTheme] = useState(activeTheme);

    const flip = () => {
        const next = theme === 'light' ? 'dark' : 'light';
        applyTheme(next);
        setTheme(next);
    };

    return (
        <button
            type="button"
            className={onImage ? 'circ on-image' : 'circ'}
            onClick={flip}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
            <Icon name="dark" size={20} />
        </button>
    );
}
