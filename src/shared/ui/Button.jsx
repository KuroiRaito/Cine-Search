/**
 * The button, as a thing rather than a convention.
 *
 * `.btn` was applied by hand at 45 sites across 19 files. Nothing owned it,
 * so nothing could be guaranteed about it: whether a <button> inside a form
 * carried `type="button"` and therefore did not submit it, whether the quiet
 * variant was spelled `btn quiet` or `quiet btn`, whether a busy button was
 * also disabled. Forty-five chances to get each of those right, and no way
 * to fix one of them everywhere at once.
 *
 * The API is taken from what the call sites already did, not invented:
 * five of them render a Link or NavLink rather than a <button>, three are
 * full width, two are large, one is a <span> standing in for a button whose
 * answer has not arrived yet. All of that survives; none of it is a new idea.
 */
import { forwardRef } from 'react';

/* `as` is how a button that navigates stays a link. A <button> with an
   onClick that calls navigate() is not a link: it cannot be middle-clicked,
   copied, or opened in a new tab, and a screen reader announces the wrong
   thing. Every site that passed a Link kept it. */
export const Button = forwardRef(function Button({
    as: As = 'button',
    variant = 'primary',
    size = 'md',
    block = false,
    busy = false,
    disabled = false,
    className = '',
    children,
    ...rest
}, ref) {
    const cls = ['btn',
        variant === 'quiet' && 'quiet',
        variant === 'ghost' && 'ghost',
        size === 'lg' && 'btn-lg',
        block && 'block',
        /* `is-waiting` is the placeholder a button leaves while the session
           question has no answer yet -- it holds the space so the header does
           not jump, and it is never interactive. */
        busy && 'is-waiting',
        className,
    ].filter(Boolean).join(' ');

    const props = { ...rest, ref, className: cls };

    if (As === 'button') {
        /* A <button> with no type is type="submit". Inside a form -- and Auth
           has three -- that means every secondary button submits it. This was
           correct at all 45 sites by hand; it is now correct by construction. */
        props.type = rest.type || 'button';
        props.disabled = disabled || busy;
    } else if (disabled || busy) {
        /* A link cannot be disabled. Saying so out loud is better than
           rendering something that looks dead and still navigates. */
        props['aria-disabled'] = 'true';
    }

    if (busy) {
        props['aria-hidden'] = rest['aria-hidden'] ?? 'true';
    }

    return <As {...props}>{children}</As>;
});

export default Button;
