/**
 * The identity band's rules — the ones that are decisions rather than markup.
 * docs/profile-module.html §06 and §09.
 */

/**
 * Six gradients from the scales, and never a stock photograph.
 *
 * This is the honest default for a banner: a person who has chosen nothing
 * gets a surface that looks chosen, rather than an empty box apologising for
 * itself. The keys are stored, not the CSS — a palette change should not have
 * to migrate anybody's profile.
 */
export const COLOURS = [
    { key: 'dusk', label: 'Dusk' },
    { key: 'beam', label: 'Beam' },
    { key: 'gold', label: 'Gold' },
    { key: 'moss', label: 'Moss' },
    { key: 'rust', label: 'Rust' },
    { key: 'ink', label: 'Ink' },
];

const isColour = (k) => COLOURS.some((c) => c.key === k);

/**
 * Key to class, written out rather than interpolated.
 *
 * `bg-${key}` builds a name no tool can see: `npm run verify` reads it as a
 * class called "bg-", and it is right to — a class assembled at runtime is a
 * class nothing can check, style-sweep or delete safely.
 */
const BG = {
    dusk: 'bg-dusk', beam: 'bg-beam', gold: 'bg-gold',
    moss: 'bg-moss', rust: 'bg-rust', ink: 'bg-ink',
};

export const colourClass = (key) => BG[key] || BG.dusk;

/**
 * What to draw behind the name. Three kinds, and an unknown kind falls back
 * rather than rendering nothing: a banner is furniture, and furniture that
 * disappears because a value was unexpected is worse than plain furniture.
 */
export function bannerOf(profile) {
    const kind = profile?.banner_kind;
    const value = profile?.banner_value;
    if (kind === 'backdrop' && value) return { kind: 'backdrop', path: value };
    if (kind === 'colour' && isColour(value)) return { kind: 'colour', colour: value };
    return { kind: 'colour', colour: 'dusk', unset: true };
}

/**
 * The avatar is an initial until it is not.
 *
 * No identicon and no stock silhouette. The letter comes from the display
 * name, and the gradient behind it from the account id — so it is stable for a
 * person, different between people, and needs no request. Absent is the
 * designed state, not a failure.
 */
export function avatarOf(profile, user) {
    if (profile?.avatar_path) return { kind: 'image', path: profile.avatar_path };
    const name = (profile?.display_name || profile?.username || user?.email || '?').trim();
    return { kind: 'initial', letter: firstGrapheme(name), colour: colourForId(profile?.id) };
}

/**
 * The first character a reader would call the first character.
 *
 * `name[0]` splits a surrogate pair and an emoji renders as half of itself;
 * 神谷 must render 神, not a replacement box. Intl.Segmenter is the only thing
 * that gets this right, and it has been in every browser we support since 2022.
 */
export function firstGrapheme(value) {
    const s = String(value || '').trim();
    if (!s) return '?';
    try {
        const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
        const [first] = seg.segment(s);
        return (first?.segment || s[0]).toUpperCase();
    } catch {
        return s[0].toUpperCase();
    }
}

function colourForId(id) {
    const s = String(id || '');
    let h = 0;
    for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return COLOURS[h % COLOURS.length].key;
}

/** §09: a limit enforced only in a sheet is not enforced — but it is enforced
 *  in the sheet too, because the database refusing is a worse way to find out. */
export const BIO_MAX = 1000;
export const NAME_MAX = 40;

export function identityProblem({ displayName, bio }) {
    const n = (displayName || '').trim();
    if (n.length > NAME_MAX) return { field: 'name', message: `${n.length - NAME_MAX} characters too long.` };
    const b = bio || '';
    if (b.length > BIO_MAX) return { field: 'bio', message: `${b.length - BIO_MAX} characters too long.` };
    return null;
}

/** "joined Mar 2026", or "joined today" on the day itself. */
export function joinedOn(created) {
    if (!created) return null;
    const d = new Date(created);
    if (Number.isNaN(d.getTime())) return null;
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    if (sameDay) return 'joined today';
    return `joined ${d.toLocaleString(undefined, { month: 'short', year: 'numeric' })}`;
}
