import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ClubShield from '../components/ClubShield.tsx';
import Input from '../components/Input.tsx';
import { api } from '../lib/api.ts';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(token!, password);
      setSuccess(true);
    } catch {
      setError('Este enlace ya fue usado o expiró.');
    } finally {
      setLoading(false);
    }
  };

  const card = (children: React.ReactNode) => (
    <div className="min-h-screen pattern-lines flex flex-col items-center px-5 py-12" style={{ backgroundColor: 'var(--brand-bg)' }}>
      <div className="flex flex-col items-center animate-slide-up-far">
        <ClubShield size={72} className="mb-4" />
        <h1 className="font-display text-white tracking-widest text-center" style={{ fontSize: '1.5rem', letterSpacing: '0.14em' }}>
          NUEVA CONTRASEÑA
        </h1>
      </div>

      <div className="w-full max-w-sm mt-8 rounded-2xl p-6 shadow-2xl animate-slide-up"
        style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.2)' }}>
        {children}
      </div>

      <p className="text-xs py-6 tracking-widest" style={{ color: 'rgb(var(--brand-accent-rgb) / 0.3)' }}>
        ESTELARES FUTSAL © 2012
      </p>
    </div>
  );

  if (!token) {
    return card(
      <>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2.5"
          style={{ backgroundColor: 'rgb(var(--brand-primary-rgb) / 0.1)', border: '1px solid rgb(var(--brand-primary-rgb) / 0.3)' }}>
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--brand-primary)' }} />
          <p className="text-sm" style={{ color: 'var(--brand-primary)' }}>Enlace inválido</p>
        </div>
        <Link to="/login" className="block w-full mt-5 py-2 text-center text-xs uppercase tracking-widest transition-colors active:text-white"
          style={{ color: 'var(--brand-muted)' }}>
          ← Volver al inicio de sesión
        </Link>
      </>
    );
  }

  if (success) {
    return card(
      <>
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: 'rgb(var(--brand-accent-rgb) / 0.12)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.35)' }}>
            <svg className="w-6 h-6" style={{ color: 'var(--brand-accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--brand-muted)' }}>
            Contraseña actualizada. Podés iniciar sesión.
          </p>
        </div>
        <Link to="/login"
          className="btn-red block w-full mt-6 font-display tracking-widest py-4 rounded-xl text-center transition-all active:scale-95"
          style={{ backgroundColor: 'var(--brand-primary)', color: '#fff', fontSize: '1.05rem', letterSpacing: '0.18em', border: 'none' }}>
          INICIAR SESIÓN
        </Link>
      </>
    );
  }

  return card(
    <>
      <p className="text-xs leading-relaxed mb-5" style={{ color: 'var(--brand-muted)' }}>
        Elegí una nueva contraseña de al menos 6 caracteres.
      </p>

      <div className="divider-red mb-5" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nueva contraseña" type="password" value={password}
          onChange={e => setPassword(e.target.value)} required autoFocus />

        <Input label="Confirmar contraseña" type="password" value={confirm}
          onChange={e => setConfirm(e.target.value)} required />

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
          {loading ? 'GUARDANDO...' : 'GUARDAR'}
        </button>
      </form>

      <Link to="/login" className="block w-full mt-5 py-2 text-center text-xs uppercase tracking-widest transition-colors active:text-white"
        style={{ color: 'var(--brand-muted)' }}>
        ← Volver al inicio de sesión
      </Link>
    </>
  );
}
