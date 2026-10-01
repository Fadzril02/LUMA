import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import './index.css';
window.addEventListener('error', (e) => {
  if (e.message?.includes('Failed to fetch dynamically imported module') || e.message?.includes('Importing a module script failed')) {
    console.warn('ChunkLoadError detected, hard reloading...');
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);