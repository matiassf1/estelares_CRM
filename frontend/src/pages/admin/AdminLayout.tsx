import type { ReactNode } from 'react';
import ClubShield from '../../components/ClubShield.tsx';

export type AdminSection = 'inicio' | 'jugadores' | 'club' | 'analitica' | 'config';

const SECTIONS: { id: AdminSection; label: string }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'jugadores', label: 'Jugadores' },
  { id: 'club', label: 'Club' },
  { id: 'analitica', label: 'Analítica' },
  { id: 'config', label: 'Config' },
];

interface Props {
  section: AdminSection;
  onSection: (s: AdminSection) => void;
  /** Secciones con novedades: muestran un punto dorado. */
  flagged?: AdminSection[];
  onPortero: () => void;
  onLogout: () => void;
  children: ReactNode;
}

export default function AdminLayout({ section, onSection, flagged = [], onPortero, onLogout, children }: Props) {
  return (
    <div className="min-h-screen pattern-lines" style={{ backgroundColor: 'var(--brand-bg)' }}>
      <div className="max-w-6xl mx-auto px-5 md:px-8">
        {/* Topbar */}
        <div
          className="flex items-center justify-between py-4"
          style={{ borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.18)' }}
        >
          <div className="flex items-center gap-3">
            <ClubShield size={30} />
            <div>
              <p className="font-display text-white tracking-widest text-base leading-none">ESTELARES</p>
              <p className="text-[10px] mt-1" style={{ color: 'var(--brand-muted)' }}>Panel · admin</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onPortero}
              className="text-xs font-semibold uppercase tracking-wider active:opacity-70"
              style={{ color: 'var(--brand-accent)' }}
            >
              Portero
            </button>
            <button
              onClick={onLogout}
              className="text-[11px] px-3 py-1.5 rounded-lg"
              style={{ color: 'var(--brand-muted)', border: '1px solid rgb(var(--brand-border-rgb) / 0.6)' }}
            >
              Salir
            </button>
          </div>
        </div>

        {/* Navegación — escritorio */}
        <nav
          className="hidden md:flex gap-1 mt-3"
          style={{ borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.14)' }}
        >
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => onSection(s.id)}
              className="font-display tracking-widest text-sm px-4 py-2.5"
              style={{
                color: section === s.id ? '#F5F5F0' : 'var(--brand-muted)',
                borderBottom: `2px solid ${section === s.id ? 'var(--brand-primary)' : 'transparent'}`,
              }}
            >
              {s.label}
              {flagged.includes(s.id) && (
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full ml-1.5 align-middle"
                  style={{ backgroundColor: 'var(--brand-gold)' }}
                />
              )}
            </button>
          ))}
        </nav>

        <main className="py-5 pb-28 md:pb-10">{children}</main>
      </div>

      {/* Navegación — mobile */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 flex"
        style={{
          backgroundColor: 'var(--brand-surface)',
          borderTop: '1px solid rgb(var(--brand-accent-rgb) / 0.18)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => onSection(s.id)}
            className="flex-1 py-2.5 text-[9px] tracking-wider"
            style={{ color: section === s.id ? '#F5F5F0' : 'var(--brand-muted)' }}
          >
            <span className="block text-sm leading-none mb-1">
              {section === s.id ? '◆' : '◇'}
            </span>
            {s.label}
            {flagged.includes(s.id) && (
              <span
                className="inline-block w-1 h-1 rounded-full ml-1 align-middle"
                style={{ backgroundColor: 'var(--brand-gold)' }}
              />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
