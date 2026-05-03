import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { api } from '../lib/api.ts';
import ClubShield from '../components/ClubShield.tsx';

type Status = 'idle' | 'loading' | 'success' | 'already' | 'error';

export default function CheckIn() {
  const { user, logout } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('idle');
  const [memberName, setMemberName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const processToken = async (token: string) => {
    setStatus('loading');
    try {
      const res = await api.checkIn(token);
      setMemberName(`${res.member.nombre} ${res.member.apellido}`);
      setStatus('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      setErrorMsg(msg);
      setStatus(msg.toLowerCase().includes('ya registraste') ? 'already' : 'error');
    }
  };

  useEffect(() => {
    const token = searchParams.get('t');
    if (token) processToken(token);
  }, []);

  const reset = () => {
    setStatus('idle');
    setErrorMsg('');
    navigate('/check-in', { replace: true });
  };

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

          {/* Animated circle + checkmark */}
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

          {/* Zone badge */}
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

        <div className="mt-10 border border-brand-border rounded-xl px-6 py-4 bg-brand-surface animate-slide-up-d2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-red/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-brand-muted text-xs text-left leading-snug">
              Usá la cámara de tu celular<br />para escanear el QR del portero
            </p>
          </div>
        </div>
      </div>

      <p className="text-center text-brand-muted/30 text-xs pb-8 tracking-widest uppercase animate-fade-in">
        Estelares Futsal · Desde 2012
      </p>
    </div>
  );
}
