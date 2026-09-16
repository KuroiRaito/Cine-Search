// Profile — the public surface.
//
// Module 8. Absorbs what used to be `you`: identity and favourites above the
// numbers, on one screen, because two screens showing the same figures is how
// they come to disagree (docs/profile-module.html D3).
export { default as Profile } from './Profile.jsx';
export { default as Settings } from './Settings.jsx';

// The People shelf's rule lives here, so the person page only has to draw a
// control and say when it was pressed.
export { usePersonFavourite } from './usePersonFavourite.js';
