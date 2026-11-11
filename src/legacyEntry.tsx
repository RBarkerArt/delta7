import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initAnalytics } from './lib/analytics'

if (import.meta.env.VITE_ENABLE_APP_CHECK === 'true') {
  void import('./lib/appCheck').then(({ initAppCheck }) => initAppCheck());
} else if (import.meta.env.DEV) {
  console.info('[Delta-7] App Check disabled. Set VITE_ENABLE_APP_CHECK=true after Firebase App Check is configured.');
}

void initAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
