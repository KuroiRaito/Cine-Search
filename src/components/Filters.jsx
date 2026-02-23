import { useState, useEffect } from 'react';

export default function Filters({ show, onClose, onApply, initialFilters, genresList }) {
    const [localMediaType, setLocalMediaType] = useState('all');
    const [localGenre, setLocalGenre] = useState('');
    const [localSortBy, setLocalSortBy] = useState('popularity.desc');
    const [localMinRating, setLocalMinRating] = useState(0);
    const [localYear, setLocalYear] = useState('');

    useEffect(() => {
        if (show) {
            setLocalMediaType(initialFilters.mediaType || 'all');
            setLocalGenre(initialFilters.selectedGenre || '');
            setLocalSortBy(initialFilters.sortBy || 'popularity.desc');
            setLocalMinRating(initialFilters.minRating || 0);
            setLocalYear(initialFilters.year || '');
        }
    }, [show, initialFilters]);

    if (!show) return null;

    const handleApply = () => {
        onApply({
            mediaType: localMediaType,
            selectedGenre: localGenre,
            sortBy: localSortBy,
            minRating: localMinRating,
            year: localYear
        });
    };

    const isFilterActive = localMediaType !== 'all' || localGenre !== '' || localSortBy !== 'popularity.desc' || localMinRating !== 0 || localYear !== '';

    const handleRemoveFilters = () => {
        setLocalMediaType('all');
        setLocalGenre('');
        setLocalSortBy('popularity.desc');
        setLocalMinRating(0);
        setLocalYear('');
        onApply({
            mediaType: 'all',
            selectedGenre: '',
            sortBy: 'popularity.desc',
            minRating: 0,
            year: ''
        });
    };

    const [sortField, sortDir] = localSortBy.includes('.') ? localSortBy.split('.') : [localSortBy, 'desc'];

    const handleSortChange = (field, dir) => {
        setLocalSortBy(`${field}.${dir}`);
    };

    return (
        <>
            <div className="modal-overlay" onClick={onClose} />
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Filters</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>

                <div className="filters-grid">
                    <div className="filter-group">
                        <label>Media Type</label>
                        <select
                            value={localMediaType}
                            onChange={e => setLocalMediaType(e.target.value)}
                            className="filter-select"
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #475569', background: '#1e293b', color: '#fff' }}
                        >
                            <option value="all">All Types</option>
                            <option value="movie">Movies</option>
                            <option value="tv">TV Shows</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>Genre</label>
                        <select
                            value={localGenre}
                            onChange={e => setLocalGenre(e.target.value)}
                            className="filter-select"
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #475569', background: '#1e293b', color: '#fff' }}
                        >
                            <option value="">All Genres</option>
                            {genresList.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>Rating</label>
                        <input
                            type="number"
                            min="0" max="10" step="1"
                            placeholder="e.g. 8"
                            value={localMinRating}
                            onChange={e => setLocalMinRating(Number(e.target.value))}
                            className="filter-select"
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #475569', background: '#1e293b', color: '#fff' }}
                        />
                    </div>

                    <div className="filter-group">
                        <label>Release Year</label>
                        <input
                            type="number"
                            placeholder={new Date().getFullYear().toString()}
                            value={localYear}
                            onChange={e => setLocalYear(e.target.value)}
                            className="filter-select"
                            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #475569', background: '#1e293b', color: '#fff' }}
                        />
                    </div>

                    <div className="filter-group" style={{ gridColumn: '1 / -1', marginTop: '0.25rem' }}>
                        <label>Sort By</label>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <select
                                value={sortField === 'newest' ? 'date' : sortField}
                                onChange={e => handleSortChange(e.target.value, sortDir)}
                                className="filter-select"
                                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #475569', background: '#1e293b', color: '#fff' }}
                            >
                                <option value="popularity">Popularity</option>
                                <option value="vote_average">Rating</option>
                                <option value="date">Release Date</option>
                            </select>

                            <button
                                onClick={() => handleSortChange(sortField === 'newest' ? 'date' : sortField, sortDir === 'asc' ? 'desc' : 'asc')}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: '4px',
                                    border: '1px solid #475569',
                                    background: '#334155',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
                                title={`Sort ${sortDir === 'asc' ? 'Ascending' : 'Descending'}`}
                            >
                                {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="modal-actions">
                    <button
                        className={`search-button ${!isFilterActive ? 'disabled' : ''}`}
                        onClick={handleRemoveFilters}
                        disabled={!isFilterActive}
                        style={{ opacity: isFilterActive ? 1 : 0.5, cursor: isFilterActive ? 'pointer' : 'not-allowed' }}
                    >
                        Remove Filters
                    </button>
                    <button className="search-button primary" onClick={handleApply}>Apply Filters</button>
                </div>
            </div>
        </>
    );
}
