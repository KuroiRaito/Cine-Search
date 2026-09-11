import { useState } from 'react';
import { useAuth } from '../context/AuthProvider';
import { supabase } from '../lib/supabaseClient';

const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
);

const EyeOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
    </svg>
);

export default function AuthPage({ onLogin }) {
    const { signIn, signUp, loginAsGuest } = useAuth();
    const [isSignUp, setIsSignUp] = useState(true); // Default to Sign Up
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!email || !password || (isSignUp && !username)) {
            setError('Please fill in all required fields.');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        let trimmedUser = '';
        if (isSignUp) {
            trimmedUser = username.trim();
            if (trimmedUser.length < 3 || trimmedUser.length > 20) {
                setError('Username must be between 3 and 20 characters.');
                return;
            }
            if (/\s/.test(trimmedUser)) {
                setError('Username cannot contain spaces.');
                return;
            }
        }

        setLoading(true);

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Supabase request timed out (DB may be paused). Try Demo Mode!')), 4000)
        );

        try {
            if (isSignUp) {
                const signUpPromise = (async () => {
                    const { data: authData, error: signUpError } = await signUp({ email, password });
                    if (signUpError) throw signUpError;
                    if (authData?.user) {
                        const { error: dbError } = await supabase
                            .from('profiles')
                            .insert({ id: authData.user.id, username: trimmedUser });
                        if (dbError) {
                            if (dbError.code === '23505') {
                                throw new Error('Username is already taken. Please try another.');
                            } else {
                                throw dbError;
                            }
                        }
                    }
                })();
                await Promise.race([signUpPromise, timeoutPromise]);
            } else {
                const signInPromise = (async () => {
                    const { error: signInError } = await signIn({ email, password });
                    if (signInError) throw signInError;
                })();
                await Promise.race([signInPromise, timeoutPromise]);
            }
            if (onLogin) onLogin();
        } catch (err) {
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: '1rem',
            color: '#fff',
            padding: '1rem'
        }}>
            <h2 style={{ margin: 0 }}>{isSignUp ? 'Create an Account' : 'Welcome Back'}</h2>
            <form
                onSubmit={handleSubmit}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    alignItems: 'center',
                    width: '100%',
                    maxWidth: '320px'
                }}
            >
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email Address"
                    disabled={loading}
                    required
                    style={{
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #334155',
                        backgroundColor: '#1e293b',
                        color: 'white',
                        width: '100%',
                        fontSize: '1rem',
                        boxSizing: 'border-box'
                    }}
                />

                {isSignUp && (
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Choose a Username"
                        disabled={loading}
                        required={isSignUp}
                        style={{
                            padding: '10px',
                            borderRadius: '6px',
                            border: '1px solid #334155',
                            backgroundColor: '#1e293b',
                            color: 'white',
                            width: '100%',
                            fontSize: '1rem',
                            boxSizing: 'border-box'
                        }}
                    />
                )}

                <div style={{ position: 'relative', width: '100%' }}>
                    <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        disabled={loading}
                        required
                        style={{
                            padding: '10px',
                            paddingRight: '40px',
                            borderRadius: '6px',
                            border: '1px solid #334155',
                            backgroundColor: '#1e293b',
                            color: 'white',
                            width: '100%',
                            fontSize: '1rem',
                            boxSizing: 'border-box'
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0'
                        }}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                </div>

                <button
                    type="submit"
                    disabled={loading || !email.trim() || !password.trim() || (isSignUp && !username.trim())}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        fontWeight: '600',
                        cursor: loading || !email.trim() || !password.trim() || (isSignUp && !username.trim()) ? 'not-allowed' : 'pointer',
                        opacity: loading || !email.trim() || !password.trim() || (isSignUp && !username.trim()) ? 0.7 : 1,
                        width: '100%',
                        fontSize: '1rem'
                    }}
                >
                    {loading ? (isSignUp ? 'Signing Up...' : 'Signing In...') : (isSignUp ? 'Sign Up' : 'Sign In')}
                </button>
            </form>

            <button
                onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError('');
                }}
                disabled={loading}
                style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    textDecoration: 'underline',
                    fontSize: '0.9rem'
                }}
            >
                {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
            </button>

            <div style={{ margin: '0.5rem 0', width: '100%', maxWidth: '320px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#334155' }} />
                <span style={{ color: '#64748b', fontSize: '0.8rem' }}>OR</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: '#334155' }} />
            </div>

            <button
                onClick={() => loginAsGuest(username.trim() || 'Guest Explorer')}
                disabled={loading}
                style={{
                    padding: '10px 20px',
                    borderRadius: '6px',
                    border: '1px solid #3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    color: '#60a5fa',
                    fontWeight: '600',
                    cursor: 'pointer',
                    width: '100%',
                    maxWidth: '320px',
                    fontSize: '0.95rem',
                    transition: 'all 0.2s'
                }}
            >
                🚀 Continue as Guest (Demo Mode)
            </button>

            {error && <span style={{ color: '#ef4444', fontSize: '0.9rem', textAlign: 'center', maxWidth: '320px' }}>{error}</span>}
        </div>
    );
}

