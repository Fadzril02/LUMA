import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.tsx'; // Adjusted cleanly to reference your app/ directory setup
import { AuthProvider } from './context/AuthContext.tsx';
import { ErrorBoundary } from './components/shared/ErrorBoundary.tsx';
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