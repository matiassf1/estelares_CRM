import { useState } from 'react';
import { Link } from 'react-router-dom';
import ClubShield from '../components/ClubShield.tsx';
import Input from '../components/Input.tsx';
import { api } from '../lib/api.ts';

export default function ForgotPassword() {
  const [dni, setDni] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.forgotPassword(dni);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pattern-lines flex flex-col items-center px-5 py-12" style={{ backgroundColor: 'var(--brand-bg)' }}>
      <div className="flex flex-col items-center animate-slide-up-far">
        <ClubShield size={72} className="mb-4" />
        <h1 className="font-display text-white tracking-widest text-center" style={{ fontSize: '1.5rem', letterSpacing: '0.14em' }}>
          RECUPERAR CONTRASEÑA
        </h1>
      </div>

      <div className="w-full max-w-sm mt-8 rounded-2xl p-6 shadow-2xl animate-slide-up"
        style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.2)' }}>

        {sent ? (
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: 'rgb(var(--brand-accent-rgb) / 0.12)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.35)' }}>
              <svg className="w-6 h-6" style={{ color: 'var(--brand-accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--brand-muted)' }}>
              Si tu DNI tiene un email registrado, recibirás el enlace en breve.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs leading-relaxed mb-5" style={{ color: 'var(--brand-muted)' }}>
              Ingresá tu DNI y te enviaremos un enlace para restablecer tu contraseña.
            </p>

            <div className="divider-red mb-5" />

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="DNI" type="text" inputMode="numeric" value={dni}
                onChange={e => setDni(e.target.value)} placeholder="12345678" required autoFocus />

              {error && (
                <div className="flex items-center gap-2 rounded-lg px-3 py-2.5"
                  style={{ backgroundColor: 'rgb(var(--brand-primary-rgb) / 0.1)', border: '1px solid rgb(var(--brand-primary-rgb) / 0.3)' }}>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--brand-primary)' }} />
                  <p className="text-sm" style={{ color: 'var(--brand-primary)' }}>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-red w-full font-display tracking-widest py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: 'var(--brand-primary)', color: '#fff', fontSize: '1.05rem', letterSpacing: '0.18em', border: 'none' }}
              >
                {loading ? 'ENVIANDO...' : 'ENVIAR ENLACE'}
              </button>
            </form>
          </>
        )}

        <Link to="/login" className="block w-full mt-5 py-2 text-center text-xs uppercase tracking-widest transition-colors active:text-white"
          style={{ color: 'var(--brand-muted)' }}>
          ← Volver al inicio de sesión
        </Link>
      </div>

      <p className="text-xs py-6 tracking-widest" style={{ color: 'rgb(var(--brand-accent-rgb) / 0.3)' }}>
        ESTELARES FUTSAL © 2012
      </p>
    </div>
  );
}
