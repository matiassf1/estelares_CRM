import { useState, useEffect } from 'react';
import { Categoria, api } from '../../lib/api';

const CATEGORY_COLORS = ['#E5484D', '#8B5CF6', '#3B82F6', '#14B8A6', '#F97316', '#22C55E'];

interface CategoryDrawerProps {
  mode: 'create' | 'edit';
  categoria: Categoria | null;
  onSave: (cat: Categoria) => void;
  onClose: () => void;
}

export default function CategoryDrawer({ mode, categoria, onSave, onClose }: CategoryDrawerProps) {
  const [nombre, setNombre] = useState(categoria?.nombre || '');
  const [color, setColor] = useState(categoria?.color || CATEGORY_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('El nombre es requerido'); return; }
    setError('');
    setSaving(true);
    try {
      let saved: Categoria;
      if (mode === 'create') {
        saved = await api.createCategoria(nombre.trim(), color);
      } else {
        saved = await api.updateCategoria(categoria!.id, { nombre: nombre.trim(), color });
      }
      onSave(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70]"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 z-[75] flex flex-col w-full md:max-w-[480px] animate-slide-in-right"
        style={{ backgroundColor: 'var(--brand-surface)', borderLeft: '1px solid rgb(var(--brand-accent-rgb) / 0.15)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.1)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <p className="font-display text-white text-base tracking-wide uppercase">
              {mode === 'create' ? 'Nueva categoría' : 'Editar categoría'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
            style={{ color: 'var(--brand-muted)' }}
            aria-label="Cerrar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form
          id="cat-drawer-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-6"
        >
          {/* Nombre */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--brand-accent)' }}>
              Nombre
            </p>
            <input
              className="input-field w-full"
              type="text"
              placeholder="Ej. Primera A"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              autoFocus
              required
            />
          </div>

          {/* Color */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--brand-accent)' }}>
              Color
            </p>
            <div className="flex gap-3 flex-wrap">
              {CATEGORY_COLORS.map(hex => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setColor(hex)}
                  className="w-9 h-9 rounded-full transition-transform active:scale-90 flex-shrink-0 flex items-center justify-center"
                  style={{
                    backgroundColor: hex,
                    outline: color === hex ? '3px solid white' : '3px solid transparent',
                    outlineOffset: '2px',
                  }}
                >
                  {color === hex && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2.5"
              style={{ backgroundColor: 'rgb(var(--brand-primary-rgb) / 0.1)', border: '1px solid rgb(var(--brand-primary-rgb) / 0.3)' }}
            >
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--brand-primary)' }} />
              <p className="text-sm" style={{ color: 'var(--brand-primary)' }}>{error}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div
          className="px-5 py-4 flex gap-2 flex-shrink-0"
          style={{
            borderTop: '1px solid rgb(var(--brand-accent-rgb) / 0.1)',
            paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm transition-all active:scale-95"
            style={{ backgroundColor: 'var(--brand-bg)', color: 'var(--brand-muted)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.15)' }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="cat-drawer-form"
            disabled={saving}
            className="flex-1 py-3 rounded-xl font-display tracking-widest text-white text-sm transition-all active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            {saving ? 'GUARDANDO…' : mode === 'create' ? 'CREAR' : 'GUARDAR'}
          </button>
        </div>
      </div>
    </>
  );
}
