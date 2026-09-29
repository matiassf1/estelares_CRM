import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAssocAuth } from '../../contexts/AssocAuthContext';
import { assocApi, Accreditation, AssocMatch } from '../../lib/assocApi';

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AssocPlanilla() {
  const { user } = useAssocAuth();
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const [accreditations, setAccreditations] = useState<Accreditation[]>([]);
  const [match, setMatch] = useState<AssocMatch | null>(null);
  const [loading, setLoading] = useState(true);

  if (!user) { navigate('/assoc/login', { replace: true }); return null; }

  const load = useCallback(async () => {
    if (!matchId) return;
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--brand-bg)' }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--brand-primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-page { padding: 20px !important; background: white !important; color: black !important; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #999; padding: 6px 10px; }
          th { background: #f3f4f6; }
        }
      `}</style>

      <div className="min-h-screen print-page" style={{ backgroundColor: 'var(--brand-bg)' }}>
        {/* Nav — hidden when printing */}
        <div className="no-print px-5 pt-5 pb-3 flex items-center justify-between" style={{ backgroundColor: 'var(--brand-surface)', borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.1)' }}>
          <button onClick={() => navigate(-1)} className="text-sm active:opacity-70" style={{ color: 'var(--brand-muted)' }}>← Volver</button>
          <button
            onClick={() => window.print()}
            className="text-sm px-4 py-2 rounded-xl font-semibold active:scale-95 transition-all"
            style={{ backgroundColor: 'var(--brand-primary)', color: 'white' }}
          >
            Imprimir / Guardar PDF
          </button>
        </div>

        <div className="p-6 max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--brand-muted)' }}>
              ASOCIACIÓN TUCUMANA DEMO
            </p>
            <h1 className="text-2xl font-bold text-white">
              {match?.home_team_name ?? '?'} vs {match?.away_team_name ?? '?'}
            </h1>
            {match && (
              <p className="text-sm mt-2" style={{ color: 'var(--brand-muted)' }}>
                {formatDateTime(match.scheduled_at)}
                {match.venue ? ` · ${match.venue}` : ''}
              </p>
            )}
            <p className="text-xs mt-1" style={{ color: 'var(--brand-muted)' }}>
              Temporada: {match?.season_name ?? '—'}
            </p>
          </div>

          {/* Home table */}
          <div className="mb-8">
            <h2 className="font-display uppercase tracking-wide text-sm mb-3 text-white">
              {match?.home_team_name ?? 'Local'} — {home.length} jugadores
            </h2>
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgb(var(--brand-accent-rgb) / 0.2)' }}>
                  <th className="text-left py-2 pr-4 w-10" style={{ color: 'var(--brand-muted)' }}>#</th>
                  <th className="text-left py-2 pr-4" style={{ color: 'var(--brand-muted)' }}>Jugador</th>
                  <th className="text-left py-2" style={{ color: 'var(--brand-muted)' }}>Documento</th>
                </tr>
              </thead>
              <tbody>
                {home.map((a, i) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.08)' }}>
                    <td className="py-2 pr-4 text-white">{i + 1}</td>
                    <td className="py-2 pr-4 text-white font-medium">{a.last_name}, {a.first_name}</td>
                    <td className="py-2" style={{ color: 'var(--brand-muted)' }}>
                      {a.document_type && a.document_number ? `${a.document_type} ${a.document_number}` : '—'}
                    </td>
                  </tr>
                ))}
                {home.length === 0 && (
                  <tr><td colSpan={3} className="py-4 text-center" style={{ color: 'var(--brand-muted)' }}>Sin acreditados</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Away table */}
          <div>
            <h2 className="font-display uppercase tracking-wide text-sm mb-3 text-white">
              {match?.away_team_name ?? 'Visitante'} — {away.length} jugadores
            </h2>
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgb(var(--brand-accent-rgb) / 0.2)' }}>
                  <th className="text-left py-2 pr-4 w-10" style={{ color: 'var(--brand-muted)' }}>#</th>
                  <th className="text-left py-2 pr-4" style={{ color: 'var(--brand-muted)' }}>Jugador</th>
                  <th className="text-left py-2" style={{ color: 'var(--brand-muted)' }}>Documento</th>
                </tr>
              </thead>
              <tbody>
                {away.map((a, i) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.08)' }}>
                    <td className="py-2 pr-4 text-white">{i + 1}</td>
                    <td className="py-2 pr-4 text-white font-medium">{a.last_name}, {a.first_name}</td>
                    <td className="py-2" style={{ color: 'var(--brand-muted)' }}>
                      {a.document_type && a.document_number ? `${a.document_type} ${a.document_number}` : '—'}
                    </td>
                  </tr>
                ))}
                {away.length === 0 && (
                  <tr><td colSpan={3} className="py-4 text-center" style={{ color: 'var(--brand-muted)' }}>Sin acreditados</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 text-center" style={{ borderTop: '1px solid rgb(var(--brand-accent-rgb) / 0.1)' }}>
            <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
              Planilla generada el {new Date().toLocaleString('es-AR')}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--brand-muted)' }}>
              Solo incluye jugadores acreditados físicamente
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
