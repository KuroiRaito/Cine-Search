import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './shared/auth/AuthProvider.jsx';
import { LibraryProvider } from './modules/library';
import { RegionProvider } from './shared/hooks/RegionProvider.jsx';
import { ToastProvider } from './app/ToastProvider.jsx';
import { restoreTheme } from './shared/theme/theme.js';

// Before first paint, so a stored choice never flashes the other theme.
restoreTheme();

// A guest is simply someone who isn't signed in — not a fabricated user object.
createRoot(document.getElementById('root')).render(
    <StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <RegionProvider>
                <ToastProvider>
                <LibraryProvider>
                    <App />
                </LibraryProvider>
                </ToastProvider>
                </RegionProvider>
            </AuthProvider>
        </BrowserRouter>
    </StrictMode>,
);
