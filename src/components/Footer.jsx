import React from 'react';

export default function Footer() {
    return (
        <footer style={{
            textAlign: 'center',
            padding: '24px 20px',
            marginTop: 'auto',
            color: '#64748b',
            fontSize: '0.85rem',
            borderTop: '1px solid #334155'
        }}>
            <p style={{ margin: 0, lineHeight: '1.5' }}>
                This product uses data from <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>The Movie Database (TMDB)</a>.
                <br />
                This product is not endorsed or certified by <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>TMDB</a>.
            </p>
        </footer>
    );
}
