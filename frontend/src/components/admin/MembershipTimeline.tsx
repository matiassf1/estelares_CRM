import { useEffect, useState } from 'react';
import { api, type MembershipHistory, type MembershipPeriod } from '../../lib/api';

/** Una fila de la línea de tiempo, derivada de los períodos. */
interface Entry {
  fecha: string;            // YYYY-MM-DD
  titulo: string;
  color: string;
  detalle?: string;
  motivo?: string | null;
  autor?: string | null;
  futuro?: boolean;
}

const GOLD = 'var(--brand-gold)';
const RED = '#f87171';
const GREEN = '#3FB56B';
const MUTED = 'var(--brand-muted)';

function dmy(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Los períodos son la fuente de verdad: cada uno aporta su apertura y, si fue
 * cerrado o cancelado, también ese hecho. Antes esto se dibujaba desde
 * audit_log, que podía estar vacío aunque el jugador tuviera un período
 * vigente — y entonces el historial se veía idéntico para todos.
 */
function toEntries(periods: MembershipPeriod[], hoy: string): Entry[] {
  const entries: Entry[] = [];

  for (const p of periods) {
    const esBaja = p.kind === 'TERMINATION';
    const futuro = p.effective_from > hoy;

    entries.push({
      fecha: p.effective_from,
      titulo: p.legacy_migrated
        ? 'Estado migrado del sistema anterior'
        : esBaja
          ? 'Dado de baja'
          : futuro ? 'Suspensión programada' : 'Suspendido',
      color: p.legacy_migrated ? MUTED : esBaja ? RED : GOLD,
      detalle: !esBaja && p.effective_until && !p.closed_at
        ? `hasta el ${dmy(p.effective_until)}`
        : undefined,
      motivo: p.reason,
      autor: p.created_by_username,
      futuro,
    });

    if (p.cancelled_at) {
      entries.push({
        fecha: p.effective_from,
        titulo: 'Período anulado',
        color: MUTED,
        motivo: 'Cargado por error o sin efecto',
      });
    } else if (p.closed_at && p.effective_until) {
      entries.push({
        fecha: p.effective_until,
        titulo: 'Reactivado',
        color: GREEN,
        motivo: p.close_reason,
        autor: p.closed_by_username,
      });
    }
  }

  // Más reciente arriba; a igual fecha, primero la reactivación.
  return entries.sort((a, b) =>
    a.fecha === b.fecha
      ? (b.titulo === 'Reactivado' ? 1 : 0) - (a.titulo === 'Reactivado' ? 1 : 0)
      : a.fecha < b.fecha ? 1 : -1
  );
}

export default function MembershipTimeline({ memberId }: { memberId: string }) {
  const [history, setHistory] = useState<MembershipHistory | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setHistory(null);
    setError('');
    api
      .getMembershipHistory(memberId)
      .then(h => { if (!cancelled) setHistory(h); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Error'); });
    return () => { cancelled = true; };
  }, [memberId]);

  if (error) return <p className="text-xs" style={{ color: RED }}>{error}</p>;
  if (!history) return <p className="text-xs" style={{ color: MUTED }}>Cargando…</p>;

  const hoy = new Date().toISOString().slice(0, 10);
  const entries = toEntries(history.periods, hoy);

  if (entries.length === 0) {
    return (
      <div className="py-2">
        <p className="text-sm text-white mb-1">Sin movimientos administrativos</p>
        <p className="text-xs" style={{ color: MUTED }}>
          Nunca fue suspendido ni dado de baja. Su membresía estuvo activa desde el alta.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3.5 pt-1">
      {entries.map((e, i) => (
        <li key={i} className="flex gap-3">
          <div className="flex flex-col items-center pt-1">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                backgroundColor: e.futuro ? 'transparent' : e.color,
                border: e.futuro ? `1.5px solid ${e.color}` : 'none',
              }}
            />
            {i < entries.length - 1 && (
              <span className="w-px flex-1 mt-1" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
            )}
          </div>
          <div className="min-w-0 pb-0.5">
            <p className="text-xs font-medium text-white">
              {dmy(e.fecha)} · {e.titulo}
              {e.detalle && <span style={{ color: MUTED }}> ({e.detalle})</span>}
            </p>
            {e.motivo && (
              <p className="text-[11px] mt-0.5 break-words" style={{ color: MUTED }}>{e.motivo}</p>
            )}
            {e.autor && (
              <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                por {e.autor}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
