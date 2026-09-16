import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../shared/auth/AuthProvider.jsx';
import { backdropUrl, posterUrl } from '../../shared/tmdb/view.js';
import { COLOURS, colourClass, bannerOf, avatarOf, joinedOn, identityProblem, BIO_MAX, NAME_MAX } from './identity.js';
import './profile.css';

/**
 * The band above everything: banner, face, name, handle, bio.
 *
 * It is drawn before the numbers because identity comes before evidence — and
 * it is drawn at all three session states, because "we don't know who this is
 * yet" must not look like "this is a guest". While restoring, the chrome is
 * there and the figures are not; nothing asserts anything.
 */
export default function Identity({ status }) {
    const { profile, user, authReady } = useAuth();
    const [editing, setEditing] = useState(null);

    const banner = bannerOf(profile);
    const avatar = avatarOf(profile, user);
    // Full class names from a lookup, never interpolated — see colourClass.
    const bannerClass = banner.kind === 'colour' ? `pbanner ${colourClass(banner.colour)}` : 'pbanner';
    const avatarClass = `pav ${colourClass(avatar.colour)}`;
    const waiting = !authReady || status === 'loading';

    const name = profile?.display_name || profile?.username || null;
    const joined = joinedOn(profile?.created_at);

    return (
        <div className="pid">
            <div className={bannerClass}>
                {banner.kind === 'backdrop' && (
                    <img src={backdropUrl(banner.path, 'w780')} alt="" className="pbanner-art" />
                )}
                {/* The name sits on the artwork, which is what makes the banner
                    a nameplate rather than decoration. Nothing readable is ever
                    placed on the unscrimmed part. */}
                <div className="bscrim" aria-hidden="true" />
                {!waiting && (
                    <button type="button" className="bedit" onClick={() => setEditing('banner')}>
                        {banner.unset ? 'Add' : 'Edit'}
                    </button>
                )}
                {!waiting && name && <div className="pname">{name}</div>}
            </div>

            <div className="pav-row">
                <span className={avatarClass} aria-hidden="true">
                    {avatar.kind === 'image'
                        ? <img src={posterUrl(avatar.path, 'w185')} alt="" />
                        : avatar.letter}
                </span>
                <div className="pid-text">
                    {waiting ? (
                        <>
                            <span className="pskel w60" />
                            <span className="pskel w85" />
                        </>
                    ) : (
                        <>
                            <div className="phandle">
                                @{profile?.username || '…'}{joined && <> · {joined}</>}
                            </div>
                            {profile?.bio
                                ? <p className="pbio">{profile.bio}</p>
                                : <p className="pbio ph">Say something about what you watch.</p>}
                        </>
                    )}
                </div>
                {!waiting && (
                    <button type="button" className="pbtn" onClick={() => setEditing('identity')}>Edit</button>
                )}
            </div>

            {editing === 'identity' && <EditIdentity onClose={() => setEditing(null)} />}
            {editing === 'banner' && <PickBanner onClose={() => setEditing(null)} />}
        </div>
    );
}

/* ------------------------------ E1 · E3 · E4 ------------------------------ */

function EditIdentity({ onClose }) {
    const { profile, updateProfile } = useAuth();
    const [displayName, setName] = useState(profile?.display_name || '');
    const [bio, setBio] = useState(profile?.bio || '');
    const [fail, setFail] = useState(null);
    const [busy, setBusy] = useState(false);

    // The handle is not here on purpose: it is claimed at sign-up and changed
    // in Settings, so one module owns it. See src/modules/entry/AccountCard.
    const problem = identityProblem({ displayName, bio });
    const over = bio.length - BIO_MAX;
    const nameBad = problem?.field === 'name';
    const bioBad = problem?.field === 'bio';

    async function save(e) {
        e.preventDefault();
        if (problem || busy) return;
        setBusy(true);
        setFail(null);
        const { error } = await updateProfile({
            display_name: displayName.trim() || null,
            bio: bio.trim() || null,
        });
        setBusy(false);
        // E4: every typed value survives, and the button says what pressing it
        // would do now.
        if (error) return setFail('Couldn’t save that. Check your connection and try again.');
        return onClose();
    }

    return (
        <Sheet title="Edit profile" onClose={onClose}>
            <form onSubmit={save} noValidate>
                <label className="field" htmlFor="pf-name">
                    <span className="field-top">Display name</span>
                    <input
                        id="pf-name" className="searchbox" type="text" value={displayName}
                        maxLength={NAME_MAX + 20} autoFocus
                        aria-invalid={nameBad || undefined}
                        onChange={(e) => { setName(e.target.value); setFail(null); }}
                    />
                    <span className={nameBad ? 'field-hint bad' : 'field-hint'}>
                        {nameBad ? problem.message : 'Shown above your handle. Optional.'}
                    </span>
                </label>

                <label className="field" htmlFor="pf-bio">
                    <span className="field-top">
                        Bio
                        {/* E3: the counter turns and shows the overage. Nothing
                            is truncated for you — losing the end of a sentence
                            you wrote is worse than being told it is too long. */}
                        <em className={over > 0 ? 'cnt bad' : 'cnt'}>
                            {over > 0 ? `${over} over` : `${bio.length} / ${BIO_MAX}`}
                        </em>
                    </span>
                    <textarea
                        id="pf-bio" className="searchbox pf-bio" value={bio} rows={4}
                        aria-invalid={bioBad || undefined}
                        onChange={(e) => { setBio(e.target.value); setFail(null); }}
                    />
                    <span className={bioBad ? 'field-hint bad' : 'field-hint'}>
                        {bioBad ? problem.message : 'Plain text. Four lines show before “more”.'}
                    </span>
                </label>

                {fail && <p className="form-error" role="alert"><span>{fail}</span></p>}

                <button type="submit" className="btn block" disabled={busy || Boolean(problem)}>
                    {busy ? 'Saving…' : fail ? 'Try again' : 'Save'}
                </button>
            </form>
        </Sheet>
    );
}

/* --------------------------------- E5 ---------------------------------- */

/**
 * Three sources, in the order §06 offers them. Upload is drawn in the design
 * and deliberately absent here: it needs a Storage bucket that does not exist,
 * and a still from something you actually watched is the more personal answer
 * on a film tracker anyway.
 */
function PickBanner({ onClose }) {
    const { profile, updateProfile } = useAuth();
    const [busy, setBusy] = useState(false);
    const current = bannerOf(profile);

    async function choose(kind, value) {
        if (busy) return;
        setBusy(true);
        await updateProfile({ banner_kind: kind, banner_value: value });
        setBusy(false);
        onClose();
    }

    return (
        <Sheet title="Choose a banner" onClose={onClose}>
            <p className="sheet-body">
                A still from something you watched, or a colour. Never a stock photograph.
            </p>
            <div className="swatches">
                {COLOURS.map((c) => {
                    const on = current.kind === 'colour' && current.colour === c.key && !current.unset;
                    return (
                        <button
                            key={c.key} type="button"
                            className={on ? `swatch ${colourClass(c.key)} on` : `swatch ${colourClass(c.key)}`}
                            aria-pressed={on}
                            onClick={() => choose('colour', c.key)}
                        >{c.label}</button>
                    );
                })}
            </div>
            {/* Picking from the library needs the favourites shelves to exist,
                which is step 3. Said plainly rather than shown as a dead tab. */}
            <p className="field-hint">Choosing a still from your library arrives with favourites.</p>
        </Sheet>
    );
}

/* -------------------------------- chrome -------------------------------- */

function Sheet({ title, children, onClose }) {
    const box = useRef(null);
    useEffect(() => {
        const opener = document.activeElement;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
        };
    }, [onClose]);

    return (
        <div className="scrim" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
            <div className="sheet" ref={box} onClick={(e) => e.stopPropagation()}>
                <div className="grab" />
                <h2 className="sheet-title">{title}</h2>
                {children}
            </div>
        </div>
    );
}
