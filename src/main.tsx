import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.tsx'; // Adjusted cleanly to reference your app/ directory setup
import { AuthProvider } from './context/AuthContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);