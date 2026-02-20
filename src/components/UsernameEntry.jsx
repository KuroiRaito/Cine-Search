import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function UsernameEntry({ onReady }) {
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const { data, error: dbError } = await supabase
                .from('profiles')
                .upsert({ username }, { onConflict: 'username' })
                .select()
                .single();

            if (dbError) throw dbError;

            localStorage.setItem('user_id', data.id);
            localStorage.setItem('username', data.username);

            if (onReady) onReady();
        } catch (err) {
            console.error('Error joining:', err);
            setError(err.message || 'Failed to join');
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
            <h2 style={{ margin: 0 }}>Welcome</h2>
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
                    placeholder="Choose a username"
                    disabled={loading}
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
                    {loading ? 'Joining...' : 'Start Reviewing'}
                </button>
            </form>
            {error && <span style={{ color: '#ef4444', fontSize: '0.9rem' }}>{error}</span>}
        </div>
    );
}
