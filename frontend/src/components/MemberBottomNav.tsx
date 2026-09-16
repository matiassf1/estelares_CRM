import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  {
    path: '/carnet',
    label: 'Carnet',
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6}>
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
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function MemberBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      // show when scrolling up or near top; hide when scrolling down past 60px
      setVisible(y < 60 || y < lastY.current);
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex transition-transform duration-300"
      style={{
        backgroundColor: 'var(--brand-surface)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
      }}
    >
      {tabs.map(({ path, label, icon }) => {
        const active = location.pathname === path;
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="relative flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-opacity active:opacity-60"
            style={{ color: active ? 'var(--brand-primary)' : 'rgba(255,255,255,0.5)' }}
          >
            {active && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              />
            )}
            {icon(active)}
            <span className="text-[10px] font-semibold uppercase tracking-widest">
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
