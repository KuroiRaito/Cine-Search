/**
 * Which attribute says "this one is selected".
 *
 * C4. There is one answer per role, and it is not a class:
 *
 *   a toggle button        aria-pressed
 *   an option in a tablist aria-selected
 *   the link to this page   aria-current   (React Router writes this itself)
 *
 * `aria-pressed` is not a supported attribute on `role="tab"`, and that was a
 * live defect: Library's shelf filters are a tablist and carried
 * `role="tab"` with `aria-pressed`, so the state was announced with an
 * attribute the role does not define. Both stylesheets now select on
 * `:is([aria-pressed="true"], [aria-selected="true"])`, so picking the right
 * one is free -- it changes what a screen reader hears and nothing else.
 *
 * The class spelling is gone everywhere. It was never a second safety net:
 * it was a second chance to be wrong, and the one control where the two
 * disagreed looked unselected for months without anybody seeing it.
 */
export function selectionAttr(role) {
    return role === 'tab' || role === 'option' ? 'aria-selected' : 'aria-pressed';
}

export default selectionAttr;
