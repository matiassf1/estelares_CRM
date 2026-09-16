import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  {
    path: '/carnet',
    label: 'Carnet',
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
        <rect x="3" y="5" width="18" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8.5" cy="11" r="2" strokeLinecap="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10h4M13 13h2.5" />
      </svg>
    ),
  },
  {
    path: '/check-in',
    label: 'Ingresar',
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function MemberBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex"
      style={{
        backgroundColor: 'var(--brand-surface)',
        borderTop: '1px solid rgb(var(--brand-accent-rgb) / 0.12)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {tabs.map(({ path, label, icon }) => {
        const active = location.pathname === path;
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors active:opacity-70"
            style={{ color: active ? 'var(--brand-primary)' : 'var(--brand-muted)' }}
          >
            {icon(active)}
            <span
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: active ? 'var(--brand-primary)' : 'var(--brand-muted)' }}
            >
              {label}
            </span>
            {active && (
              <span
                className="absolute bottom-0 w-8 h-0.5 rounded-full"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
