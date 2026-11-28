import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { person as fetchPerson } from '../../shared/tmdb/endpoints.js';
import { toPersonView } from '../../shared/tmdb/view.js';
import { useAsync } from '../../shared/hooks/useAsync.js';
import { Tile, Skeleton, Empty, initialsOf, Button} from '../../shared/ui/index.js';
import { SignInPrompt } from '../entry';
import { useAuth } from '../../shared/auth/AuthProvider.jsx';
import { usePersonFavourite } from '../profile';
import { useLibrary, useTileStates, useQuickAdd } from '../library';
import { collectionProgress } from '../library';
import { wikiSummary } from '../../shared/wiki/wiki.js';
import {
    leadRoles, rankOf, hasProgress, evidenceLine, activeYears, allCredits,
} from './people.js';
import { capOf, useGridColumns, useLineClamp } from './shape.js';
import './person.css';
import { Icon } from '../../shared/ui/index.js';

export default function Person() {
    const { id } = useParams();
    const navigate = useNavigate();
    /* null is "All" — the stacked view. §06 TP4 draws the chips and the
       sections together: the chips narrow, they do not replace. */
    const [role, setRole] = useState(null);
    const [unseenOnly, setUnseenOnly] = useState(false);
    const [prompt, setPrompt] = useState(null);
    /* The biography is five lines up front and the whole thing on request.
       `bio` is null until the paragraph has been measured, and null means no
       button — so a biography that was never measured is simply shown, rather
       than being put behind a control that does not know if it has anything
       to open. */
    const [bioOpen, setBioOpen] = useState(false);
    const [bioRef, bio] = useLineClamp();
    const onAdd = useQuickAdd((x) => setPrompt({ title: x.title, poster: x.poster, action: 'save' }));
    const stateFor = useTileStates();
    const { isSignedIn, authReady } = useAuth();
    const lib = useLibrary();

    const { data, error, loading, retry } = useAsync(
        ({ signal }) => fetchPerson(id, { signal }).then(toPersonView),
        [id],
    );

    // After the fetch it reads from, and before any early return: hooks do not
    // get to be conditional, and `data` does not exist until the line above.
    const fav = usePersonFavourite(data);

    /* The one label worth having, because a human wrote it. Absent for plenty
       of people, and the evidence line below never leans on it. */
    const wiki = useAsync(
        ({ signal }) => wikiSummary(data?.wikidataId, { signal }),
        [data?.wikidataId],
        { skip: !data?.wikidataId },
    ).data;

    if (loading) {
        return (
            <div className="page">
                <div className="phead">
                    <Skeleton h={68} w={68} className="skel-round" />
                    <div className="skel-lines">
                        <Skeleton h={20} w="60%" /><Skeleton h={12} w="40%" />
                    </div>
                </div>
                <div className="card"><Skeleton h={120} /></div>
            </div>
        );
    }

    if (error) {
        const gone = error?.status === 404;
        return (
            <Empty
                title={gone ? 'We couldn’t find that person' : 'Something went wrong'}
                body={gone ? 'They may have been removed from TMDB, or the link may be wrong.' : 'The Movie Database didn’t answer.'}
                action={gone
                    ? <Button as={Link} to="/">Go to Discover</Button>
                    : <Button onClick={retry}>Try again</Button>}
            />
        );
    }

    const p = data;
    /* Heaviest first, with talk shows out of the weighing. The sections and the
       chips take the same order, so the page reads the same top to bottom as it
       does left to right. */
    const roles = leadRoles(p.roles);
    const shown = role ? roles.filter((r) => r.key === role) : roles;
    const credits = allCredits(roles);
    const isSeen = (it) => lib.entryFor(it.mediaType, it.id)?.status === 'watched';
    const seenAll = credits.filter(isSeen).length;
    const years = activeYears(roles);
    const evidence = evidenceLine(roles);

    return (
        <div className="page">
            <div className="page-head">
                <button type="button" className="circ" onClick={() => navigate(-1)} aria-label="Back"><Icon name="back" size={24} /></button>
            </div>

            {/* Who they are, as one block. On a phone it stacks — face and
                name, then the biography under it. On desktop the right half
                of this row is empty space, so the biography moves into it
                rather than pushing the filmography down; that is a two-column
                rule on `.pintro` in person.css, and it is design's to write.
                Without the rule this is a plain div and the page is the phone
                layout at every width, which is the layout it had before. */}
            <div className="pintro">
            <div className="phead">
                <div className="avatar">
                    {p.photo ? <img src={p.photo} alt="" fetchPriority="high" /> : initialsOf(p.name)}
                </div>
                <div className="phead-text">
                    <h1>{p.name}</h1>
                    {/* §05: no job title anywhere. known_for_department calls
                        Greta Gerwig an actor despite Barbie and Lady Bird, and
                        TMDB's own known_for agrees with it — both are
                        popularity-shaped and both lag a career turning. What
                        goes here instead is a human's line if there is one, and
                        then a list, which cannot be wrong because it is not a
                        claim. */}
                    {wiki?.description && <div className="sub">{wiki.description}</div>}
                    {evidence && <div className="evidence">{evidence}</div>}
                </div>
                {/* Actors and crew share one shelf on the profile, so this is
                    the same control on everybody's page. Hidden for a guest
                    rather than raising a sheet: there is no title here for one
                    to name. */}
                {fav.canFavourite && (
                    <button
                        type="button"
                        className="ibtn like"
                        aria-pressed={fav.on}
                        aria-label={fav.on ? `Remove ${p.name} from favourites` : `Add ${p.name} to favourites`}
                        onClick={fav.toggle}
                    ><Icon name="heart" size={20} /></button>
                )}
            </div>

            {/* Who they are, next to their face, rather than at the foot of a
                filmography nobody scrolls to the end of. Five lines is about
                as much as the first screen can give it without the
                filmography leaving that screen — and the clamp is what makes
                the move an improvement instead of a longer page: moved up and
                unclamped, a 2,000-character biography pushes the work itself
                below the fold, which is the opposite of the point.

                `.section` is shared (shell.css) and purely positional. The
                clamp is `.bio.bio-clamp` in this module's own stylesheet,
                because a clamp is a paint decision — `verify` check 5 refuses
                `maxHeight` from JSX and is right to.

                `.linkish` and not a Button: this reveals the rest of a
                paragraph, which is not the weight of a call to action. It is
                the control the product already uses for "see all" on the
                profile's favourites shelf. */}
            {p.biography && (
                <div className="section">
                    <p className={`bio${bioOpen ? '' : ' bio-clamp'}`} ref={bioRef}>{p.biography}</p>
                    {bio?.overflows && (
                        <button type="button" className="linkish" onClick={() => setBioOpen((v) => !v)}>
                            {bioOpen ? 'View less' : 'View more'}
                        </button>
                    )}
                </div>
            )}
            </div>

            <div className="pstats">
                <div><b>{p.creditCount || credits.length}</b><span>Credits</span></div>
                {/* A guest must never see "0 seen" — a real number that happens
                    to be a lie about them. */}
                {isSignedIn && <div><b>{seenAll}</b><span>You have seen</span></div>}
                {years && <div><b>{years}</b><span>Active</span></div>}
            </div>

            {roles.length > 0 && (
                <>
                    {/* TP7. The role chips come from the credit counts, so one
                        body of work means one chip and no row. "Not seen" is the
                        one that earns its place: "show me the twenty Villeneuve
                        films I have not watched" is the actual task, and it is
                        the only question this page can answer that no other
                        page can. */}
                    {(roles.length > 1 || isSignedIn) && (
                        <div className="rolesw" aria-label="Filters">
                            {roles.length > 1 && (
                                <button
                                    type="button" className="sw"
                                    aria-pressed={role === null}
                                    onClick={() => setRole(null)}
                                >All</button>
                            )}
                            {roles.length > 1 && roles.map((r) => (
                                <button
                                    key={r.key}
                                    type="button"
                                    className="sw"
                                    aria-pressed={role === r.key}
                                    onClick={() => setRole(r.key)}
                                >
                                    {r.label}<em>{rankOf(r)}</em>
                                </button>
                            ))}
                            {isSignedIn && (
                                <button
                                    type="button"
                                    className="sw"
                                    aria-pressed={unseenOnly}
                                    onClick={() => setUnseenOnly((v) => !v)}
                                >Not seen</button>
                            )}
                        </div>
                    )}

                    {/* Stacked, heaviest first, and each section keeps its own
                        cohort's rules — so Gerwig gets a bar on Directed and a
                        plain list on Acted in. */}
                    {shown.map((r) => (
                        <Body
                            key={r.key}
                            role={r}
                            lib={lib}
                            unseenOnly={unseenOnly}
                            isSeen={isSeen}
                            isSignedIn={isSignedIn}
                            onAdd={onAdd}
                            stateFor={stateFor}
                        />
                    ))}
                    {authReady && !isSignedIn && (
                        <p className="track-hint">Sign in to track what you&apos;ve seen</p>
                    )}
                </>
            )}

            {/* Somebody real, with nothing this page can show: every credit is
                a documentary appearance or an interview under the relevance
                bar. Saying so beats a name over blank space, and the
                biography above is then the whole page rather than an
                afterthought. */}
            {roles.length === 0 && (
                <p className="track-hint">
                    {p.creditCount > 0
                        ? `TMDB lists ${p.creditCount} credits, none with enough detail to show here yet.`
                        : 'TMDB has no credits for them yet.'}
                </p>
            )}

            {prompt && <SignInPrompt {...prompt} onClose={() => setPrompt(null)} />}
        </div>
    );
}

/**
 * One body of work, with the rules that body of work takes.
 *
 * The bar is the whole difference between the cohorts. "6 of 26 directed" is a
 * canon somebody works through; "6 of 202 scored" is not a claim anybody makes,
 * and an actor's filmography is not a canon either.
 */
function Body({ role, lib, unseenOnly, isSeen, isSignedIn, onAdd, stateFor }) {
    const { seen, total, pct } = collectionProgress(role, lib.entryFor);
    const items = unseenOnly ? role.items.filter((it) => !isSeen(it)) : role.items;
    const bar = hasProgress(role.key) && isSignedIn && total > 0;

    /* Two rows, per section rather than per page: Gerwig gets a cap on
       Directed and another on Acted in, because they are two bodies of work
       and one of them being short is not a reason to bury the other.

       The hidden tiles are sliced out of the array, not clipped by a height.
       A CSS cap would leave them in the DOM — focusable by Tab and read by a
       screen reader, which is a worse page than the uncapped one. */
    const [open, setOpen] = useState(false);
    const [gridRef, cols] = useGridColumns();
    const cap = capOf(cols);
    const over = cap !== null && items.length > cap;
    const visible = over && !open ? items.slice(0, cap) : items;

    return (
        <>
            <div className="collectbar">
                <div className="cb-t">
                    <b>{role.label}</b>
                    <span>{bar ? `${seen} of ${total} seen` : role.items.length}</span>
                </div>
                {bar && <div className="cb-track"><i style={{ width: `${pct}%` }} /></div>}
                {bar && (
                    <div className="cb-sub">
                        {seen === total ? 'All of it' : `${total - seen} to go`}
                        {role.filteredOut > 0 && ` · ${role.filteredOut} credit${role.filteredOut === 1 ? '' : 's'} filtered out`}
                    </div>
                )}
            </div>
            {items.length ? (
                <>
                    <div className="grid filmography" ref={gridRef}>
                        {visible.map((it) => (
                            <Tile key={`${it.mediaType}-${it.id}`} item={it} onAdd={onAdd} state={stateFor(it)} />
                        ))}
                    </div>
                    {/* Search puts a quiet Button under its results grid, and
                        that was the precedent here until Raman looked at it:
                        a page with three sections gets three of these, and
                        three call-to-action buttons down one page is a lot of
                        shouting for "there is more of this list". `.linkish`
                        is the same control the profile uses for "see all",
                        and it matches the biography's toggle above — one page
                        should not reveal things two different ways. */}
                    {over && (
                        <div className="pad stack">
                            <button type="button" className="linkish" onClick={() => setOpen((v) => !v)}>
                                {open ? 'Show fewer' : `Show all ${items.length}`}
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <p className="track-hint">Nothing left here — you have seen all of it.</p>
            )}
        </>
    );
}
