import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import ClubShield from '../components/ClubShield.tsx';
import Input from '../components/Input.tsx';

type Mode = 'member' | 'staff';

function SuspendedScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen pattern-lines flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--brand-bg)' }}>
      {/* Hero */}
      <div className="relative flex flex-col items-center justify-end pt-14 pb-16 overflow-hidden">
        <div className="absolute inset-0 animate-diagonal-in"
          style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-darker) 55%, transparent 55%)' }} />
        <div className="absolute inset-0 pattern-lines opacity-20 animate-diagonal-in" />
        <div className="relative z-10 flex flex-col items-center animate-slide-up-far">
          <ClubShield size={92} className="mb-4 animate-shield-glow-white" variant="white" />
          <h1 className="font-display text-white tracking-widest" style={{ fontSize: '2.6rem', lineHeight: 1, letterSpacing: '0.14em' }}>ESTELARES</h1>
          <p className="font-display tracking-[0.4em] text-sm mt-1 gold-glow" style={{ color: 'var(--brand-accent)' }}>FUTSAL</p>
        </div>
      </div>

      {/* Card */}
      <div className="relative z-10 flex-1 flex flex-col items-center px-5 -mt-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-primary-rgb) / 0.35)' }}>

          {/* Status badge */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: 'rgb(var(--brand-primary-rgb) / 0.12)', border: '1px solid rgb(var(--brand-primary-rgb) / 0.35)' }}>
              <svg className="w-7 h-7" style={{ color: 'var(--brand-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="font-display text-white tracking-widest text-xl">ACCESO SUSPENDIDO</h2>
            <p className="text-xs text-center mt-2 leading-relaxed" style={{ color: 'var(--brand-muted)' }}>
              Tu cuenta en Estelares Futsal está temporalmente deshabilitada.
            </p>
          </div>

          <div className="divider-red mb-5" />

          <div className="space-y-3">
            {/* Opción 1: Deuda / situación pendiente */}
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--brand-bg)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.18)' }}>
              <p className="text-white text-sm font-semibold mb-1">¿Tenés algo pendiente con el club?</p>
              <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--brand-muted)' }}>
                Contactá al administrador para regularizar tu situación y reactivar tu acceso.
              </p>
              <a
                href="https://wa.me/54XXXXXXXXXX"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-95"
                style={{ backgroundColor: 'rgb(37,211,102,0.12)', color: 'rgb(37,211,102)', border: '1px solid rgb(37,211,102,0.3)' }}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Contactar administrador
              </a>
            </div>

            {/* Opción 2: Error / estás al día */}
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--brand-bg)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.18)' }}>
              <p className="text-white text-sm font-semibold mb-1">¿Estás al día y esto es un error?</p>
              <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--brand-muted)' }}>
                Contactá a soporte técnico para que podamos resolver el problema.
              </p>
              <a
                href="https://wa.me/54XXXXXXXXXX"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-95"
                style={{ backgroundColor: 'rgb(var(--brand-accent-rgb) / 0.1)', color: 'var(--brand-accent)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.3)' }}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Contactar soporte
              </a>
            </div>
          </div>

          <button onClick={onBack} className="w-full mt-4 py-2 text-xs uppercase tracking-widest transition-colors active:text-white"
            style={{ color: 'var(--brand-muted)' }}>
            ← Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const [mode, setMode] = useState<Mode>('member');
  const [dni, setDni] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const { login, adminLogin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'member') {
        await login(dni, password);
        navigate(searchParams.get('redirect') || '/carnet', { replace: true });
      } else {
        await adminLogin(username, password);
        navigate('/', { replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al ingresar';
      if (msg === 'Cuenta suspendida') {
        setSuspended(true);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (suspended) return <SuspendedScreen onBack={() => setSuspended(false)} />;

  return (
    <div className="min-h-screen pattern-lines flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--brand-bg)' }}>

      {/* ── Red hero ── */}
      <div className="relative flex flex-col items-center justify-end pt-14 pb-16 overflow-hidden">
        <div
          className="absolute inset-0 animate-diagonal-in"
          style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-darker) 55%, transparent 55%)' }}
        />
        <div
          className="absolute inset-0 pattern-lines opacity-20 animate-diagonal-in"
        />

        <div className="relative z-10 flex flex-col items-center animate-slide-up-far">
          <ClubShield size={92} className="mb-4 animate-shield-glow-white" variant="white" />
          <h1 className="font-display text-white tracking-widest" style={{ fontSize: '2.6rem', lineHeight: 1, letterSpacing: '0.14em' }}>
            ESTELARES
          </h1>
          <p className="font-display tracking-[0.4em] text-sm mt-1 gold-glow" style={{ color: 'var(--brand-accent)' }}>
            FUTSAL
          </p>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-px w-6" style={{ backgroundColor: 'rgb(var(--brand-accent-rgb) / 0.4)' }} />
            <span className="text-xs tracking-widest" style={{ color: 'rgb(var(--brand-accent-rgb) / 0.6)' }}>DESDE 2012</span>
            <div className="h-px w-6" style={{ backgroundColor: 'rgb(var(--brand-accent-rgb) / 0.4)' }} />
          </div>
        </div>
      </div>

      {/* ── Form card ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center px-5 -mt-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.2)' }}>

          {/* ── Mode toggle — clear active state ── */}
          <div className="flex gap-2 mb-6">
            {(['member', 'staff'] as Mode[]).map(m => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className="flex-1 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all duration-200 relative"
                  style={{
                    backgroundColor: active ? 'var(--brand-primary)' : 'var(--brand-surface-2)',
                    color:           active ? '#FFFFFF' : '#666',
                    border:          active ? '1px solid var(--brand-primary)' : '1px solid rgb(var(--brand-accent-rgb) / 0.18)',
                    transform:       active ? 'scale(1.03)' : 'scale(1)',
                    boxShadow:       active ? '0 0 18px rgb(var(--brand-primary-rgb) / 0.35)' : 'none',
                  }}
                >
                  {active && (
                    <span
                      className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: '#FF6B6B' }}
                    />

                  )}
                  {m === 'member' ? 'Jugador' : 'Staff'}
                </button>
              );
            })}
          </div>

          {/* Red divider */}
          <div className="divider-red mb-5" />

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'member' ? (
              <div className="animate-slide-up-d1">
                <Input label="DNI" type="text" inputMode="numeric" value={dni}
                  onChange={e => setDni(e.target.value)} placeholder="12345678" required autoFocus />
              </div>
            ) : (
              <div className="animate-slide-up-d1">
                <Input label="Usuario" type="text" value={username}
                  onChange={e => setUsername(e.target.value)} placeholder="admin" required autoFocus />
              </div>
            )}

            <div className="animate-slide-up-d2">
              <Input label="Contraseña" type="password" value={password}
                onChange={e => setPassword(e.target.value)} required />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 animate-slide-up"
                style={{ backgroundColor: 'rgb(var(--brand-primary-rgb) / 0.1)', border: '1px solid rgb(var(--brand-primary-rgb) / 0.3)' }}>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--brand-primary)' }} />
                <p className="text-sm" style={{ color: 'var(--brand-primary)' }}>{error}</p>
              </div>
            )}

            <div className="animate-slide-up-d3 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="btn-red w-full font-display tracking-widest py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--brand-primary)',
                  color: '#fff',
                  fontSize: '1.15rem',
                  letterSpacing: '0.18em',
                  border: 'none',
                }}
              >
                {loading ? 'VERIFICANDO...' : 'INGRESAR'}
              </button>

              <Link
                to="/forgot-password"
                className="block w-full mt-3 text-center text-xs tracking-wide transition-colors active:text-white"
                style={{ color: 'var(--brand-muted)' }}
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </form>
        </div>

        <p className="text-xs py-6 tracking-widest animate-fade-in" style={{ color: 'rgb(var(--brand-accent-rgb) / 0.3)', animationDelay: '0.4s' }}>
          ESTELARES FUTSAL © 2012
        </p>
      </div>
    </div>
  );
}
