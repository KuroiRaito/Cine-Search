import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthProvider';

export default function UsernameSetup({ onComplete }) {
    const { user } = useAuth();
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const trimmedUser = username.trim();
        if (!trimmedUser) {
            setError('Username cannot be empty.');
            return;
        }

        if (trimmedUser.length < 3 || trimmedUser.length > 20) {
            setError('Username must be between 3 and 20 characters.');
            return;
        }

        if (/\s/.test(trimmedUser)) {
            setError('Username cannot contain spaces.');
            return;
        }

        if (!user) {
            setError('No active user session found.');
            return;
        }

        setLoading(true);

        try {
            // Attempt to insert the profile
            const { error: dbError } = await supabase
                .from('profiles')
                .insert({ id: user.id, username: trimmedUser }); // id must be the auth user's UUID

            // Note: If username has unique constraint, this will fail if it's taken.
            if (dbError) {
                if (dbError.code === '23505') { // Postgres unique violation code
                    setError('Username is already taken.');
                } else {
                    throw dbError;
                }
            } else {
                if (onComplete) onComplete({ username: trimmedUser });
            }
        } catch (err) {
            console.error('Error setting username:', err);
            setError(err.message || 'Failed to set username');
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
            color: '#fff'
        }}>
            <h2 style={{ margin: 0 }}>Choose a Username</h2>
            <form
                onSubmit={handleSubmit}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    alignItems: 'center',
                    width: '100%',
                    maxWidth: '300px'
                }}
            >
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    disabled={loading}
                    required
                    style={{
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #334155',
                        backgroundColor: '#1e293b',
                        color: 'white',
                        width: '100%',
                        fontSize: '1rem'
                    }}
                />
                <button
                    type="submit"
                    disabled={loading || !username.trim()}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: '#3b82f6',
                        color: 'white',
                        fontWeight: '600',
                        cursor: loading || !username.trim() ? 'not-allowed' : 'pointer',
                        opacity: loading || !username.trim() ? 0.7 : 1,
                        width: '100%',
                        fontSize: '1rem'
                    }}
                >
                    {loading ? 'Saving...' : 'Start Reviewing'}
                </button>
            </form>
            {error && <span style={{ color: '#ef4444', fontSize: '0.9rem', textAlign: 'center', maxWidth: '300px' }}>{error}</span>}
        </div>
    );
}
