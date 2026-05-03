import { useTheme } from '../hooks/useTheme.ts';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={theme === 'clasico' ? 'Cambiar a Steel' : 'Cambiar a Clásico'}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        color: 'var(--brand-muted)', fontSize: '0.65rem',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        padding: '4px 6px', borderRadius: 6,
        border: '1px solid rgb(var(--brand-border-rgb) / 0.5)',
        background: 'transparent',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--brand-primary)', display: 'inline-block', flexShrink: 0 }} />
      {theme === 'clasico' ? 'Clásico' : 'Steel'}
    </button>
  );
}
