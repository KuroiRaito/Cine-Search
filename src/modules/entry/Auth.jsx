import { useState, useRef } from 'react';
import { useNavigate, useLocation, Link, useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthProvider.jsx';
import { markSeen } from '../../app/firstVisit.js';
import { humanError, signUpOutcome } from './messages.js';
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

function Field({ id, label, problem, show, hint, children }) {
    const bad = show && problem;
    return (
        <label className="field" htmlFor={id}>
            <span>{label}</span>
            {children}
            {hint && !bad && <span className="field-hint">{hint}</span>}
            {bad && <span className="field-error" role="alert">{problem}</span>}
        </label>
    );
}

/**
 * A password you cannot read is a password you cannot correct. Half of "I typed
 * it wrong" is not knowing that you did.
 */
function PasswordInput({ id, value, onChange, onBlur, autoComplete, describedBy }) {
    const [visible, setVisible] = useState(false);
    return (
        <span className="pw-wrap">
            <input
                id={id}
                className="searchbox"
                type={visible ? 'text' : 'password'}
                value={value}
                autoComplete={autoComplete}
                aria-describedby={describedBy}
                onChange={onChange}
                onBlur={onBlur}
            />
            <button
                type="button"
                className="pw-peek"
                aria-pressed={visible}
                aria-label={visible ? 'Hide password' : 'Show password'}
                onClick={() => setVisible((v) => !v)}
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
    const [error, setError] = useState(null);
    const [done, setDone] = useState(null);
    const [busy, setBusy] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    // A second submit while the first is in flight creates two accounts, or
    // burns a rate limit on a request that already succeeded. `busy` state
    // repaints a frame too late to stop the second Enter; this does not.
    const inFlight = useRef(false);

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
        // An error about what you just changed is out of date the moment you
        // change it.
        setError(null);
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

    async function submit(e) {
        e.preventDefault();
        if (inFlight.current) return;

        setTouched(Object.fromEntries(config.fields.map((f) => [f, true])));
        setSubmitted(true);
        if (firstProblem) {
            // A button that does nothing is a broken button. Every problem is
            // now named under the field it belongs to — said once, not twice —
            // and the cursor goes to the first one so the fix is one keystroke
            // away rather than one hunt away.
            setError(null);
            const bad = config.fields.find((f) => problems[f]);
            document.getElementById(`auth-${bad}`)?.focus();
            return;
        }

        inFlight.current = true;
        setError(null);
        setBusy(true);
        try {
            await run();
        } catch (err) {
            setError(humanError(err));
        } finally {
            inFlight.current = false;
            setBusy(false);
        }
    }

    async function run() {
        const email = values.email.trim();
        const username = values.username.trim();

        if (step === 'signin') {
            const { error: err } = await auth.signIn(email, values.password);
            if (err) return setError(humanError(err));
            return leave();
        }

        if (step === 'forgot') {
            const { error: err } = await auth.requestPasswordReset(email);
            // A different answer for an address with an account and one without
            // would turn this form into a way to test whether someone is here.
            if (err && err.status === 429) return setError(humanError(err));
            return setDone({
                title: 'Check your email',
                body: `If ${email} has an account, a link to set a new password is on its way. It expires in an hour.`,
            });
        }

        if (step === 'reset') {
            const { error: err } = await auth.setPassword(values.password);
            if (err) return setError(humanError(err));
            auth.endRecovery();
            return leave('/');
        }

        if (step === 'username') {
            const { error: err } = await auth.claimUsername(username);
            if (err) return setError(humanError(err));
            return leave();
        }

        // signup
        if (await usernameTaken(username)) {
            setTouched((t) => ({ ...t, username: true }));
            return setError('That username is taken. Try another.');
        }

        const outcome = signUpOutcome(await auth.signUp(email, values.password));
        if (outcome.kind === 'error') return setError(outcome.message);
        if (outcome.kind === 'confirm-email') {
            return setDone({
                title: 'Confirm your email',
                body: `We sent a link to ${email}. Open it to finish creating your account.`,
            });
        }

        const { error: profileErr } = await auth.claimUsername(username, outcome.user?.id);
        if (profileErr) {
            // The account exists and we are signed into it. Sending them back to
            // "create an account" would tell them the email is already taken —
            // by themselves, thirty seconds ago. There is exactly one thing left
            // to do, so ask for that one thing.
            setValues((v) => ({ ...v, password: '' }));
            setTouched({});
            setError(humanError(profileErr));
            navigate('/welcome/username', { replace: true, state: { from: back } });
            return undefined;
        }
        return leave();
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

    if (done) {
        return (
            <div className="page">
                <div className="page-head">
                    <button type="button" className="circ" onClick={goBack} aria-label="Back">‹</button>
                </div>
                <div className="auth-body">
                    <h1>{done.title}</h1>
                    <p className="auth-lede">{done.body}</p>
                    <Link className="btn block" to={back} onClick={markSeen}>Keep browsing</Link>
                    <p className="auth-alt">
                        <Link to="/welcome/signin" state={{ from: back }}>Back to sign in</Link>
                    </p>
                </div>
            </div>
        );
    }

    // A reset link that has expired leaves the person on this screen with no
    // session behind it. Saying "set a new password" to someone who cannot
    // would waste the one attempt they think they have.
    const resetWithoutLink = step === 'reset' && !auth.recovering && !auth.isSignedIn;

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
                <form className="auth-form" onSubmit={submit} noValidate>
                    {config.fields.includes('username') && (
                        <Field
                            id="auth-username" label="Username"
                            problem={problems.username} show={touched.username}
                        >
                            <input
                                id="auth-username" className="searchbox" type="text"
                                value={values.username} autoComplete="username"
                                maxLength={24} autoFocus={step === 'username'}
                                onChange={set('username')} onBlur={blur('username')}
                            />
                        </Field>
                    )}

                    {config.fields.includes('email') && (
                        <Field
                            id="auth-email" label="Email"
                            problem={problems.email} show={touched.email}
                        >
                            <input
                                id="auth-email" className="searchbox" type="email"
                                value={values.email} autoComplete="email" inputMode="email"
                                onChange={set('email')} onBlur={blur('email')}
                            />
                        </Field>
                    )}

                    {config.fields.includes('password') && (
                        <Field
                            id="auth-password"
                            label={step === 'reset' ? 'New password' : 'Password'}
                            problem={problems.password} show={touched.password && (!strengthChecked || submitted)}
                        >
                            <PasswordInput
                                id="auth-password" value={values.password}
                                autoComplete={step === 'signin' ? 'current-password' : 'new-password'}
                                describedBy={strengthChecked ? 'pw-rules' : undefined}
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

                    {error && <p className="auth-error" role="alert">{error}</p>}

                    <button type="submit" className="btn block" disabled={busy}>
                        {busy ? 'One moment…' : config.submit}
                    </button>
                </form>

                {step === 'signin' && (
                    <p className="auth-alt">
                        <Link to="/welcome/forgot" state={{ from: back }}>Forgotten your password?</Link>
                    </p>
                )}

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
                    <p className="auth-alt">
                        <Link to={back} onClick={markSeen}>Keep browsing without an account</Link>
                    </p>
                )}
                </>
                )}
            </div>
        </div>
    );
}
