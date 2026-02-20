import { useState, useEffect } from 'react';
import { getGenres } from '../lib/tmdb';

export function useGenres(mediaType, selectedGenre, setSelectedGenre) {
    const [genresList, setGenresList] = useState([]);
    const [allGenresMap, setAllGenresMap] = useState({});
    const [movieGenres, setMovieGenres] = useState([]);
    const [tvGenres, setTvGenres] = useState([]);

    // Fetch all genres on mount
    useEffect(() => {
        async function loadAllGenres() {
            const gMovie = await getGenres('movie');
            const gTV = await getGenres('tv');

            setMovieGenres(gMovie);
            setTvGenres(gTV);

            const map = {};
            [...gMovie, ...gTV].forEach(g => {
                map[g.id] = g.name;
            });
            setAllGenresMap(map);
        }
        loadAllGenres();
    }, []);

    // Update Genres List based on Media Type
    useEffect(() => {
        let newGenres = [];
        if (mediaType === 'all') {
            // Merge unique genres
            const seen = new Set();
            newGenres = [...movieGenres, ...tvGenres].filter(g => {
                if (seen.has(g.id)) return false;
                seen.add(g.id);
                return true;
            });
            // Sort alphabetically
            newGenres.sort((a, b) => a.name.localeCompare(b.name));
        } else if (mediaType === 'movie') {
            newGenres = movieGenres;
        } else if (mediaType === 'tv') {
            newGenres = tvGenres;
        }

        setGenresList(newGenres);

        // If current selected genre is not in new list, reset it
        if (selectedGenre && !newGenres.find(g => g.id.toString() === selectedGenre.toString())) {
            setSelectedGenre('');
        }
    }, [mediaType, movieGenres, tvGenres, selectedGenre, setSelectedGenre]);

    return { genresList, allGenresMap };
}
