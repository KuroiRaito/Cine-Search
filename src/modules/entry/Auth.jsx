import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link, useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthProvider.jsx';
import { markSeen } from '../../app/firstVisit.js';
import { humanError, signUpOutcome, failureKind, RATE_LIMIT_WAIT } from './messages.js';
import { emailProblem, passwordProblem, usernameProblem, PASSWORD_RULES } from './rules.js';
import { supabase } from '../../shared/auth/supabaseClient.js';
import './entry.css';

/**
 * One screen, five steps, one flow.
 *
 * Signing in, creating an account, recovering a password, setting a new one and
 * naming yourself are not five features — they are five places the same person
 * can be standing, and every one of them is reachable from the others. Keeping
 * them in one component is what makes "where do I go from here" answerable at
 * every step rather than at the two the first draft happened to cover.
 *
 * Every state below is numbered in docs/foundations.html §12: I1–I14 for sign
 * in, U1–U11 for sign up. The numbers are load-bearing — scripts/auth-cases.mjs
 * drives them by name.
 */
const STEPS = {
    signin: {
        title: 'Welcome back',
        lede: 'Sign in to pick up where you left off.',
        submit: 'Sign in',
        fields: ['email', 'password'],
    },
    signup: {
        title: 'Create your account',
        lede: 'Your library is private by default.',
        submit: 'Create account',
        fields: ['username', 'email', 'password'],
    },
    forgot: {
        title: 'Reset your password',
        lede: 'We’ll email you a link to set a new one.',
        submit: 'Send the link',
        fields: ['email'],
    },
    reset: {
        title: 'Set a new password',
        lede: 'Choose something you haven’t used here before.',
        submit: 'Save and sign in',
        fields: ['password'],
    },
    username: {
        title: 'Pick a username',
        // Only ever reached by an account that has no profile row, which means
        // something went wrong last time or the name was taken. Say so.
        lede: 'Your account is ready — it just needs a name.',
        submit: 'Save',
        fields: ['username'],
    },
};

export const isStep = (mode) => Object.hasOwn(STEPS, mode);

/**
 * Where to go afterwards. Only ever a path inside this app, and never back to
 * the door we just came through — `/welcome` sending you to `/welcome` is a
 * loop you cannot leave without the address bar.
 */
export function safeFrom(from) {
    if (typeof from !== 'string') return '/';
    if (!from.startsWith('/') || from.startsWith('//')) return '/';
    if (from.startsWith('/welcome')) return '/';
    return from;
}

/**
 * The hint slot is reserved at render and holds one of three things: the
 * standing hint, the problem with this field, or nothing. Swapping between
 * them must never change the field's height, or every field below it jumps
 * down the screen at the moment the person is reading.
 */
function Field({ id, label, problem, show, hint, note, aside, children }) {
    const bad = show && problem;
    return (
        <label className="field" htmlFor={id}>
            <span className="field-top">
                {label}
                {/* A link about this field, beside this field. "Forgotten your
                    password?" in a stack of three accent links under the submit
                    button is three equal offers; here it is one answer, next to
                    the question it answers. */}
                {aside}
            </span>
            {children}
            {bad
                ? <span className="field-hint bad" role="alert">{problem}</span>
                : <span className="field-hint">{hint || ' '}</span>}
            {note && <span className="field-note">{note}</span>}
        </label>
    );
}

/**
 * A password you cannot read is a password you cannot correct. Half of "I typed
 * it wrong" is not knowing that you did.
 *
 * Caps Lock rides along because it is the other half: the single commonest way
 * to type a password you are certain is right. It is a caption, never an error
 * — nothing is wrong yet.
 */
function PasswordInput({ id, value, onChange, onBlur, onCaps, autoComplete, describedBy, invalid, readOnly }) {
    const [visible, setVisible] = useState(false);
    const watchCaps = (e) => {
        if (typeof e.getModifierState === 'function') onCaps(e.getModifierState('CapsLock'));
    };
    return (
        <span className="pw-wrap">
            <input
                id={id}
                className="searchbox"
                type={visible ? 'text' : 'password'}
                value={value}
                autoComplete={autoComplete}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                readOnly={readOnly}
                onChange={onChange}
                onBlur={onBlur}
                onKeyDown={watchCaps}
                onKeyUp={watchCaps}
            />
            <button
                type="button"
                className="pw-peek"
                aria-pressed={visible}
                aria-label={visible ? 'Hide password' : 'Show password'}
                onClick={() => setVisible((v) => !v)}
                tabIndex={readOnly ? -1 : 0}
            >
                {visible ? 'Hide' : 'Show'}
            </button>
        </span>
    );
}

export default function Auth() {
    const { mode } = useParams();
    const step = STEPS[mode] ? mode : 'signin';
    const config = STEPS[step];

    const navigate = useNavigate();
    const location = useLocation();
    const auth = useAuth();
    const back = safeFrom(location.state?.from);

    const [values, setValues] = useState({ email: '', password: '', username: '' });
    const [touched, setTouched] = useState({});
    // One object, not a string: three of the twelve failures change the submit
    // button as well as the message above it, and one of them belongs under a
    // field rather than in a banner at all.
    const [fail, setFail] = useState(null);
    const [done, setDone] = useState(null);
    const [busy, setBusy] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [caps, setCaps] = useState(false);
    const [blockedUntil, setBlockedUntil] = useState(0);
    const [waitLeft, setWaitLeft] = useState(0);

    const bannerRef = useRef(null);
    // A second submit while the first is in flight creates two accounts, or
    // burns a rate limit on a request that already succeeded. `busy` state
    // repaints a frame too late to stop the second Enter; this does not.
    const inFlight = useRef(false);
    // I13: pressing back mid-submit. The request cannot be recalled — Supabase's
    // client takes no abort signal — but nothing it comes back with may be
    // written, so returning to this screen shows I1 and never a stuck I3.
    const alive = useRef(true);
    // Set on the way in as well as cleared on the way out: StrictMode mounts,
    // unmounts and remounts in development, and a ref that is only ever
    // cleared stays cleared through the second mount — which left every
    // submit stuck reading "One moment…" forever.
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; };
    }, []);

    // The banner takes focus when it appears. Somebody who submitted with the
    // keyboard is at the button, which is below it, and a message you have to
    // scroll back up to find has not been delivered.
    useEffect(() => { if (fail && !fail.field) bannerRef.current?.focus(); }, [fail]);

    // I5: the wait is real, so the button is honestly unavailable for it
    // rather than inviting a press that will be refused again — and it says
    // how long is left, because a dead button with no clock is
    // indistinguishable from a broken one.
    useEffect(() => {
        if (!blockedUntil) return undefined;
        const update = () => setWaitLeft(Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000)));
        update();
        const t = setInterval(update, 500);
        return () => clearInterval(t);
    }, [blockedUntil]);

    // Nobody should be standing at a door they are already through.
    //
    // Three conditions, and each one is a bug that happened. `authReady`,
    // because redirecting while the session is still restoring bounces a guest
    // off the sign-in form they asked for. A *settled* profile, because signing
    // up creates the session a beat before the profile row, and reading
    // "signed in, no profile needed" in that beat threw the person off their
    // own sign-up form — taking the error message with it. And not while a
    // submit is in flight, for the same reason from the other direction.
    const profileSettled = auth.profileState === 'ready' || auth.profileState === 'error';
    const settled = auth.authReady && !busy;

    if (!isStep(mode)) return <Navigate to="/welcome/signin" replace state={{ from: back }} />;
    if (settled && auth.isSignedIn && profileSettled
        && (step === 'signin' || step === 'signup' || step === 'forgot')) {
        return <Navigate to={back} replace />;
    }
    if (settled && step === 'username' && auth.authReady && !auth.isSignedIn) {
        return <Navigate to="/welcome/signin" replace state={{ from: back }} />;
    }
    if (settled && step === 'username' && profileSettled && !auth.needsUsername) {
        return <Navigate to={back} replace />;
    }

    const set = (k) => (e) => {
        setValues((v) => ({ ...v, [k]: e.target.value }));
        // A message about what you just changed is out of date the moment you
        // change it — but a rate limit is about the clock, not the field, so
        // it survives being typed over.
        setFail((f) => (f && f.kind === 'rate-limit' ? f : null));
    };
    const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));

    const strengthChecked = step === 'signup' || step === 'reset';
    const problems = {
        email: config.fields.includes('email') ? emailProblem(values.email) : null,
        password: config.fields.includes('password')
            ? passwordProblem(values.password, { checkStrength: strengthChecked }) : null,
        username: config.fields.includes('username') ? usernameProblem(values.username) : null,
    };
    const firstProblem = config.fields.map((f) => problems[f]).find(Boolean) || null;

    // What a field shows and whether it is ringed. A server's answer about one
    // field ("that username is taken") outranks the client's, which cannot
    // know it.
    const problemFor = (f) => (fail?.field === f ? fail.message : problems[f]);
    const showProblem = (f) => Boolean(fail?.field === f || (touched[f] && (!strengthChecked || f !== 'password' || submitted)));
    const invalidFor = (f) => Boolean(fail?.ring === f || (showProblem(f) && problemFor(f)));

    /**
     * Ask whether a username is free before creating an account with it.
     *
     * Optional on purpose: the check is a database function, and if it hasn't
     * been applied yet this returns "don't know" and the flow carries on. The
     * unique index is the real guarantee; this only moves the bad news to
     * before the account exists instead of after.
     */
    async function usernameTaken(name) {
        try {
            const { data, error: rpcError } = await supabase
                .rpc('username_available', { candidate: name });
            if (rpcError) return false;
            return data === false;
        } catch {
            return false;
        }
    }

    /** Every failure goes through here, so the button and the ring stay in step
     *  with the sentence. */
    function reportFailure(error, { field } = {}) {
        if (!alive.current) return undefined;
        const kind = failureKind(error);
        const message = humanError(error);

        if (kind === 'rate-limit') setBlockedUntil(Date.now() + RATE_LIMIT_WAIT * 1000);
        if (kind === 'username-taken' || field) {
            return setFail({ message, kind, field: field || 'username' });
        }
        // I2: the password is cleared after a refused sign-in. It is the one
        // value that does not survive an error, and people expect that.
        if (kind === 'credentials') {
            setValues((v) => ({ ...v, password: '' }));
            // And untouched, or the field we just emptied immediately accuses
            // the person of leaving it blank — underneath a banner already
            // explaining what actually happened.
            setTouched((t) => ({ ...t, password: false }));
            return setFail({ message, kind, ring: 'password' });
        }
        return setFail({ message, kind });
    }

    async function submit(e) {
        e.preventDefault();
        if (inFlight.current || waitLeft > 0) return;

        setTouched(Object.fromEntries(config.fields.map((f) => [f, true])));
        setSubmitted(true);
        if (firstProblem) {
            // A button that does nothing is a broken button. Every problem is
            // named under the field it belongs to — said once, not twice — and
            // the cursor goes to the first one so the fix is one keystroke away
            // rather than one hunt away.
            setFail(null);
            const bad = config.fields.find((f) => problems[f]);
            document.getElementById(`auth-${bad}`)?.focus();
            return;
        }

        inFlight.current = true;
        setFail(null);
        setBusy(true);
        try {
            await run();
        } catch (err) {
            reportFailure(err);
        } finally {
            inFlight.current = false;
            if (alive.current) setBusy(false);
        }
    }

    async function run() {
        const email = values.email.trim();
        const username = values.username.trim();

        if (step === 'signin') {
            const { error: err } = await auth.signIn(email, values.password);
            if (err) return reportFailure(err);
            return leave();
        }

        if (step === 'forgot') {
            const { error: err } = await auth.requestPasswordReset(email);
            // A different answer for an address with an account and one without
            // would turn this form into a way to test whether someone is here.
            if (err && failureKind(err) === 'rate-limit') return reportFailure(err);
            return finish({
                title: 'Check your email',
                body: `If ${email} has an account, a link to set a new password is on its way. It expires in an hour.`,
                resend: () => auth.requestPasswordReset(email),
            });
        }

        if (step === 'reset') {
            const { error: err } = await auth.setPassword(values.password);
            if (err) return reportFailure(err);
            auth.endRecovery();
            return leave('/');
        }

        if (step === 'username') {
            const { error: err } = await auth.claimUsername(username);
            if (err) return reportFailure(err, { field: 'username' });
            return leave();
        }

        // signup
        if (await usernameTaken(username)) {
            if (!alive.current) return undefined;
            setTouched((t) => ({ ...t, username: true }));
            return setFail({ message: 'That username is taken. Try another.', kind: 'username-taken', field: 'username' });
        }

        const outcome = signUpOutcome(await auth.signUp(email, values.password));
        if (outcome.kind === 'error') {
            if (!alive.current) return undefined;
            return setFail({ message: outcome.message, kind: outcome.reason || 'other' });
        }
        if (outcome.kind === 'confirm-email') {
            return finish({
                title: 'Check your email',
                body: `We sent a confirmation link to ${email}. Open it to finish setting up your account.`,
                resend: () => auth.resendConfirmation(email),
            });
        }

        const { error: profileErr } = await auth.claimUsername(username, outcome.user?.id);
        if (profileErr) {
            // The account exists and we are signed into it. Sending them back to
            // "create an account" would tell them the email is already taken —
            // by themselves, thirty seconds ago. There is exactly one thing left
            // to do, so ask for that one thing.
            if (!alive.current) return undefined;
            setValues((v) => ({ ...v, password: '' }));
            setTouched({});
            setFail({
                message: 'Your account is ready, but the username didn’t save. Pick one to finish.',
                kind: failureKind(profileErr),
            });
            navigate('/welcome/username', { replace: true, state: { from: back } });
            return undefined;
        }
        return leave();
    }

    function finish(panel) {
        if (alive.current) setDone(panel);
        return undefined;
    }

    function leave(to = back) {
        markSeen();
        navigate(to, { replace: true });
    }

    // `navigate(-1)` walks out of the app entirely when this page was opened
    // from a link or typed in. react-router numbers its own history entries, so
    // index 0 means there is nothing of ours behind us.
    const canGoBack = (window.history.state?.idx ?? 0) > 0;
    const goBack = () => (canGoBack ? navigate(-1) : navigate(back, { replace: true }));

    /* ---- U4: the flow succeeded but is not finished. One icon, one
            sentence, one action — and the action is the thing they are
            waiting on, not a door out. ---- */
    if (done) return <Done panel={done} back={back} onBack={goBack} />;

    // A reset link that has expired leaves the person on this screen with no
    // session behind it. Saying "set a new password" to someone who cannot
    // would waste the one attempt they think they have.
    const resetWithoutLink = step === 'reset' && !auth.recovering && !auth.isSignedIn;

    const submitLabel = busy ? 'One moment…'
        : fail?.kind === 'offline' ? 'Try again'
            : config.submit;

    return (
        <div className="page">
            <div className="page-head">
                <button type="button" className="circ" onClick={goBack} aria-label="Back">‹</button>
            </div>

            <div className="auth-body">
                <h1>{config.title}</h1>
                <p className="auth-lede">{config.lede}</p>

                {resetWithoutLink ? (
                    <>
                        <p className="auth-error" role="alert">
                            This link has expired or has already been used.
                        </p>
                        <Link className="btn block" to="/welcome/forgot" state={{ from: back }}>
                            Send a new link
                        </Link>
                    </>
                ) : (
                <>
                {/* `busy` dims and freezes the fields rather than disabling
                    them: a disabled field drops out of the tab order, so the
                    keyboard lands somewhere unrelated and the person loses
                    their place for the second the request takes. */}
                <form className={`auth-form${busy ? ' busy' : ''}`} onSubmit={submit} noValidate>
                    {config.fields.includes('username') && (
                        <Field
                            id="auth-username" label="Username"
                            problem={problemFor('username')} show={showProblem('username')}
                        >
                            <input
                                id="auth-username" className="searchbox" type="text"
                                value={values.username} autoComplete="username"
                                maxLength={24} autoFocus={step === 'username'}
                                readOnly={busy}
                                aria-invalid={invalidFor('username') || undefined}
                                onChange={set('username')} onBlur={blur('username')}
                            />
                        </Field>
                    )}

                    {config.fields.includes('email') && (
                        <Field
                            id="auth-email" label="Email"
                            problem={problemFor('email')} show={showProblem('email')}
                        >
                            <input
                                id="auth-email" className="searchbox" type="email"
                                value={values.email} autoComplete="email" inputMode="email"
                                readOnly={busy}
                                aria-invalid={invalidFor('email') || undefined}
                                onChange={set('email')} onBlur={blur('email')}
                            />
                        </Field>
                    )}

                    {config.fields.includes('password') && (
                        <Field
                            id="auth-password"
                            label={step === 'reset' ? 'New password' : 'Password'}
                            problem={problemFor('password')} show={showProblem('password')}
                            note={caps ? 'Caps Lock is on.' : null}
                            aside={step === 'signin' && (
                                <Link className="field-aside" to="/welcome/forgot" state={{ from: back }}>
                                    Forgotten?
                                </Link>
                            )}
                        >
                            <PasswordInput
                                id="auth-password" value={values.password}
                                autoComplete={step === 'signin' ? 'current-password' : 'new-password'}
                                describedBy={strengthChecked ? 'pw-rules' : undefined}
                                invalid={invalidFor('password')}
                                readOnly={busy}
                                onCaps={setCaps}
                                onChange={set('password')} onBlur={blur('password')}
                            />
                        </Field>
                    )}

                    {/* Stated up front, and ticked off as you type. Letting
                        someone type a password, submit, and only then learn the
                        rule is a wall you walk into rather than one you can see. */}
                    {strengthChecked && (
                        <ul id="pw-rules" className="pw-rules">
                            {PASSWORD_RULES.map((r) => {
                                const met = r.test(values.password);
                                return (
                                    <li key={r.id} className={met ? 'met' : undefined}>
                                        <span aria-hidden="true">{met ? '✓' : '○'}</span>
                                        {r.label}
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {fail && !fail.field && (
                        <p className="auth-error" role="alert" tabIndex={-1} ref={bannerRef}>
                            <span>
                                {fail.message}
                                {fail.kind === 'email-taken' && (
                                    <> <Link to="/welcome/signin" state={{ from: back }}>Sign in</Link></>
                                )}
                            </span>
                        </p>
                    )}

                    <button type="submit" className="btn block" disabled={busy || waitLeft > 0}>
                        {waitLeft > 0 ? `Try again in ${waitLeft}s` : submitLabel}
                    </button>
                </form>

                {(step === 'signin' || step === 'signup') && (
                    <p className="auth-alt">
                        {step === 'signup' ? 'Already have an account? ' : 'New here? '}
                        <Link
                            to={step === 'signup' ? '/welcome/signin' : '/welcome/signup'}
                            state={{ from: back }}
                        >
                            {step === 'signup' ? 'Sign in' : 'Create one'}
                        </Link>
                    </p>
                )}

                {step === 'forgot' && (
                    <p className="auth-alt">
                        <Link to="/welcome/signin" state={{ from: back }}>Back to sign in</Link>
                    </p>
                )}

                {/* Someone part-way through naming an account has nowhere else
                    to be: browsing now would leave them signed in with no
                    profile, which is the state this step exists to end. */}
                {step !== 'username' && step !== 'reset' && (
                    <p className="auth-alt quiet">
                        <Link to={back} onClick={markSeen}>Keep browsing without an account</Link>
                    </p>
                )}
                </>
                )}
            </div>
        </div>
    );
}

/**
 * The third error placement: replaces the screen. Used when the flow succeeded
 * but is not finished here — a link is in an inbox and nothing on this page can
 * advance it. One icon, one sentence, one action.
 */
function Done({ panel, back, onBack }) {
    const [state, setState] = useState('idle');

    async function again() {
        setState('sending');
        const { error } = await panel.resend();
        setState(error ? 'failed' : 'sent');
    }

    return (
        <div className="page">
            <div className="page-head">
                <button type="button" className="circ" onClick={onBack} aria-label="Back">‹</button>
            </div>
            <div className="auth-body auth-done">
                <div className="done-mark" aria-hidden="true">✓</div>
                <h1>{panel.title}</h1>
                <p className="auth-lede">{panel.body}</p>

                {panel.resend && (
                    <button type="button" className="btn quiet block" onClick={again} disabled={state === 'sending' || state === 'sent'}>
                        {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Sent again' : 'Resend the link'}
                    </button>
                )}
                {state === 'failed' && (
                    <p className="auth-error" role="alert"><span>Couldn’t send it again. Try in a minute.</span></p>
                )}

                <p className="auth-alt quiet">
                    <Link to={back} onClick={markSeen}>Keep browsing without an account</Link>
                </p>
            </div>
        </div>
    );
}
