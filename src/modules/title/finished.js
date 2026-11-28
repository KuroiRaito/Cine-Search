/**
 * Asked once, and then not again. L21.
 *
 * "All episodes ticked, still Watching" is a state somebody can sit in happily
 * for months — a series they finished and never filed, or one they are keeping
 * open because a new season is coming. The offer to file it is worth making
 * once. Making it on every visit turns a helpful question into nagging, and the
 * design is explicit that the record is theirs: the app proposes and never
 * assumes.
 *
 * Per title, because finishing The Bear says nothing about Severance.
 *
 * localStorage rather than the library row, deliberately. This is not a fact
 * about the title; it is a fact about one conversation the app has already had
 * on this device. Putting it in the database would mean a schema change, a
 * migration and an RPC parameter to record that somebody tapped "not yet".
 */
const KEY = 'cine_finish_asked';

/* Every read is guarded and every failure yields the empty set, never a
   half-parsed object. In private mode localStorage throws rather than returning
   null, and a corrupt value must mean "nobody has been asked" — asking a
   second time is a small cost, and the alternative is a crash on a page that
   was only trying to be helpful. */
const read = () => {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
        return new Set(Array.isArray(raw) ? raw.filter((k) => typeof k === 'string') : []);
    } catch { return new Set(); }
};

/** The key for one title. Media type included: ids collide across the two. */
export const finishKey = (mediaType, id) => `${mediaType}-${id}`;

export const alreadyAsked = (key) => read().has(key);

export function rememberAsked(key) {
    if (!key) return;
    const next = read();
    next.add(key);
    /* Capped, oldest-out. An unbounded list of every series anybody ever
       finished on this device would grow for ever in a store with a few
       megabytes in it, and the only cost of forgetting the oldest is asking
       one more time about a series watched two hundred titles ago. */
    try {
        localStorage.setItem(KEY, JSON.stringify([...next].slice(-200)));
    } catch { /* private mode */ }
}
