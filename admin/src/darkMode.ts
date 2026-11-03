// Light / dark mode. Ionic's dark palette turns on when <html> has the "ion-palette-dark" class.
const KEY = 'admin_theme';

export function isDark(): boolean {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return saved === 'dark';
  } catch { /* storage blocked: fall back to the system setting */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle('ion-palette-dark', dark);
  try { localStorage.setItem(KEY, dark ? 'dark' : 'light'); } catch { /* ignore */ }
}
