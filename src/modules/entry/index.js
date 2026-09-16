// Entry — the public surface.
//
// The cover and the auth screens are routes; the sign-in sheet is what every
// other module raises when a guest reaches for something that needs an account.
export { default as Cover } from './Cover.jsx';
export { default as Auth } from './Auth.jsx';
export { default as SignInPrompt } from './SignInPrompt.jsx';
// The account surface: who you are signed in as, and how to stop being. Signing
// out is the other end of signing in, so it belongs to this module rather than
// to whichever screen happens to show it.
export { default as AccountCard } from './AccountCard.jsx';
