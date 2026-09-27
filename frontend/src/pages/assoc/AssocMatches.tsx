import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssocAuth } from '../../contexts/AssocAuthContext';
import { assocApi, AssocMatch } from '../../lib/assocApi';

function StatusBadge({ status }: { status: AssocMatch['status'] }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    SCHEDULED: { label: 'Programado', color: 'var(--brand-muted)', bg: 'rgba(255,255,255,0.06)' },
    ACCREDITATION_OPEN: { label: 'Acreditación abierta', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    IN_PROGRESS: { label: 'En curso', color: 'var(--brand-gold)', bg: 'rgba(212,167,44,0.1)' },
    FINISHED: { label: 'Finalizado', color: 'var(--brand-muted)', bg: 'rgba(255,255,255,0.04)' },
    CANCELLED: { label: 'Cancelado', color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  };
  const c = config[status] || config.SCHEDULED;
  return (
    <span
      className="text-xs font-semibold px-2 py-1 rounded-full"
      style={{ color: c.color, backgroundColor: c.bg }}
    >
      {c.label}
    </span>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function AssocMatches() {
  const { user, logout } = useAssocAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<AssocMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState<string | null>(null);

  if (!user) {
    navigate('/assoc/login', { replace: true });
    return null;
  }

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await assocApi.listMatches();
      setMatches(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar partidos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  const handleOpen = async (matchId: string) => {
    setOpening(matchId);
    try {
      await assocApi.openAccreditation(matchId);
      navigate(`/assoc/matches/${matchId}/accredit`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
      setOpening(null);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--brand-bg)' }}>
      {/* Header */}
      <div
        className="px-5 pt-safe-top pb-4 flex items-center justify-between"
        style={{ backgroundColor: 'var(--brand-surface)', borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.1)' }}
      >
        <div>
          <h1 className="font-display text-white text-lg tracking-wide uppercase">Partidos</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>Portal de Acreditación</p>
        </div>
        <button
          onClick={logout}
          className="text-xs px-3 py-1.5 rounded-lg transition-all active:opacity-70"
          style={{ color: 'var(--brand-muted)', backgroundColor: 'rgba(255,255,255,0.05)' }}
        >
          Salir
        </button>
      </div>

      <div className="p-5 max-w-lg mx-auto">
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--brand-primary)', borderTopColor: 'transparent' }} />
          </div>
        ) : error ? (
          <div className="text-center pt-16">
            <p style={{ color: 'var(--brand-primary)' }}>{error}</p>
            <button onClick={fetchMatches} className="mt-3 text-sm underline" style={{ color: 'var(--brand-muted)' }}>Reintentar</button>
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center pt-16">
            <p style={{ color: 'var(--brand-muted)' }}>No hay partidos programados</p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map(m => (
              <div
                key={m.id}
                className="rounded-2xl p-5"
                style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.1)' }}
              >
                {/* Teams */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <p className="font-display text-white text-base uppercase tracking-wide leading-tight">{m.home_team_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>{m.home_club_name}</p>
                  </div>
                  <div className="px-3 text-center flex-shrink-0">
                    <p className="font-display text-sm" style={{ color: 'var(--brand-muted)' }}>VS</p>
                  </div>
                  <div className="flex-1 text-right">
                    <p className="font-display text-white text-base uppercase tracking-wide leading-tight">{m.away_team_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>{m.away_club_name}</p>
                  </div>
                </div>

                {/* Meta */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <StatusBadge status={m.status} />
                  <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                    {formatDate(m.scheduled_at)} · {formatTime(m.scheduled_at)}
                  </span>
                </div>

                {m.venue && (
                  <p className="text-xs mb-3" style={{ color: 'var(--brand-muted)' }}>📍 {m.venue}</p>
                )}

                {/* Action */}
                {m.status === 'SCHEDULED' && (
                  <button
                    onClick={() => handleOpen(m.id)}
                    disabled={opening === m.id}
                    className="w-full py-3 rounded-xl font-display tracking-widest text-white text-sm transition-all active:scale-95 disabled:opacity-60"
                    style={{ backgroundColor: 'var(--brand-primary)' }}
                  >
                    {opening === m.id ? 'ABRIENDO…' : 'ABRIR ACREDITACIÓN'}
                  </button>
                )}
                {m.status === 'ACCREDITATION_OPEN' && (
                  <button
                    onClick={() => navigate(`/assoc/matches/${m.id}/accredit`)}
                    className="w-full py-3 rounded-xl font-display tracking-widest text-sm transition-all active:scale-95"
                    style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
                  >
                    IR A ACREDITACIÓN →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
