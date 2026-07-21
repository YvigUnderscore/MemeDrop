import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeCtx = createContext(null);
export const useTheme = () => useContext(ThemeCtx);

const THEME_KEY = 'md_theme';      // 'dark' | 'light' | 'system'
const DENSITY_KEY = 'md_density';  // 'comfortable' | 'compact'

function systemDark() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}
function resolve(theme) {
  return theme === 'system' ? (systemDark() ? 'dark' : 'light') : theme;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');
  const [density, setDensityState] = useState(() => localStorage.getItem(DENSITY_KEY) || 'comfortable');

  // Applique le thème résolu sur <html> (et suit la préférence système en mode 'system').
  useEffect(() => {
    const apply = () => document.documentElement.setAttribute('data-theme', resolve(theme));
    apply();
    localStorage.setItem(THEME_KEY, theme);
    if (theme === 'system' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
    localStorage.setItem(DENSITY_KEY, density);
  }, [density]);

  const setTheme = useCallback((t) => setThemeState(t), []);
  const toggleTheme = useCallback(() => setThemeState((t) => (resolve(t) === 'dark' ? 'light' : 'dark')), []);
  const setDensity = useCallback((d) => setDensityState(d), []);

  return (
    <ThemeCtx.Provider value={{ theme, resolved: resolve(theme), setTheme, toggleTheme, density, setDensity }}>
      {children}
    </ThemeCtx.Provider>
  );
}
