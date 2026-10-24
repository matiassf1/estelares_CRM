import { useEffect, useState } from 'react';
import { api, type MembershipHistory } from '../../lib/api';

const ACTION_LABEL: Record<string, string> = {
  suspended: 'Suspendido',
  terminated: 'Dado de baja',
  reactivated: 'Reactivado',
  suspension_cancelled: 'Período cancelado',
  legacy_migrated: 'Estado migrado del sistema anterior',
};

const ACTION_COLOR: Record<string, string> = {
  suspended: 'var(--brand-gold)',
  terminated: '#f87171',
  reactivated: '#3FB56B',
};

function fmt(ts: string): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function MembershipTimeline({ memberId }: { memberId: string }) {
  const [history, setHistory] = useState<MembershipHistory | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .getMembershipHistory(memberId)
      .then(h => { if (!cancelled) setHistory(h); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Error'); });
    return () => { cancelled = true; };
  }, [memberId]);

  if (error) return <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>;
  if (!history) return <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>Cargando…</p>;
  if (history.events.length === 0) {
    return (
      <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
        Sin movimientos administrativos registrados.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {history.events.map(ev => {
        const color = ACTION_COLOR[ev.action] || 'var(--brand-muted)';
        const until = (ev.new_value?.effective_until as string | null) ?? null;
        return (
          <li key={ev.id} className="flex gap-2.5">
            <span
              className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
              style={{ backgroundColor: color }}
            />
            <div className="min-w-0">
              <p className="text-xs text-white">
                {fmt(ev.performed_at)} · {ACTION_LABEL[ev.action] || ev.action}
                {ev.performed_by_username && (
                  <span style={{ color: 'var(--brand-muted)' }}> por {ev.performed_by_username}</span>
                )}
              </p>
              {ev.reason && (
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--brand-muted)' }}>
                  {ev.reason}
                  {until && ` · hasta ${until.slice(8, 10)}/${until.slice(5, 7)}`}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
