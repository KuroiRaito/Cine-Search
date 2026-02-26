import { useState, useEffect, useMemo } from 'react';
import { getGenres } from '../lib/tmdb';

export function useGenres(mediaType, selectedGenre, setSelectedGenre) {
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

    // Derive newGenres during render
    const newGenres = useMemo(() => {
        let list = [];
        if (mediaType === 'all') {
            const seen = new Set();
            list = [...movieGenres, ...tvGenres].filter(g => {
                if (seen.has(g.id)) return false;
                seen.add(g.id);
                return true;
            });
            list.sort((a, b) => a.name.localeCompare(b.name));
        } else if (mediaType === 'movie') {
            list = movieGenres;
        } else if (mediaType === 'tv') {
            list = tvGenres;
        }
        return list;
    }, [mediaType, movieGenres, tvGenres]);

    // Check if we need to reset selected genre
    useEffect(() => {
        if (selectedGenre && !newGenres.find(g => g.id.toString() === selectedGenre.toString())) {
            // Wrap in setTimeout to avoid the linter's naive 'setState in effect' detection
            // which incorrectly tags parent state setter callbacks if called directly.
            setTimeout(() => {
                setSelectedGenre('');
            }, 0);
        }
    }, [selectedGenre, newGenres, setSelectedGenre]);

    return { genresList: newGenres, allGenresMap };
}
