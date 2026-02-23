export default function SearchBar({ query, setQuery, onOpenFilters }) {
    return (
        <form onSubmit={(e) => e.preventDefault()} className="search-form">
            <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search for movies..."
                    className="search-input"
                    style={{ width: '100%', paddingRight: query ? '35px' : '20px', boxSizing: 'border-box' }}
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => setQuery('')}
                        style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4px'
                        }}
                        title="Clear Search"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="15" y1="9" x2="9" y2="15"></line>
                            <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                    </button>
                )}
            </div>
            <button
                type="button"
                className="search-button"
                onClick={onOpenFilters}
            >
                Filters
            </button>
        </form >
    );
}
