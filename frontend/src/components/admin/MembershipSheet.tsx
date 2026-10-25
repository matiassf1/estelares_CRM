import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { lockBodyScroll } from '../../utils/scrollLock';
import { api, type Member } from '../../lib/api';
import { shortDate } from './MembershipBadge';

export type MembershipOp = 'suspend' | 'terminate' | 'reactivate';

interface Props {
  member: Member;
  op: MembershipOp;
  onClose: () => void;
  onDone: (message: string) => void;
}

/** Motivos frecuentes: evitan tipear en el celular, el campo libre sigue disponible. */
const QUICK_REASONS: Record<MembershipOp, string[]> = {
  suspend: ['Lesión', 'Viaje', 'Motivos personales', 'Situación de pago'],
  terminate: ['Dejó el club', 'Se mudó', 'Pasó a otro club', 'Sin actividad'],
  reactivate: ['Volvió', 'Alta médica', 'Regularizó situación'],
};

const COPY: Record<MembershipOp, { title: string; cta: string; color: string }> = {
  suspend: { title: 'Suspender membresía', cta: 'Suspender', color: 'var(--brand-gold)' },
  terminate: { title: 'Dar de baja', cta: 'Confirmar baja', color: '#f87171' },
  reactivate: { title: 'Reactivar membresía', cta: 'Reactivar', color: '#3FB56B' },
};

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export default function MembershipSheet({ member, op, onClose, onDone }: Props) {
  const [visible, setVisible] = useState(false);
  const [from, setFrom] = useState(todayIso());
  const [until, setUntil] = useState('');
  const [hasUntil, setHasUntil] = useState(false);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const copy = COPY[op];
  const reasonRequired = op !== 'reactivate';

  useEffect(() => {
    const unlock = lockBodyScroll();
    const t = requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => { unlock(); cancelAnimationFrame(t); document.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 260);
  };

  const submit = async () => {
    setError('');
    if (reasonRequired && !reason.trim()) {
      setError('Indicá un motivo');
      return;
    }
    // La baja libera la cochera y no tiene deshacer: se confirma explícitamente.
    if (op === 'terminate' && !confirming) {
      setConfirming(true);
      return;
    }
    setLoading(true);
    try {
      const nombre = `${member.apellido}, ${member.nombre}`;
      if (op === 'suspend') {
        await api.suspendMember(member.id, {
          effective_from: from,
          effective_until: hasUntil && until ? until : null,
          reason: reason.trim(),
        });
        onDone(`${nombre} suspendido desde el ${shortDate(from)}`);
      } else if (op === 'terminate') {
        await api.terminateMember(member.id, { effective_from: from, reason: reason.trim() });
        onDone(`${nombre} dado de baja`);
      } else {
        await api.reactivateMember(member.id, {
          effective_from: from,
          reason: reason.trim() || undefined,
        });
        onDone(`${nombre} reactivado`);
      }
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la operación');
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = {
    backgroundColor: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'white',
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col justify-end backdrop-blur-mobile"
      style={{
        backgroundColor: `rgba(0,0,0,${visible ? 0.6 : 0})`,
        transition: 'background-color 0.25s ease',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className="w-full rounded-t-2xl md:max-w-md md:mx-auto md:mb-8 md:rounded-2xl"
        style={{
          backgroundColor: '#1a1a1c',
          border: '1px solid rgba(255,255,255,0.1)',
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.26s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }} />
        </div>

        <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <p className="font-semibold text-white text-base">{copy.title}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>
            {member.apellido}, {member.nombre}
          </p>
        </div>

        {confirming ? (
          /* Confirmación de baja: se enuncian las consecuencias reales, incluido
             lo que NO pasa, que es lo que más tranquiliza al administrador. */
          <div className="px-5 py-4 space-y-3">
            <p className="text-sm text-white">¿Confirmás la baja?</p>
            <ul className="text-xs space-y-1.5" style={{ color: 'var(--brand-muted)' }}>
              <li>· No podrá ingresar al club.</li>
              <li>· Se liberará su cochera, si tiene una asignada.</li>
              <li>· Su historial de ingresos y sus datos se conservan.</li>
              <li>· Podés reactivarlo cuando vuelva, sin perder antigüedad.</li>
            </ul>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--brand-muted)' }}>
                {op === 'reactivate' ? 'Fecha efectiva' : 'Desde'}
              </label>
              <input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm"
                style={fieldStyle}
              />
            </div>

            {op === 'suspend' && (
              <div>
                <button
                  type="button"
                  onClick={() => setHasUntil(v => !v)}
                  className="flex items-center gap-2 text-xs mb-1.5"
                  style={{ color: 'var(--brand-muted)' }}
                >
                  <span
                    className="w-4 h-4 rounded flex items-center justify-center text-[10px]"
                    style={{
                      border: '1px solid rgba(255,255,255,0.25)',
                      backgroundColor: hasUntil ? 'var(--brand-gold)' : 'transparent',
                      color: '#1a1a1c',
                    }}
                  >
                    {hasUntil ? '✓' : ''}
                  </span>
                  Tiene fecha de finalización prevista
                </button>
                {hasUntil && (
                  <input
                    type="date"
                    value={until}
                    min={from}
                    onChange={e => setUntil(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm"
                    style={fieldStyle}
                  />
                )}
              </div>
            )}

            <div>
              <label className="block text-xs mb-1.5" style={{ color: 'var(--brand-muted)' }}>
                Motivo {!reasonRequired && '(opcional)'}
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {QUICK_REASONS[op].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className="px-2.5 py-1 rounded-full text-[11px] transition-colors"
                    style={
                      reason === r
                        ? { backgroundColor: copy.color, color: '#1a1a1c' }
                        : { backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)' }
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={reason}
                maxLength={500}
                onChange={e => setReason(e.target.value)}
                placeholder="Motivo"
                className="w-full rounded-xl px-3 py-2.5 text-sm"
                style={fieldStyle}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="px-5 pb-2 text-xs" style={{ color: '#f87171' }}>
            {error}
          </p>
        )}

        <div className="px-4 pt-1 flex gap-2">
          <button
            onClick={confirming ? () => setConfirming(false) : close}
            className="flex-1 py-3.5 rounded-xl text-sm font-medium active:opacity-60"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}
          >
            {confirming ? 'Volver' : 'Cancelar'}
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold active:opacity-60 disabled:opacity-50"
            style={{ backgroundColor: copy.color, color: '#1a1a1c' }}
          >
            {loading ? 'Guardando…' : copy.cta}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
