import { useState } from 'react';
import { useNavigate, useLocation, Link, useParams } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthProvider.jsx';
import { markSeen } from '../../app/firstVisit.js';
import './entry.css';

/** Supabase's own wording is for developers. These are for people. */
function humanError(message = '') {
    const m = message.toLowerCase();
    if (m.includes('already registered') || m.includes('already been registered')) {
        return 'That email already has an account. Try signing in instead.';
    }
    if (m.includes('invalid login')) return 'That email and password don’t match.';
    // The database gate on auth.users raises before the account exists;
    // Supabase reports it as a generic database error.
    if (m.includes('database error saving new user') || m.includes('by invitation')) {
        return 'Sign-ups are by invitation. Ask Raman to add your email.';
    }
    // Supabase spells this one out in full, character class by character class.
    if (m.includes('password should contain')) {
        return 'Passwords need an uppercase letter, a lowercase letter, a number and a symbol.';
    }
    if (m.includes('password should be') || m.includes('at least 6')) {
        return 'Passwords need at least 6 characters.';
    }
    if (m.includes('duplicate key') || m.includes('profiles_username')) {
        return 'That username is taken. Try another.';
    }
    if (m.includes('unable to validate email') || m.includes('invalid email')) {
        return 'That doesn’t look like an email address.';
    }
    return message || 'Something went wrong. Try again.';
}

export default function Auth() {
    const { mode } = useParams();
    const isSignUp = mode === 'signup';
    const navigate = useNavigate();
    const location = useLocation();
    const { signIn, signUp, createProfile } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    // Where the person was when they hit a wall. They go back there, not to a
    // generic home — arriving somewhere you didn't ask for is its own small
    // punishment for signing up.
    const back = location.state?.from || '/';

    async function submit(e) {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            if (isSignUp) {
                const { data, error: signUpErr } = await signUp(email.trim(), password);
                if (signUpErr) throw signUpErr;
                const { error: profileErr } = await createProfile(username.trim(), data?.user?.id);
                if (profileErr) throw profileErr;
            } else {
                const { error: signInErr } = await signIn(email.trim(), password);
                if (signInErr) throw signInErr;
            }
            markSeen();
            navigate(back, { replace: true });
        } catch (err) {
            setError(humanError(err?.message));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="page">
            <div className="page-head">
                <button type="button" className="circ" onClick={() => navigate(-1)} aria-label="Back">‹</button>
            </div>

            <div className="auth-body">
                <h1>{isSignUp ? 'Create your account' : 'Welcome back'}</h1>
                <p className="auth-lede">
                    {isSignUp
                        ? 'Your library is private by default.'
                        : 'Sign in to pick up where you left off.'}
                </p>

                <form onSubmit={submit} noValidate>
                    {isSignUp && (
                        <label className="field">
                            <span>Username</span>
                            <input
                                className="searchbox" type="text" value={username} required
                                autoComplete="username" minLength={3} maxLength={24}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </label>
                    )}
                    <label className="field">
                        <span>Email</span>
                        <input
                            className="searchbox" type="email" value={email} required
                            autoComplete="email" inputMode="email"
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </label>
                    <label className="field">
                        <span>Password</span>
                        <input
                            className="searchbox" type="password" value={password} required
                            autoComplete={isSignUp ? 'new-password' : 'current-password'} minLength={6}
                            aria-describedby={isSignUp ? 'pw-rule' : undefined}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        {/* Stated up front. Letting someone type a password,
                            submit, and only then learn the rule is a wall you
                            walk into rather than one you can see. */}
                        {isSignUp && (
                            <span id="pw-rule" className="field-hint">
                                At least 6 characters, with an uppercase letter, a lowercase letter,
                                a number and a symbol.
                            </span>
                        )}
                    </label>

                    {error && <p className="auth-error" role="alert">{error}</p>}

                    <button type="submit" className="btn block" disabled={busy}>
                        {busy ? 'One moment…' : isSignUp ? 'Create account' : 'Sign in'}
                    </button>
                </form>

                <p className="auth-alt">
                    {isSignUp ? 'Already have an account? ' : 'New here? '}
                    <Link to={isSignUp ? '/welcome/signin' : '/welcome/signup'} state={{ from: back }}>
                        {isSignUp ? 'Sign in' : 'Create one'}
                    </Link>
                </p>
                <p className="auth-alt">
                    <Link to={back} onClick={markSeen}>Keep browsing without an account</Link>
                </p>
            </div>
        </div>
    );
}
