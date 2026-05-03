import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { api } from '../lib/api.ts';
import ClubShield from '../components/ClubShield.tsx';
import jsQR from 'jsqr';

type Status = 'idle' | 'scanning' | 'loading' | 'success' | 'already' | 'error';

export default function CheckIn() {
  const { user, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('idle');
  const [memberName, setMemberName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  // Prevents processToken from running concurrently (URL param + scanner firing at same time)
  const processingRef = useRef(false);

  const processToken = async (token: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setStatus('loading');
    try {
      const res = await api.checkIn(token);
      setMemberName(`${res.member.nombre} ${res.member.apellido}`);
      setStatus('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      setErrorMsg(msg);
      setStatus(msg.toLowerCase().includes('ya registraste') ? 'already' : 'error');
    } finally {
      processingRef.current = false;
    }
  };

  // On mount: process URL token (native camera) OR redirect to carnet if already checked in
  useEffect(() => {
    const token = searchParams.get('t');
    if (token) {
      processToken(token);
      return;
    }
    api.todayStatus()
      .then(s => { if (s.ingresado) navigate('/carnet', { replace: true }); })
      .catch(() => {});
  }, []);

  // In-app QR scanner using getUserMedia + jsQR (pure JS, no Web Workers, no CSP issues)
  useEffect(() => {
    const video = videoRef.current;
    if (status !== 'scanning' || !video) return;

    let stream: MediaStream | null = null;
    let timerId: ReturnType<typeof setTimeout>;
    let stopped = false;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = () => {
      if (stopped || !ctx || video.readyState < 2) {
        timerId = setTimeout(tick, 120);
        return;
      }
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (code?.data) {
        try {
          const url = new URL(code.data);
          const token = url.searchParams.get('t');
          if (token) {
            stopped = true;
            stream?.getTracks().forEach(t => t.stop());
            processToken(token);
            return;
          }
        } catch { /* not our URL, keep scanning */ }
      }
      timerId = setTimeout(tick, 120); // ~8fps — enough for QR, easy on CPU
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } })
      .then(s => {
        stream = s;
        video.srcObject = s;
        video.play().then(() => { timerId = setTimeout(tick, 120); });
      })
      .catch(() => setStatus('idle'));

    return () => {
      stopped = true;
      clearTimeout(timerId);
      stream?.getTracks().forEach(t => t.stop());
      video.srcObject = null;
    };
  }, [status]);

  const stopScanner = () => setStatus('idle');

  const reset = () => {
    setStatus('idle');
    setErrorMsg('');
    navigate('/check-in', { replace: true });
  };

  /* ── Scanner view ── */
  if (status === 'scanning') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex', flexDirection: 'column' }}>
        {/* Header overlay */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>Apuntá al QR del portero</p>
          <button
            onClick={stopScanner}
            style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '6px 8px' }}
          >
            Cancelar
          </button>
        </div>
        {/* Video fills remaining space */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      </div>
    );
  }

  /* ── Loading ── */
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="relative">
            <div className="w-14 h-14 border-2 border-brand-red/20 rounded-full" />
            <div className="absolute inset-0 w-14 h-14 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-brand-muted text-xs tracking-[0.3em] uppercase">Verificando</p>
        </div>
      </div>
    );
  }

  /* ── Success ── */
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col pattern-lines">
        <div className="h-1.5 w-full animate-fade-in" style={{ background: 'linear-gradient(90deg, #16a34a, #15803d)' }} />

        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-24 h-24 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mb-6 animate-scale-in">
            <svg className="w-11 h-11 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path className="draw-path" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <p className="text-green-400/70 text-xs font-semibold tracking-[0.3em] uppercase mb-1 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            Acceso autorizado
          </p>
          <h2 className="font-display text-white text-5xl tracking-wider mb-2 animate-slide-up" style={{ animationDelay: '0.35s' }}>
            {memberName.split(' ')[1] || memberName}
          </h2>
          <p className="text-white/50 text-lg mb-8 animate-slide-up" style={{ animationDelay: '0.42s' }}>
            {memberName}
          </p>

          <div
            className="border border-green-500/40 rounded-2xl px-8 py-4 bg-green-500/5 animate-slide-up"
            style={{ animationDelay: '0.5s' }}
          >
            <p className="text-green-400/50 text-[10px] tracking-[0.4em] uppercase mb-0.5">Dirigir a</p>
            <p className="font-display text-green-400 text-2xl tracking-[0.2em]">ZONA JUGADORES</p>
          </div>

          <div className="flex gap-3 mt-10 animate-fade-in" style={{ animationDelay: '0.6s' }}>
            <button
              onClick={() => navigate('/carnet')}
              className="px-5 py-2.5 bg-green-500/15 border border-green-500/25 rounded-xl text-green-400 text-xs font-semibold uppercase tracking-wider active:scale-95 transition-transform"
            >
              Ver carnet
            </button>
            <button onClick={reset} className="text-white/20 text-xs tracking-widest uppercase active:text-white/50 px-2">
              Volver
            </button>
          </div>
        </div>

        <div className="h-1.5 w-full animate-fade-in" style={{ background: 'linear-gradient(90deg, #16a34a, #15803d)' }} />
      </div>
    );
  }

  /* ── Already checked in ── */
  if (status === 'already') {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col">
        <div className="h-1.5 w-full animate-fade-in" style={{ background: '#C9A84C' }} />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-24 h-24 rounded-full bg-brand-gold/10 border border-brand-gold/30 flex items-center justify-center mb-6 animate-scale-in">
            <svg className="w-10 h-10 text-brand-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" className="draw-path" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <p className="text-brand-gold/70 text-xs font-semibold tracking-[0.3em] uppercase mb-2 animate-fade-in" style={{ animationDelay: '0.25s' }}>
            Atención
          </p>
          <h2 className="font-display text-white text-4xl tracking-wider mb-3 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            YA INGRESASTE
          </h2>
          <p className="text-brand-muted animate-slide-up" style={{ animationDelay: '0.38s' }}>
            Tu ingreso ya fue registrado hoy.
          </p>
          <button onClick={reset} className="mt-10 text-white/20 text-xs tracking-widest uppercase active:text-white/50 animate-fade-in" style={{ animationDelay: '0.5s' }}>
            Volver
          </button>
        </div>
        <div className="h-1.5 w-full" style={{ background: '#C9A84C' }} />
      </div>
    );
  }

  /* ── Error ── */
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col">
        <div className="h-1.5 w-full bg-brand-red animate-fade-in" />
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-24 h-24 rounded-full bg-brand-red/10 border border-brand-red/30 flex items-center justify-center mb-6 animate-scale-in">
            <svg className="w-10 h-10 text-brand-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" className="draw-path" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-brand-red/70 text-xs font-semibold tracking-[0.3em] uppercase mb-2 animate-fade-in" style={{ animationDelay: '0.25s' }}>
            Denegado
          </p>
          <h2 className="font-display text-white text-4xl tracking-wider mb-3 animate-slide-up" style={{ animationDelay: '0.3s' }}>
            NO AUTORIZADO
          </h2>
          <p className="text-brand-muted animate-slide-up" style={{ animationDelay: '0.38s' }}>
            {errorMsg || 'QR inválido o expirado'}
          </p>
          <button onClick={reset} className="mt-10 text-white/20 text-xs tracking-widest uppercase active:text-white/50 animate-fade-in" style={{ animationDelay: '0.5s' }}>
            Volver
          </button>
        </div>
        <div className="h-1.5 w-full bg-brand-red" />
      </div>
    );
  }

  /* ── Idle ── */
  return (
    <div className="min-h-screen bg-brand-bg pattern-lines flex flex-col">
      <div className="flex justify-between items-center px-5 pt-5 pb-3 animate-fade-in">
        <div>
          <p className="text-white text-sm font-semibold">{user?.nombre} {user?.apellido}</p>
          <p className="text-brand-muted text-xs">Jugador</p>
        </div>
        <div className="flex gap-3 items-center">
          <button onClick={() => navigate('/carnet')} className="text-brand-gold text-xs uppercase tracking-wider font-semibold active:opacity-70">
            Mi carnet
          </button>
          <button onClick={logout} className="text-brand-muted text-xs uppercase tracking-wider active:text-white">
            Salir
          </button>
        </div>
      </div>

      <div className="mx-5 h-px bg-brand-border" />

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <ClubShield size={72} className="mb-6 opacity-50 animate-fade-in" />
        <h2 className="font-display text-white text-3xl tracking-[0.15em] mb-2 animate-slide-up">
          LISTO PARA INGRESAR
        </h2>
        <p className="text-brand-muted text-sm leading-relaxed max-w-xs animate-slide-up-d1">
          Escaneá el QR que muestra el portero para registrar tu ingreso
        </p>

        <button
          onClick={() => setStatus('scanning')}
          className="mt-10 w-full max-w-xs py-4 rounded-2xl font-display tracking-widest text-white text-lg active:scale-95 transition-transform animate-slide-up-d2"
          style={{ backgroundColor: '#CC2222', boxShadow: '0 0 24px rgba(204,34,34,0.4)' }}
        >
          ESCANEAR QR
        </button>
      </div>

      <p className="text-center text-brand-muted/30 text-xs pb-8 tracking-widest uppercase animate-fade-in">
        Estelares Futsal · Desde 2012
      </p>
    </div>
  );
}
