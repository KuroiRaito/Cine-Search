export default function Filters({ mediaType, setMediaType, selectedGenre, setSelectedGenre, sortBy, setSortBy, genresList }) {

    // Parse currently selected sort values
    const [sortField, sortDir] = sortBy.includes('.') ? sortBy.split('.') : [sortBy, 'desc'];

    const handleSortChange = (field, dir) => {
        setSortBy(`${field}.${dir}`);
    };

    return (
        <div className="filter-bar" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
                value={mediaType}
                onChange={e => setMediaType(e.target.value)}
                className="filter-select"
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #475569', background: '#1e293b', color: '#fff' }}
            >
                <option value="all">All Types</option>
                <option value="movie">Movies</option>
                <option value="tv">TV Shows</option>
            </select>

            <select
                value={selectedGenre}
                onChange={e => setSelectedGenre(e.target.value)}
                className="filter-select"
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #475569', background: '#1e293b', color: '#fff' }}
            >
                <option value="">All Genres</option>
                {genresList.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                ))}
            </select>

            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <select
                    value={sortField === 'newest' ? 'date' : sortField}
                    onChange={e => handleSortChange(e.target.value, sortDir)}
                    className="filter-select"
                    style={{ padding: '8px', borderRadius: '4px 0 0 4px', border: '1px solid #475569', background: '#1e293b', color: '#fff' }}
                >
                    <option value="popularity">Popularity</option>
                    <option value="vote_average">Rating</option>
                    <option value="date">Release Date</option>
                </select>

                <button
                    onClick={() => handleSortChange(sortField === 'newest' ? 'date' : sortField, sortDir === 'asc' ? 'desc' : 'asc')}
                    style={{
                        padding: '8px 12px',
                        borderRadius: '0 4px 4px 0',
                        border: '1px solid #475569',
                        borderLeft: 'none',
                        background: '#334155',
                        color: '#fff',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                    }}
                    title={`Sort ${sortDir === 'asc' ? 'Ascending' : 'Descending'}`}
                >
                    {sortDir === 'asc' ? '↑' : '↓'}
                </button>
            </div>
        </div>
    );
}
