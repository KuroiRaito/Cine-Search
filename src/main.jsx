import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { restoreTheme } from './lib/theme.js';

// Before first paint, so a stored choice never flashes the other theme.
restoreTheme();

// Accounts arrive in Milestone 2. Until then there is no auth provider, and a
// guest is simply someone who isn't signed in — not a fabricated user object.
createRoot(document.getElementById('root')).render(
    <StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </StrictMode>,
);
