import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { api, CheckInEntry } from '../lib/api.ts';
import { useCountUp } from '../hooks/useCountUp.ts';
import ClubShield from '../components/ClubShield.tsx';

function VehicleIcon({ tipo }: { tipo?: string | null }) {
  if (!tipo) return null;
  if (tipo === 'moto') return (
    <span title="Moto" className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ backgroundColor: 'rgb(var(--brand-accent-rgb) / 0.15)', color: 'var(--brand-accent)' }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" />
        <path d="M8 17.5h7M15 17.5l-3-6h-2l-2 3h2" /><path d="M17 10l-2-3h-4" />
      </svg>
      Moto
    </span>
  );
  if (tipo === 'auto') return (
    <span title="Auto" className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--brand-muted)' }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 17H3a1 1 0 01-1-1v-4l2-5h14l2 5v4a1 1 0 01-1 1h-2" />
        <circle cx="7.5" cy="17.5" r="2.5" /><circle cx="16.5" cy="17.5" r="2.5" />
        <path d="M5 12h14" />
      </svg>
      Auto
    </span>
  );
  if (tipo === 'bicicleta') return (
    <span title="Bicicleta" className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: 'rgb(34,197,94)' }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5" cy="17" r="3" /><circle cx="19" cy="17" r="3" />
        <path d="M12 17V9l-3 3m3-3l3 3" /><path d="M9 17l3-8h5" />
      </svg>
      Bici
    </span>
  );
  return null;
}

export default function Portero() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [qr, setQr] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [checkIns, setCheckIns] = useState<CheckInEntry[]>([]);
  const [loadingQr, setLoadingQr] = useState(true);
  const [newestId, setNewestId] = useState<string | null>(null);
  const prevCount = useRef(0);
  const animatedCount = useCountUp(checkIns.length, 600);

  const fetchQr = useCallback(async () => {
    try {
      const data = await api.getPorteroQr();
      setQr(data.qr);
      setCountdown(data.expiresIn);
    } catch { /* retry */ }
    finally { setLoadingQr(false); }
  }, []);

  const fetchCheckIns = useCallback(async () => {
    try {
      const data = await api.todayCheckIns();
      // Detect new entry for flash animation
      if (data.length > prevCount.current && data[0]) {
        setNewestId(data[0].checked_in_at);
        setTimeout(() => setNewestId(null), 1200);
      }
      prevCount.current = data.length;
      setCheckIns(data);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { fetchQr(); fetchCheckIns(); }, [fetchQr, fetchCheckIns]);

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { fetchQr(); return 30; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [fetchQr]);

  useEffect(() => {
    const t = setInterval(fetchCheckIns, 5000);
    return () => clearInterval(t);
  }, [fetchCheckIns]);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  const pct = (countdown / 30) * 100;
  const isLow = countdown <= 7;

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      {/* Header */}
      <div className="bg-brand-surface border-b border-brand-border px-5 py-3 flex justify-between items-center animate-fade-in">
        <div className="flex items-center gap-3">
          <ClubShield size={32} className="opacity-80" />
          <div>
            <p className="text-white text-sm font-semibold leading-tight">Estelares Futsal</p>
            <p className="text-brand-muted text-xs leading-tight">Portal Portero</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user?.type === 'admin' && (
            <button onClick={() => navigate('/admin')} className="text-brand-gold text-xs font-semibold uppercase tracking-wider active:opacity-70">
              Admin
            </button>
          )}
          <button onClick={logout} className="text-brand-muted text-xs uppercase tracking-wider active:text-white">
            Salir
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-5 py-6 gap-5">

        {/* QR card */}
        <div className="w-full max-w-xs animate-slide-up" style={{ animationDelay: '0.05s' }}>
          <p className="text-brand-muted text-[10px] font-semibold uppercase tracking-[0.3em] text-center mb-3">
            Jugadores escanean este QR
          </p>

          <div className="bg-white rounded-2xl p-4 shadow-2xl relative overflow-hidden">
            {loadingQr ? (
              <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="relative">
                <img src={qr} alt="QR" className="w-full rounded-xl" />
                {/* Red scan-line sweeping over QR */}
                <div
                  className="absolute left-2 right-2 h-0.5 rounded-full animate-scan-line pointer-events-none"
                  style={{ background: 'linear-gradient(90deg, transparent, var(--brand-primary), transparent)', top: '10%' }}
                />
              </div>
            )}

            {/* Countdown bar */}
            <div className="mt-3">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${isLow ? 'bg-red-500' : 'bg-green-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between items-center mt-1.5">
                <span className="text-gray-500 text-[10px] font-medium">
                  {isLow ? 'Renovando pronto...' : 'QR activo'}
                </span>
                <span className={`text-[10px] font-mono font-bold ${isLow ? 'text-red-500' : 'text-gray-400'}`}>
                  {countdown}s
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div
          className="w-full max-w-xs bg-brand-surface border border-brand-border rounded-xl px-5 py-3 flex items-center justify-between animate-slide-up"
          style={{ animationDelay: '0.12s' }}
        >
          <div>
            <p className="text-brand-muted text-[10px] uppercase tracking-wider">Ingresos hoy</p>
            {/* Count-up animated number */}
            <p
              className="font-display text-white leading-none mt-0.5"
              style={{ fontSize: '2.6rem', transition: 'color 0.2s' }}
              key={checkIns.length} // re-triggers animation on change
            >
              {animatedCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-brand-red/10 border border-brand-red/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-brand-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>

        {/* Check-ins list */}
        <div className="w-full max-w-xs animate-slide-up" style={{ animationDelay: '0.18s' }}>
          <p className="text-brand-muted text-[10px] font-semibold uppercase tracking-[0.3em] mb-3">
            Últimos ingresos
          </p>

          {checkIns.length === 0 ? (
            <div className="bg-brand-surface border border-brand-border rounded-xl py-8 text-center">
              <p className="text-brand-muted/50 text-sm">Sin ingresos todavía</p>
            </div>
          ) : (
            <div className="space-y-2">
              {checkIns.map((entry, i) => {
                const isNew = entry.checked_in_at === newestId;
                return (
                  <div
                    key={entry.checked_in_at}
                    className={`rounded-xl px-4 py-3 flex justify-between items-center border transition-all duration-700 ${
                      isNew
                        ? 'animate-gold-flash'
                        : i === 0
                          ? 'bg-brand-surface border-brand-red/30'
                          : 'bg-brand-surface border-brand-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {i === 0 && (
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-red flex-shrink-0 animate-pulse" />
                      )}
                      <div>
                        <p className="text-white text-sm font-semibold">
                          {entry.nombre} {entry.apellido}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {entry.patente && (
                            <p className="text-brand-muted text-xs">{entry.patente}</p>
                          )}
                          <VehicleIcon tipo={entry.tipo_vehiculo} />
                        </div>
                      </div>
                    </div>
                    <span className="text-brand-muted text-xs font-mono">{formatTime(entry.checked_in_at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
