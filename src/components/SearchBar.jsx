export default function SearchBar({ query, setQuery }) {
    return (
        <form onSubmit={(e) => e.preventDefault()} className="search-form">
            <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search for movies..."
                className="search-input"
            />
        </form>
    );
}
