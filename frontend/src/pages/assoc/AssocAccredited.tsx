import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAssocAuth } from '../../contexts/AssocAuthContext';
import { assocApi, Accreditation, AssocMatch } from '../../lib/assocApi';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function PlayerRow({ a }: { a: Accreditation }) {
  return (
    <div
      className="flex items-center gap-3 py-2.5 border-b last:border-b-0"
      style={{ borderColor: 'rgb(var(--brand-accent-rgb) / 0.08)' }}
    >
      {a.photo_url ? (
        <img
          src={a.photo_url}
          alt=""
          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          {(a.first_name[0] + a.last_name[0]).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-semibold truncate">
          {a.last_name}, {a.first_name}
        </p>
      </div>
      <p className="text-xs flex-shrink-0" style={{ color: 'var(--brand-muted)' }}>
        {formatTime(a.accredited_at)}
      </p>
    </div>
  );
}

export default function AssocAccredited() {
  const { user } = useAssocAuth();
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const [accreditations, setAccreditations] = useState<Accreditation[]>([]);
  const [match, setMatch] = useState<AssocMatch | null>(null);
  const [loading, setLoading] = useState(true);

  if (!user) { navigate('/assoc/login', { replace: true }); return null; }

  const load = useCallback(async () => {
    if (!matchId) return;
    setLoading(true);
    try {
      const [acc, matches] = await Promise.all([
        assocApi.listAccreditations(matchId),
        assocApi.listMatches(),
      ]);
      setAccreditations(acc);
      setMatch(matches.find(m => m.id === matchId) ?? null);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [matchId]);

  useEffect(() => { load(); }, [load]);

  const home = match ? accreditations.filter(a => a.team_name === match.home_team_name) : [];
  const away = match ? accreditations.filter(a => a.team_name === match.away_team_name) : [];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--brand-bg)' }}>
      {/* Header */}
      <div
        className="px-5 pt-safe-top pb-4 flex-shrink-0"
        style={{ backgroundColor: 'var(--brand-surface)', borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.1)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => navigate(-1)}
            className="text-sm active:opacity-70"
            style={{ color: 'var(--brand-muted)' }}
          >
            ← Volver
          </button>
          <button
            onClick={() => navigate(`/assoc/matches/${matchId}/planilla`)}
            className="text-xs px-3 py-1.5 rounded-lg active:opacity-70"
            style={{ color: 'var(--brand-muted)', backgroundColor: 'rgba(255,255,255,0.05)' }}
          >
            Ver planilla →
          </button>
        </div>
        {match && (
          <div className="text-center">
            <p className="font-display text-white text-base uppercase tracking-wide">
              {match.home_team_name} <span style={{ color: 'var(--brand-muted)' }}>vs</span> {match.away_team_name}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--brand-muted)' }}>
              {accreditations.length} acreditados en total
            </p>
          </div>
        )}
      </div>

      <div className="p-5 max-w-lg mx-auto space-y-5">
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--brand-primary)', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            {/* Home team */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.1)' }}
            >
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.08)' }}>
                <p className="font-display text-white text-sm uppercase tracking-wide">
                  {match?.home_team_name ?? 'Local'}
                </p>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'rgb(var(--brand-primary-rgb) / 0.15)', color: 'var(--brand-primary)' }}
                >
                  {home.length}
                </span>
              </div>
              <div className="px-4">
                {home.length === 0 ? (
                  <p className="py-4 text-sm text-center" style={{ color: 'var(--brand-muted)' }}>Sin acreditados</p>
                ) : (
                  home.map(a => <PlayerRow key={a.id} a={a} />)
                )}
              </div>
            </div>

            {/* Away team */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.1)' }}
            >
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.08)' }}>
                <p className="font-display text-white text-sm uppercase tracking-wide">
                  {match?.away_team_name ?? 'Visitante'}
                </p>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'rgb(var(--brand-primary-rgb) / 0.15)', color: 'var(--brand-primary)' }}
                >
                  {away.length}
                </span>
              </div>
              <div className="px-4">
                {away.length === 0 ? (
                  <p className="py-4 text-sm text-center" style={{ color: 'var(--brand-muted)' }}>Sin acreditados</p>
                ) : (
                  away.map(a => <PlayerRow key={a.id} a={a} />)
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
