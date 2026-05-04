import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import ClubShield from '../components/ClubShield.tsx';
import Input from '../components/Input.tsx';
import { ThemeToggle } from '../components/ThemeToggle.tsx';

type Mode = 'member' | 'staff';

export default function Login() {
  const [mode, setMode] = useState<Mode>('member');
  const [dni, setDni] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
      setError(err instanceof Error ? err.message : 'Error al ingresar');
    } finally {
      setLoading(false);
    }
  };

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
            </div>
          </form>
        </div>

        <p className="text-xs py-6 tracking-widest animate-fade-in" style={{ color: 'rgb(var(--brand-accent-rgb) / 0.3)', animationDelay: '0.4s' }}>
          ESTELARES FUTSAL © 2012
        </p>
        <div className="pb-6 animate-fade-in" style={{ animationDelay: '0.45s' }}>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
