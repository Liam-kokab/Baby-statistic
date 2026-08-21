import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/global.css';
import App from './App';
import { ensureInitialTheme } from './utils/theme';
import { LanguageProvider } from './i18n/i18n';
import { WsProvider } from './contexts/WsProvider';

// Apply saved theme early to avoid a flash of the default theme
ensureInitialTheme();

const rootEl = document.getElementById('root');

if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <LanguageProvider>
        <BrowserRouter>
          <WsProvider>
            <App />
          </WsProvider>
        </BrowserRouter>
      </LanguageProvider>
    </StrictMode>
  );
}

