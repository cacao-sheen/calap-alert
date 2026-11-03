import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme, isDark } from './darkMode';

applyTheme(isDark());

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
