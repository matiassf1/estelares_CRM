import { useEffect, useState } from 'react';
import { api, type DashboardData } from '../../lib/api.ts';
import PendingCard from '../../components/admin/PendingCard';
import type { AdminSection } from './AdminLayout';

const TONE_COLOR: Record<'ok' | 'warn' | 'alert', string> = {
  ok: 'var(--brand-ok)',
  warn: 'var(--brand-gold)',
  alert: 'var(--brand-danger)',
};

function dmy(iso: string | null): string {
  if (!iso) return 'nunca';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export default function InicioPage({ onSection }: { onSection: (s: AdminSection) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [verTodas, setVerTodas] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getDashboard()
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Error'); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <p className="text-sm" style={{ color: 'var(--brand-danger)' }}>{error}</p>;
  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--brand-surface)' }} />
        ))}
      </div>
    );
  }

  const { pendientes, club, categorias } = data;
  const hayPendientes =
    pendientes.descolgados > 0 || pendientes.a_revisar > 0 ||
    pendientes.sin_foto > 0 || pendientes.horarios === 0;

  const visibles = verTodas ? categorias : categorias.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Para resolver — si no hay nada, la sección entera no se renderiza */}
      {hayPendientes && (
        <section>
          <p className="text-[10px] uppercase tracking-[0.17em] mb-2" style={{ color: 'var(--brand-muted)' }}>
            Para resolver
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {pendientes.descolgados > 0 && (
              <PendingCard
                value={pendientes.descolgados}
                title="Se descolgaron"
                detail={`activos sin venir hace +21 días · ${Math.round((pendientes.descolgados / Math.max(club.activos, 1)) * 100)}% del plantel`}
                tone="alert"
                onClick={() => onSection('jugadores')}
              />
            )}
            {pendientes.a_revisar > 0 && (
              <PendingCard
                value={pendientes.a_revisar}
                title="Membresías a revisar"
                detail="migradas sin motivo registrado"
                onClick={() => onSection('jugadores')}
              />
            )}
            {pendientes.sin_foto > 0 && (
              <PendingCard
                value={pendientes.sin_foto}
                title="Sin foto de carnet"
                detail="el portero no puede validarlos visualmente"
                onClick={() => onSection('jugadores')}
              />
            )}
            {pendientes.horarios === 0 && (
              <PendingCard
                value={0}
                title="Horarios cargados"
                detail="sin esto no hay control de asistencia"
                onClick={() => onSection('club')}
              />
            )}
          </div>
        </section>
      )}

      {!hayPendientes && (
        <p className="text-sm" style={{ color: 'var(--brand-ok)' }}>Todo al día.</p>
      )}

      {/* El club */}
      <section>
        <p className="text-[10px] uppercase tracking-[0.17em] mb-2" style={{ color: 'var(--brand-muted)' }}>
          El club
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: 'Activos', value: club.activos, color: '#F5F5F0' },
            { label: 'Suspendidos', value: club.suspendidos, color: 'var(--brand-gold)' },
            { label: 'Ingresos 7d', value: club.ingresos_7d, color: '#F5F5F0' },
            { label: 'Jugadores 7d', value: club.jugadores_7d, color: '#F5F5F0' },
          ].map(m => (
            <div
              key={m.label}
              className="rounded-xl p-3"
              style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-border-rgb) / 0.9)' }}
            >
              <p className="font-display text-2xl leading-none" style={{ color: m.color }}>{m.value}</p>
              <p className="text-[10px] uppercase tracking-wider mt-1" style={{ color: 'var(--brand-muted)' }}>
                {m.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Categorías */}
      {categorias.length > 0 && (
        <section>
          <p className="text-[10px] uppercase tracking-[0.17em] mb-2" style={{ color: 'var(--brand-muted)' }}>
            Categorías · lo que necesita atención primero
          </p>
          <div className="space-y-1.5">
            {visibles.map(c => (
              <button
                key={c.id}
                onClick={() => onSection('club')}
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left"
                style={{
                  backgroundColor: 'var(--brand-surface)',
                  border: `1px solid ${c.estado === 'ok'
                    ? 'rgb(var(--brand-border-rgb) / 0.9)'
                    : `color-mix(in srgb, ${TONE_COLOR[c.estado]} 30%, transparent)`}`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: TONE_COLOR[c.estado] }} />
                <span className="text-[13px] font-semibold text-white flex-1 truncate">{c.nombre}</span>
                <span className="text-[11px] text-right shrink-0" style={{ color: 'var(--brand-muted)' }}>
                  {c.activos} activos · {dmy(c.ultimo_ingreso)}
                </span>
              </button>
            ))}
          </div>
          {categorias.length > 6 && (
            <button
              onClick={() => setVerTodas(v => !v)}
              className="w-full text-center text-[11px] pt-2"
              style={{ color: 'var(--brand-muted)' }}
            >
              {verTodas ? 'ver menos' : `ver las ${categorias.length} ›`}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
