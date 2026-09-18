// Library — the public surface of this module.
//
// Everything a person records about a title lives behind this file: the status
// vocabulary, the writes, the progress arithmetic, the in-memory copy of one
// person's library, and the editor sheet. Other modules import from here and
// never reach deeper (`npm run verify` enforces it), so the inside is free to
// be reorganised.
export { LibraryProvider, useLibrary, useTileStates, useQuickAdd } from './LibraryProvider.jsx';
export { default as Library } from './Library.jsx';
export { default as Editor } from './Editor.jsx';

// The vocabulary and the arithmetic. These are what other screens read to draw
// a state, count progress, or name an episode.
export {
    STATUSES, statusesFor, statusMeta, statusLabel, statusTone, canRate, isSeen,
    RATINGS, validRating, keyOf, collectionProgress,
    episodesWatched, runningOrder, isWatched, nextUnwatched, lastWatched, epLabel,
    rememberSeasonRuntime, totalsFromView, totalsAreFresh,
    personTotalsGet, personTotalsSet, creditsForPeople,
    setFavouriteOrder, loadFavourites, loadShelf, shapeRow,
} from './library.js';
