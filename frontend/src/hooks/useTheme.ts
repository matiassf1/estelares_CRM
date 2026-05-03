import { useEffect, useState } from 'react';

type Theme = 'clasico' | 'steel';
const KEY = 'estelares_theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(KEY) as Theme) || 'clasico'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const toggle = () => setTheme(t => (t === 'clasico' ? 'steel' : 'clasico'));
  return { theme, toggle };
}
