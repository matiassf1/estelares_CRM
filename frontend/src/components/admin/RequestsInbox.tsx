import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { lockBodyScroll } from '../../utils/scrollLock';
import {
  api,
  type MembershipRequestKind,
  type MembershipRequestRow,
} from '../../lib/api';
import { formatPlayerName } from '../../utils/format';
import PlayerAvatar from './PlayerAvatar';
import MembershipBadge, { shortDate } from './MembershipBadge';

/**
 * Bandeja de solicitudes del administrador.
 *
 * Vive en su propio archivo y no inline en `JugadoresPage`: esa página ya pasa
 * las 400 líneas y tiene su propio estado (selección múltiple, filtros, hojas
 * de membresía). La bandeja no comparte nada de eso salvo el refresco del
 * padrón, que entra por una sola prop.
 *
 * El listado y el contador del chip los posee `JugadoresPage`: el chip tiene
 * que saber cuántas hay pendientes antes de que la bandeja exista en pantalla,
 * así que la carga no puede vivir acá adentro.
 */

const KIND_LABEL: Record<MembershipRequestKind, string> = {
  SUSPENSION: 'Suspensión',
  TERMINATION: 'Baja',
  REACTIVATION: 'Reactivación',
};

const KIND_COLOR: Record<MembershipRequestKind, string> = {
  SUSPENSION: 'var(--brand-gold)',
  TERMINATION: 'var(--brand-danger)',
  REACTIVATION: 'var(--brand-ok)',
};

/** Consecuencias reales de aplicar cada tipo, para la confirmación. */
const KIND_CONSEQUENCES: Record<MembershipRequestKind, string[]> = {
  SUSPENSION: [
    'No podrá ingresar al club mientras dure.',
    'Su cochera se libera, si tiene una asignada.',
    'Su historial y sus datos se conservan.',
    'Vuelve a estar activo cuando lo reactives.',
  ],
  TERMINATION: [
    'No podrá ingresar al club.',
    'Se libera su cochera, si tiene una asignada.',
    'Su historial de ingresos y sus datos se conservan.',
    'Podés reactivarlo cuando vuelva, sin perder antigüedad.',
  ],
  REACTIVATION: [
    'Vuelve a poder ingresar al club.',
    'Se cierra el período vigente de suspensión o baja.',
    'No se le reasigna la cochera automáticamente.',
  ],
};

function hace(isoTimestamp: string): string {
  const dias = Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 86400000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  return `hace ${dias} días`;
}

const fieldStyle = {
  backgroundColor: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
};

// ── Hoja inferior genérica, mismo patrón que MembershipSheet ──────────────────

function Sheet({ title, subtitle, children, cta, ctaColor, onSubmit, onClose, loading, error }: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  cta: string;
  ctaColor: string;
  onSubmit: () => void;
  onClose: () => void;
  loading: boolean;
  error: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const unlock = lockBodyScroll();
    const t = requestAnimationFrame(() => setVisible(true));
    return () => { unlock(); cancelAnimationFrame(t); };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col justify-end backdrop-blur-mobile"
      style={{ backgroundColor: `rgba(0,0,0,${visible ? 0.6 : 0})`, transition: 'background-color 0.25s ease' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
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
          <p className="font-semibold text-white text-base">{title}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>{subtitle}</p>
        </div>
        <div className="px-5 py-4 space-y-4">{children}</div>
        {error && <p className="px-5 pb-2 text-xs" style={{ color: 'var(--brand-danger)' }}>{error}</p>}
        <div className="px-4 pt-1 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-xl text-sm font-medium active:opacity-60"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold active:opacity-60 disabled:opacity-50"
            style={{ backgroundColor: ctaColor, color: '#1a1a1c' }}
          >
            {loading ? 'Guardando…' : cta}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Bandeja ───────────────────────────────────────────────────────────────────

type Dialog =
  | { mode: 'approve' | 'modify' | 'reject'; req: MembershipRequestRow }
  | null;

interface Props {
  requests: MembershipRequestRow[];
  /** Refresca bandeja y padrón, y avisa con un Toast. */
  onResolved: (message: string) => void;
}

export default function RequestsInbox({ requests, onResolved }: Props) {
  const [dialog, setDialog] = useState<Dialog>(null);

  if (requests.length === 0) {
    return (
      <div className="text-center py-12 text-sm" style={{ color: 'rgb(var(--brand-muted-rgb) / 0.4)' }}>
        No hay solicitudes pendientes.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {requests.map(r => (
          <div
            key={r.id}
            className="rounded-xl p-3"
            style={{
              backgroundColor: 'var(--brand-surface)',
              border: '1px solid rgb(var(--brand-border-rgb) / 0.9)',
              borderLeft: `3px solid ${KIND_COLOR[r.kind]}`,
            }}
          >
            <div className="flex items-start gap-3">
              <PlayerAvatar nombre={r.nombre} apellido={r.apellido} fotoUrl={r.foto_url} size={36} square />
              <div className="min-w-0 flex-1">
                <p className="text-white font-semibold text-sm truncate">
                  {formatPlayerName(r.apellido, r.nombre)}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  <MembershipBadge member={{ status: r.member_status }} />
                  {r.categoria_nombre && (
                    <span className="text-[10px]" style={{ color: 'var(--brand-accent)' }}>
                      {r.categoria_nombre}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[10px] shrink-0" style={{ color: 'var(--brand-muted)' }}>
                {hace(r.requested_at)}
              </span>
            </div>

            <p className="text-[13px] font-semibold mt-2.5" style={{ color: KIND_COLOR[r.kind] }}>
              Pide {KIND_LABEL[r.kind].toLowerCase()} desde el {shortDate(r.effective_from)}
              {r.effective_until ? ` hasta el ${shortDate(r.effective_until)}` : ''}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--brand-muted)', lineHeight: 1.5 }}>
              Motivo: {r.reason}
            </p>

            <div className="flex gap-1.5 mt-3">
              <button
                onClick={() => setDialog({ mode: 'approve', req: r })}
                className="flex-1 font-display tracking-wide text-xs py-2.5 rounded-xl active:scale-95 transition-all"
                style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }}
              >
                Aprobar
              </button>
              <button
                onClick={() => setDialog({ mode: 'modify', req: r })}
                className="flex-1 font-display tracking-wide text-xs py-2.5 rounded-xl active:scale-95 transition-all"
                style={{ backgroundColor: 'rgba(212,167,44,0.12)', color: 'var(--brand-gold)', border: '1px solid rgba(212,167,44,0.4)' }}
              >
                Modificar
              </button>
              <button
                onClick={() => setDialog({ mode: 'reject', req: r })}
                className="flex-1 font-display tracking-wide text-xs py-2.5 rounded-xl active:scale-95 transition-all"
                style={{ backgroundColor: 'rgba(248,113,113,0.1)', color: 'var(--brand-danger)', border: '1px solid rgba(248,113,113,0.4)' }}
              >
                Rechazar
              </button>
            </div>
          </div>
        ))}
      </div>

      {dialog && (
        <ResolveDialog
          key={`${dialog.mode}-${dialog.req.id}`}
          mode={dialog.mode}
          req={dialog.req}
          onClose={() => setDialog(null)}
          onDone={msg => { setDialog(null); onResolved(msg); }}
        />
      )}
    </>
  );
}

function ResolveDialog({ mode, req, onClose, onDone }: {
  mode: 'approve' | 'modify' | 'reject';
  req: MembershipRequestRow;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  // Precargados con lo que pidió el jugador: el admin corrige, no vuelve a cargar.
  const [kind, setKind] = useState<MembershipRequestKind>(req.kind);
  const [from, setFrom] = useState(req.effective_from);
  const [until, setUntil] = useState(req.effective_until ?? '');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const nombre = formatPlayerName(req.apellido, req.nombre);

  const submit = async () => {
    setError('');
    if (mode === 'reject' && !note.trim()) {
      setError('Indicá el motivo del rechazo: es lo que va a quedar registrado.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'reject') {
        await api.rejectMembershipRequest(req.id, note.trim());
        onDone(`Solicitud de ${nombre} rechazada`);
      } else if (mode === 'approve') {
        // Sin overrides: se aplica exactamente lo pedido.
        await api.approveMembershipRequest(req.id);
        onDone(`${nombre}: ${KIND_LABEL[req.kind].toLowerCase()} aplicada`);
      } else {
        await api.approveMembershipRequest(req.id, {
          kind,
          effective_from: from,
          // El backend rechaza `effective_until` si el tipo final no es suspensión.
          effective_until: kind === 'SUSPENSION' && until ? until : null,
          note: note.trim() || undefined,
        });
        onDone(`${nombre}: ${KIND_LABEL[kind].toLowerCase()} aplicada desde el ${shortDate(from)}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo resolver la solicitud');
      setLoading(false);
    }
  };

  if (mode === 'approve') {
    return (
      <Sheet
        title="Aprobar la solicitud"
        subtitle={`${nombre} · ${KIND_LABEL[req.kind].toLowerCase()} desde el ${shortDate(req.effective_from)}`}
        cta="Aprobar"
        ctaColor={KIND_COLOR[req.kind]}
        onSubmit={submit}
        onClose={onClose}
        loading={loading}
        error={error}
      >
        <p className="text-sm text-white">Se aplica tal cual lo pidió. A partir de ahí:</p>
        <ul className="text-xs space-y-1.5" style={{ color: 'var(--brand-muted)' }}>
          {KIND_CONSEQUENCES[req.kind].map(c => <li key={c}>· {c}</li>)}
        </ul>
      </Sheet>
    );
  }

  if (mode === 'reject') {
    return (
      <Sheet
        title="Rechazar la solicitud"
        subtitle={`${nombre} · ${KIND_LABEL[req.kind].toLowerCase()}`}
        cta="Rechazar"
        ctaColor="var(--brand-danger)"
        onSubmit={submit}
        onClose={onClose}
        loading={loading}
        error={error}
      >
        <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
          Rechazar no cambia nada: el jugador sigue {req.member_status === 'ACTIVE' ? 'activo' : req.member_status === 'SUSPENDED' ? 'suspendido' : 'dado de baja'}.
        </p>
        <div>
          <label className="block text-xs mb-1.5" style={{ color: 'var(--brand-muted)' }}>Motivo del rechazo</label>
          <input
            type="text"
            value={note}
            maxLength={500}
            onChange={e => setNote(e.target.value)}
            placeholder="Por qué no corresponde"
            className="w-full rounded-xl px-3 py-2.5 text-sm"
            style={fieldStyle}
          />
        </div>
      </Sheet>
    );
  }

  // Modificar y aprobar: convertir una baja en suspensión, correr la fecha.
  return (
    <Sheet
      title="Modificar y aprobar"
      subtitle={`${nombre} · pidió ${KIND_LABEL[req.kind].toLowerCase()} desde el ${shortDate(req.effective_from)}`}
      cta="Aplicar"
      ctaColor={KIND_COLOR[kind]}
      onSubmit={submit}
      onClose={onClose}
      loading={loading}
      error={error}
    >
      <div>
        <label className="block text-xs mb-1.5" style={{ color: 'var(--brand-muted)' }}>Qué se aplica</label>
        <div className="flex gap-1.5 flex-wrap">
          {(['SUSPENSION', 'TERMINATION', 'REACTIVATION'] as MembershipRequestKind[]).map(k => (
            <button
              key={k}
              type="button"
              onClick={() => { setKind(k); if (k !== 'SUSPENSION') setUntil(''); }}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold"
              style={kind === k
                ? { backgroundColor: KIND_COLOR[k], color: '#1a1a1c' }
                : { backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)' }}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        {kind !== req.kind && (
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--brand-gold)' }}>
            Distinto de lo que pidió. Queda registrado en la auditoría.
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs mb-1.5" style={{ color: 'var(--brand-muted)' }}>Desde</label>
        <input
          type="date"
          value={from}
          onChange={e => setFrom(e.target.value)}
          className="w-full rounded-xl px-3 py-2.5 text-sm"
          style={fieldStyle}
        />
      </div>

      {kind === 'SUSPENSION' && (
        <div>
          <label className="block text-xs mb-1.5" style={{ color: 'var(--brand-muted)' }}>
            Hasta (opcional)
          </label>
          <input
            type="date"
            value={until}
            min={from}
            onChange={e => setUntil(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm"
            style={fieldStyle}
          />
        </div>
      )}

      <div>
        <label className="block text-xs mb-1.5" style={{ color: 'var(--brand-muted)' }}>Nota (opcional)</label>
        <input
          type="text"
          value={note}
          maxLength={500}
          onChange={e => setNote(e.target.value)}
          placeholder="Por qué se modificó"
          className="w-full rounded-xl px-3 py-2.5 text-sm"
          style={fieldStyle}
        />
      </div>

      <ul className="text-xs space-y-1.5" style={{ color: 'var(--brand-muted)' }}>
        {KIND_CONSEQUENCES[kind].map(c => <li key={c}>· {c}</li>)}
      </ul>
    </Sheet>
  );
}
