import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';

interface DemoPlayer {
  id: string;
  firstName: string;
  lastName: string;
  teamName: string;
  status: string;
  qrPayload: string;
}

export default function AssocDemoCarnets() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<DemoPlayer[]>([]);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/assoc/players/demo/carnets')
      .then(r => r.json())
      .then(async (data: DemoPlayer[]) => {
        setPlayers(data);
        const imgs: Record<string, string> = {};
        for (const p of data) {
          imgs[p.id] = await QRCode.toDataURL(p.qrPayload, { width: 200, margin: 1 });
        }
        setQrImages(imgs);
      })
      .finally(() => setLoading(false));
  }, []);

  const byTeam: Record<string, DemoPlayer[]> = {};
  for (const p of players) {
    if (!byTeam[p.teamName]) byTeam[p.teamName] = [];
    byTeam[p.teamName].push(p);
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--brand-bg)' }}>
      <div
        className="px-5 pt-5 pb-4 flex items-center gap-3"
        style={{ backgroundColor: 'var(--brand-surface)', borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.1)' }}
      >
        <button onClick={() => navigate('/assoc/matches')} className="text-sm active:opacity-70" style={{ color: 'var(--brand-muted)' }}>
          ← Partidos
        </button>
        <div>
          <h1 className="font-display text-white text-base tracking-wide uppercase">Carnets Demo</h1>
          <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>Escaneá estos QR para probar la acreditación</p>
        </div>
      </div>

      <div className="p-5 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex justify-center pt-16">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--brand-primary)', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          Object.entries(byTeam).map(([team, teamPlayers]) => (
            <div key={team} className="mb-8">
              <h2 className="font-display text-white text-sm uppercase tracking-wide mb-4">{team}</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {teamPlayers.map(p => (
                  <div
                    key={p.id}
                    className="rounded-xl p-4 text-center"
                    style={{
                      backgroundColor: 'var(--brand-surface)',
                      border: `1px solid ${p.status === 'ENABLED' ? 'rgba(34,197,94,0.2)' : 'rgba(248,113,113,0.2)'}`,
                      opacity: p.status === 'ENABLED' ? 1 : 0.6,
                    }}
                  >
                    {qrImages[p.id] ? (
                      <img src={qrImages[p.id]} alt="QR" className="w-full rounded-lg mb-2" />
                    ) : (
                      <div className="w-full aspect-square rounded-lg mb-2" style={{ backgroundColor: 'var(--brand-bg)' }} />
                    )}
                    <p className="text-white text-xs font-semibold truncate">{p.lastName}, {p.firstName}</p>
                    <p className="text-xs mt-0.5" style={{ color: p.status === 'ENABLED' ? '#22c55e' : '#f87171' }}>
                      {p.status === 'ENABLED' ? '● Habilitado' : '● No habilitado'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
