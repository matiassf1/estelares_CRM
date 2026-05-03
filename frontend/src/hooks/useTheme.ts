import { useEffect, useState } from 'react';

type Theme = 'clasico' | 'escudo';
const KEY = 'estelares_theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(KEY) as Theme) || 'clasico'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const toggle = () => setTheme(t => (t === 'clasico' ? 'escudo' : 'clasico'));
  return { theme, toggle };
}
