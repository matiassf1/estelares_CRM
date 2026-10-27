import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { lockBodyScroll } from '../utils/scrollLock';
import {
  api,
  type MembershipRequest,
  type MembershipRequestKind,
  type MembershipStatus,
} from '../lib/api';

/**
 * Formulario del JUGADOR para pedir una suspensión, una baja o una reactivación.
 *
 * Sigue el patrón visual de `components/admin/MembershipSheet`, pero no lo
 * reutiliza: aquel llama a `api.suspendMember` y compañía, que son rutas de
 * administrador. Un jugador que las tocara comería un 403.
 *
 * Nada de lo que se envía acá cambia el estado del jugador: sólo deja una
 * intención con fecha, que es la prueba de cuándo avisó.
 */

/**
 * Espejo exacto de `ALLOWED_BY_STATUS` en `services/membershipRequests.ts`.
 * No se ofrece nada que el backend vaya a rechazar: proponer una opción
 * imposible y responder con un error es peor que no ofrecerla.
 */
export const ALLOWED_KINDS: Record<MembershipStatus, MembershipRequestKind[]> = {
  ACTIVE: ['SUSPENSION', 'TERMINATION'],
  SUSPENDED: ['REACTIVATION', 'TERMINATION'],
  TERMINATED: ['REACTIVATION'],
};

export const KIND_LABEL: Record<MembershipRequestKind, string> = {
  SUSPENSION: 'Suspender mi membresía',
  TERMINATION: 'Darme de baja',
  REACTIVATION: 'Reactivar mi membresía',
};

/** Qué implica cada pedido, en una línea, antes de elegirlo. */
const KIND_HINT: Record<MembershipRequestKind, string> = {
  SUSPENSION: 'Pausa temporal: volvés cuando se termine.',
  TERMINATION: 'Dejás el club. Después podés pedir la reactivación.',
  REACTIVATION: 'Volvés a entrenar y a poder registrar ingresos.',
};

const KIND_COLOR: Record<MembershipRequestKind, string> = {
  SUSPENSION: 'var(--brand-gold)',
  TERMINATION: 'var(--brand-danger)',
  REACTIVATION: 'var(--brand-ok)',
};

const QUICK_REASONS: Record<MembershipRequestKind, string[]> = {
  SUSPENSION: ['Lesión', 'Viaje', 'Estudio', 'Motivos personales'],
  TERMINATION: ['Dejo el club', 'Me mudo', 'Paso a otro club', 'Falta de tiempo'],
  REACTIVATION: ['Quiero volver', 'Alta médica', 'Ya puedo entrenar'],
};

/** El tope del backend. Más allá no es planificar, es ruido en la bandeja. */
const MAX_ADVANCE_DAYS = 180;

function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

interface Props {
  /** Estado vigente del jugador: determina qué puede pedir. */
  status: MembershipStatus;
  onClose: () => void;
  /** La solicitud recién creada, para pintar la tarjeta sin recargar. */
  onCreated: (request: MembershipRequest) => void;
}

export default function RequestSheet({ status, onClose, onCreated }: Props) {
  const options = ALLOWED_KINDS[status];
  const [visible, setVisible] = useState(false);
  const [kind, setKind] = useState<MembershipRequestKind>(options[0]);
  const [from, setFrom] = useState(isoPlusDays(0));
  const [until, setUntil] = useState('');
  const [hasUntil, setHasUntil] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const today = isoPlusDays(0);
  const maxFrom = isoPlusDays(MAX_ADVANCE_DAYS);

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

  // Cambiar de tipo descarta la fecha de fin: sólo la suspensión la admite, y
  // mandarla con otro tipo es un 400 seguro.
  const pickKind = (k: MembershipRequestKind) => {
    setKind(k);
    if (k !== 'SUSPENSION') { setHasUntil(false); setUntil(''); }
    setError('');
  };

  const submit = async () => {
    setError('');
    if (!reason.trim()) {
      setError('Contanos el motivo: es lo que el club va a leer para resolver.');
      return;
    }
    if (from < today) {
      setError('La fecha no puede ser anterior a hoy.');
      return;
    }
    setLoading(true);
    try {
      const { request } = await api.createMembershipRequest({
        kind,
        effective_from: from,
        effective_until: kind === 'SUSPENSION' && hasUntil && until ? until : null,
        reason: reason.trim(),
      });
      onCreated(request);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud');
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
        className="w-full rounded-t-2xl md:max-w-md md:mx-auto md:mb-8 md:rounded-2xl overflow-y-auto"
        style={{
          backgroundColor: '#1a1a1c',
          border: '1px solid rgba(255,255,255,0.1)',
          maxHeight: '92vh',
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
          <p className="font-display tracking-wide text-white text-base">Solicitud al club</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>
            Queda registrada con la fecha de hoy. No cambia nada hasta que el club la apruebe.
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Tipo: sólo lo que el estado actual admite. */}
          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--brand-muted)' }}>
              Qué querés pedir
            </label>
            <div className="space-y-1.5">
              {options.map(k => {
                const on = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => pickKind(k)}
                    className="w-full text-left rounded-xl px-3 py-2.5 transition-all active:scale-[0.98]"
                    style={{
                      backgroundColor: on
                        ? `color-mix(in srgb, ${KIND_COLOR[k]} 14%, transparent)`
                        : 'rgba(255,255,255,0.05)',
                      border: on
                        ? `1px solid ${KIND_COLOR[k]}`
                        : '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <span
                      className="block text-[13px] font-semibold"
                      style={{ color: on ? KIND_COLOR[k] : 'white' }}
                    >
                      {KIND_LABEL[k]}
                    </span>
                    <span className="block text-[11px] mt-0.5" style={{ color: 'var(--brand-muted)' }}>
                      {KIND_HINT[k]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: 'var(--brand-muted)' }}>
              Desde cuándo
            </label>
            <input
              type="date"
              value={from}
              min={today}
              max={maxFrom}
              onChange={e => setFrom(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={fieldStyle}
            />
            <p className="text-[11px] mt-1" style={{ color: 'rgb(var(--brand-muted-rgb) / 0.7)' }}>
              No podés elegir una fecha pasada: la solicitud vale desde que la hacés.
            </p>
          </div>

          {/* `effective_until` sólo existe para la suspensión. */}
          {kind === 'SUSPENSION' && (
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
                Ya sé hasta cuándo
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
              Motivo
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {QUICK_REASONS[kind].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className="px-2.5 py-1 rounded-full text-[11px] transition-colors"
                  style={
                    reason === r
                      ? { backgroundColor: KIND_COLOR[kind], color: '#1a1a1c' }
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
              placeholder="Contale al club por qué"
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={fieldStyle}
            />
          </div>
        </div>

        {error && (
          <p className="px-5 pb-2 text-xs" style={{ color: 'var(--brand-danger)' }}>
            {error}
          </p>
        )}

        <div className="px-4 pt-1 flex gap-2">
          <button
            onClick={close}
            className="flex-1 py-3.5 rounded-xl text-sm font-medium active:opacity-60"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold font-display tracking-wide active:opacity-60 disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }}
          >
            {loading ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
