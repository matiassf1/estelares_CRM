import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { api } from '../lib/api.ts';
import ClubShield from '../components/ClubShield.tsx';

interface TodayStatus { ingresado: boolean; hora?: string; }
interface CarnetData {
  nombre?: string; apellido?: string; dni?: string; patente?: string; foto_url?: string; estacionamiento?: string;
}

interface Props {
  /** Pass mock data to bypass API (for preview/demo) */
  mock?: CarnetData & { status?: TodayStatus };
}

export default function Carnet({ mock }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<TodayStatus | null>(mock?.status ?? null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(() => {
    if (mock || !user?.id) return null;
    return localStorage.getItem(`qr_cache_${user.id}`);
  });

  const data: CarnetData = mock ?? user ?? {};

  const statusRef = useRef<TodayStatus | null>(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => {
    if (mock) return;
    const fetchStatus = () => { api.todayStatus().then((s) => { setStatus(s); }).catch(() => {}); };
    fetchStatus();
    const interval = setInterval(() => { if (!statusRef.current?.ingresado) fetchStatus(); }, 8000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !statusRef.current?.ingresado) fetchStatus();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [mock]);

  useEffect(() => {
    if (mock || !user?.id) return;
    api.getCarnetQr()
      .then(({ qr }) => {
        setQrDataUrl(qr);
        localStorage.setItem(`qr_cache_${user.id}`, qr);
      })
      .catch(() => {
        // offline — uses cache loaded in initial state
      });
  }, [mock, user?.id]);

  const horaIngreso = status?.hora
    ? new Date(status.hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : null;

  const temporada = new Date().getFullYear();

  return (
    <div className="min-h-screen pattern-lines flex flex-col overflow-y-auto" style={{ backgroundColor: 'var(--brand-bg)' }}>
      {!mock && (
        <div className="flex justify-between items-center px-5 pt-5 pb-4 animate-fade-in">
          {!status?.ingresado ? (
            <button onClick={() => navigate('/check-in')}
              className="flex items-center gap-1.5 text-xs uppercase tracking-wider transition-colors active:text-white"
              style={{ color: 'var(--brand-muted)' }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Ingresar
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3">
            <button onClick={logout} className="text-xs uppercase tracking-wider active:text-white" style={{ color: 'var(--brand-muted)' }}>
              Salir
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center px-5 pt-6 pb-12">

        {/* ── CARD ── */}
        <div
          className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-card-reveal"
          style={{ border: '1px solid rgb(var(--brand-primary-rgb) / 0.2)', animationDelay: '0.05s' }}
        >
          {/* RED HEADER */}
          <div className="relative overflow-hidden px-5 pt-5 pb-16"
            style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-darker) 100%)' }}>
            <div className="absolute inset-0 pattern-lines opacity-20" />
            {/* Corner glow */}
            <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)' }} />
            {/* Bottom diagonal cut */}
            <div className="absolute bottom-0 left-0 right-0 h-12"
              style={{ backgroundColor: 'var(--brand-surface)', clipPath: 'polygon(0 100%, 100% 0, 100% 100%)' }} />

            <div className="relative z-10 flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-0.5"
                  style={{ color: 'rgba(255,255,255,0.88)' }}>
                  Estelares Futsal
                </p>
                <p className="font-display text-white text-3xl tracking-widest leading-none">CARNET</p>
                <p className="text-xs tracking-[0.25em] mt-1 font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  TEMPORADA {temporada}
                </p>
              </div>
              <ClubShield size={48} className="opacity-95 animate-scale-in animate-shield-glow-white" variant="white" />
            </div>
          </div>

          {/* DARK BODY */}
          <div className="px-5 pt-2 pb-5" style={{ backgroundColor: 'var(--brand-surface)' }}>

            {/* Photo + name */}
            <div className="relative z-10 flex items-end gap-4 -mt-12 mb-6">
              <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 animate-scale-in"
                style={{ border: '2px solid var(--brand-accent)', backgroundColor: 'var(--brand-surface-2)', animationDelay: '0.25s' }}>
                {data.foto_url ? (
                  <img src={data.foto_url} alt={data.nombre} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-8 h-8" style={{ color: 'var(--brand-border)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="pb-1 min-w-0 animate-slide-up" style={{ animationDelay: '0.3s' }}>
                <p className="font-display text-white leading-none truncate"
                  style={{ fontSize: '1.9rem', letterSpacing: '0.06em' }}>
                  {data.apellido?.toUpperCase() || 'APELLIDO'}
                </p>
                <p className="text-sm font-medium truncate mt-0.5" style={{ color: 'var(--brand-accent)' }}>
                  {data.nombre || 'Nombre'}
                </p>
              </div>
            </div>

            {/* Gold divider */}
            <div className="h-px mb-4" style={{ background: 'linear-gradient(90deg, rgb(var(--brand-accent-rgb) / 0.4), transparent)' }} />

            {/* Info chips */}
            <div className="grid grid-cols-2 gap-2 mb-4 animate-slide-up" style={{ animationDelay: '0.38s' }}>
              <div className={`rounded-xl px-3 py-2.5${!data.patente ? ' col-span-2' : ''}`}
                style={{ backgroundColor: 'var(--brand-bg)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.28)' }}>
                <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--brand-accent)' }}>DNI</p>
                <p className="text-white text-sm font-semibold tracking-wide">{data.dni || '—'}</p>
              </div>
              {data.patente && (
                <div className="rounded-xl px-3 py-2.5"
                  style={{ backgroundColor: 'var(--brand-bg)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.28)' }}>
                  <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--brand-accent)' }}>Patente</p>
                  <p className="text-white text-sm font-semibold tracking-wide">{data.patente}</p>
                </div>
              )}
              {data.estacionamiento && (
                <div className="col-span-2 rounded-xl px-3 py-2.5 flex items-center gap-3"
                  style={{ backgroundColor: 'var(--brand-bg)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.22)' }}>
                  <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--brand-accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17H7a2 2 0 01-2-2v-5a2 2 0 012-2h10a2 2 0 012 2v5a2 2 0 01-2 2h-2m-8 0a1 1 0 102 0m6 0a1 1 0 102 0M7 8l2-3h6l2 3" />
                  </svg>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest leading-none mb-0.5" style={{ color: 'var(--brand-accent)' }}>Estacionamiento</p>
                    <p className="text-white text-sm font-semibold tracking-wide">{data.estacionamiento}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="animate-slide-up" style={{ animationDelay: '0.46s' }}>
              {status === null ? (
                <div className="h-12 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--brand-surface-2)' }} />
              ) : status.ingresado ? (
                <div className="flex items-center gap-3 rounded-xl px-4 py-3"
                  style={{ backgroundColor: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.25)' }}>
                  <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0 animate-pulse" />
                  <div>
                    <p className="text-xs font-bold tracking-wider" style={{ color: '#4ade80' }}>INGRESÓ HOY</p>
                    {horaIngreso && (
                      <p className="text-xs mt-0.5" style={{ color: 'rgba(74,222,128,0.55)' }}>{horaIngreso} · Zona Jugadores</p>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => !mock && navigate('/check-in')}
                  className="btn-red w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 active:scale-95 transition-all"
                  style={{ backgroundColor: 'var(--brand-primary)', border: 'none' }}
                >
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="font-display tracking-widest text-white text-base">ESCANEAR QR</span>
                </button>
              )}
            </div>
          </div>

          {/* FOOTER */}
          <div className="px-5 py-3 flex justify-between items-center"
            style={{ backgroundColor: 'var(--brand-bg)', borderTop: '1px solid rgb(var(--brand-accent-rgb) / 0.15)' }}>
            <p className="text-[10px] tracking-widest uppercase" style={{ color: 'rgb(var(--brand-accent-rgb) / 0.65)' }}>
              Miembro activo
            </p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--brand-primary)' }} />
              <p className="text-[10px] tracking-widest uppercase" style={{ color: 'rgb(var(--brand-accent-rgb) / 0.65)' }}>
                Estelares · {temporada}
              </p>
            </div>
          </div>
        </div>

        {!mock && (
          <div className="w-full max-w-sm mt-4 rounded-2xl overflow-hidden animate-slide-up"
            style={{ animationDelay: '0.55s', backgroundColor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.2)' }}>
            <div className="px-5 py-4 flex flex-col items-center gap-3">
              <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: 'var(--brand-accent)' }}>
                Mostrá este código al portero
              </p>
              {qrDataUrl ? (
                <div className="rounded-xl overflow-hidden p-3 bg-white">
                  <img src={qrDataUrl} alt="QR personal" className="w-44 h-44 block" />
                </div>
              ) : (
                <div className="w-44 h-44 rounded-xl animate-pulse flex items-center justify-center"
                  style={{ backgroundColor: 'var(--brand-surface-2)' }}>
                  <p className="text-[10px] text-center px-4" style={{ color: 'rgb(var(--brand-muted-rgb) / 0.5)' }}>
                    Conectate para cargar tu QR
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {!mock && <OfflineBanner />}
      </div>
    </div>
  );
}

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (!offline) return null;
  return (
    <div className="mt-4 flex items-center gap-2 rounded-xl px-4 py-3 w-full max-w-sm animate-slide-up"
      style={{ backgroundColor: 'rgb(var(--brand-accent-rgb) / 0.08)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.2)' }}>
      <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--brand-accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M6.343 6.343a9 9 0 000 12.728M9.172 9.172a5 5 0 000 7.072M12 12h.01" />
      </svg>
      <p className="text-xs" style={{ color: 'var(--brand-accent)' }}>Sin conexión — datos en caché</p>
    </div>
  );
}
