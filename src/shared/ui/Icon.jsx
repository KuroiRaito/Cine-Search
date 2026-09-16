/**
 * One icon, one box.
 *
 * Before this, every icon in the product was a Unicode text character borrowed
 * from whatever block had something roughly the right shape — twenty glyphs
 * across five unrelated blocks. Measured at a single 100px font size they
 * painted between 10px and 86px tall, a 8.6x spread, with 48px of drift
 * between their optical centres. The search icon was U+2315 TELEPHONE
 * RECORDER, painting 44px where the discover icon beside it painted 86.
 *
 * Lucide draws every icon on one 24px grid at one stroke weight, so the box is
 * the only thing that decides how big an icon looks.
 *
 * Imports are named rather than dynamic on purpose: a `lucide-react` map keyed
 * by string pulls the whole package into the bundle. This way only what is
 * listed here ships.
 */
import {
    ArrowRight, BookMarked, Bookmark, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
    CircleCheck, CirclePause, CirclePlay, CircleUser, CircleX, Compass, Ellipsis, Film, GripVertical,
    Heart, Minus, Moon, Pencil, Plus, RotateCcw, Search, Settings, Star, Sun, Tv, X,
} from 'lucide-react';

/** Role → drawing. The role is what the product calls it; the icon can change. */
const ICONS = {
    // navigation
    discover: Compass, search: Search, library: BookMarked, you: CircleUser,
    back: ChevronLeft, forward: ChevronRight, up: ChevronUp, down: ChevronDown,
    // the six watch states — six distinct silhouettes, not six hues
    want: Bookmark, watching: CirclePlay, watched: CircleCheck,
    rewatched: RotateCcw, hold: CirclePause, dropped: CircleX,
    // rating and liking
    star: Star, heart: Heart,
    // actions
    add: Plus, remove: Minus, edit: Pencil, close: X, check: Check,
    more: Ellipsis, reorder: GripVertical, go: ArrowRight, settings: Settings,
    // kind and chrome
    film: Film, series: Tv, dark: Moon, light: Sun,
};

export const ICON_NAMES = Object.keys(ICONS);

/**
 * @param {string}  name   a role from ICONS
 * @param {16|20|24} size  --icon-16 / 20 / 24. Nothing else.
 * @param {string}  label  read aloud. Omit for decoration, and the icon is hidden.
 */
export default function Icon({ name, size = 20, label, className = '' }) {
    const Glyph = ICONS[name];
    if (!Glyph) return null;

    // A 2px stroke on a 24 grid becomes 1.33px at 16, which lands between
    // pixels and goes soft. Lift it rather than ship a second icon set.
    const strokeWidth = size <= 16 ? 2.25 : 2;

    return (
        <Glyph
            className={`icon ${className}`.trim()}
            width={size}
            height={size}
            strokeWidth={strokeWidth}
            aria-hidden={label ? undefined : 'true'}
            role={label ? 'img' : undefined}
            aria-label={label}
            focusable="false"
        />
    );
}
