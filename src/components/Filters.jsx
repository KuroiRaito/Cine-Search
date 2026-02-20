export default function Filters({ mediaType, setMediaType, selectedGenre, setSelectedGenre, sortBy, setSortBy, genresList }) {
    return (
        <div className="filter-bar" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
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

            <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="filter-select"
                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #475569', background: '#1e293b', color: '#fff' }}
            >
                <option value="popularity.desc">Popularity</option>
                <option value="vote_average.desc">Rating</option>
                <option value="newest">Newest</option>
            </select>
        </div>
    );
}
