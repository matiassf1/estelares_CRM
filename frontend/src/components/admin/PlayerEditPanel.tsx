import { useState, useRef } from 'react';
import { Member, Categoria, api } from '../../lib/api';
import { compressImage } from '../../utils/image';
import Input from '../Input';
import { getInitials } from '../../utils/format';

interface PlayerEditPanelProps {
  member: Member | null; // null = new player
  categorias: Categoria[];
  onSave: () => void;
  onClose: () => void;
}

type FormData = {
  nombre: string; apellido: string; dni: string; patente: string;
  password: string; foto_url: string; categoria_id: string; tipo_vehiculo: string;
};

const VEHICULOS = [
  { value: '', label: 'Ninguno' },
  { value: 'auto', label: 'Auto' },
  { value: 'moto', label: 'Moto' },
  { value: 'bicicleta', label: 'Bici' },
];

export default function PlayerEditPanel({ member, categorias, onSave, onClose }: PlayerEditPanelProps) {
  const isNew = !member;
  const [form, setForm] = useState<FormData>({
    nombre: member?.nombre || '',
    apellido: member?.apellido || '',
    dni: member?.dni || '',
    patente: member?.patente || '',
    password: '',
    foto_url: member?.foto_url || '',
    categoria_id: member?.categoria_id ? String(member.categoria_id) : '',
    tipo_vehiculo: member?.tipo_vehiculo || '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const f = (field: keyof FormData) => ({
    value: form[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value })),
  });

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm(prev => ({ ...prev, foto_url: '' }));
    const compressed = await compressImage(file, 400);
    setForm(prev => ({ ...prev, foto_url: compressed }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
        tipo_vehiculo: form.tipo_vehiculo || null,
      };
      if (isNew) {
        await api.createMember(payload);
      } else {
        const p = { ...payload } as Partial<Member & { password: string }>;
        if (!form.password) delete p.password;
        await api.updateMember(member!.id, p);
      }
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const needsPatente = form.tipo_vehiculo === 'auto' || form.tipo_vehiculo === 'moto';
  const initials = getInitials(form.apellido, form.nombre);

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
        style={{
          backgroundColor: 'var(--brand-surface)',
          borderLeft: '1px solid rgb(var(--brand-accent-rgb) / 0.15)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.1)' }}
        >
          {form.foto_url ? (
            <img
              src={form.foto_url}
              alt=""
              className="w-10 h-10 rounded-full object-cover cursor-pointer flex-shrink-0"
              onClick={() => fileRef.current?.click()}
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 cursor-pointer"
              style={{ backgroundColor: 'var(--brand-primary)' }}
              onClick={() => fileRef.current?.click()}
            >
              {initials || '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-display text-white text-base tracking-wide uppercase truncate">
              {isNew ? 'Nuevo jugador' : `${form.apellido || '...'} ${form.nombre || ''}`}
            </p>
            <button
              type="button"
              className="text-xs active:opacity-70"
              style={{ color: 'var(--brand-primary)' }}
              onClick={() => fileRef.current?.click()}
            >
              {form.foto_url ? 'Cambiar foto · Quitar' : 'Agregar foto'}
            </button>
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
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />

        {/* Scrollable body */}
        <form
          id="player-edit-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombre" {...f('nombre')} placeholder="Nombre" required />
            <Input label="Apellido" {...f('apellido')} placeholder="Apellido" required />
          </div>

          <Input
            label="DNI"
            {...f('dni')}
            placeholder="46526763"
            inputMode="numeric"
            required={isNew}
          />

          {/* Categoría */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--brand-accent)' }}>
              Categoría
            </p>
            <select
              value={form.categoria_id}
              onChange={e => setForm(prev => ({ ...prev, categoria_id: e.target.value }))}
              className="input-field w-full"
              style={{
                backgroundColor: 'var(--brand-bg)',
                color: form.categoria_id ? 'white' : 'var(--brand-muted)',
              }}
            >
              <option value="">Sin categoría</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          {/* Vehículo */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--brand-accent)' }}>
              Vehículo
            </p>
            <div className="flex gap-2">
              {VEHICULOS.map(v => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setForm(prev => ({
                    ...prev,
                    tipo_vehiculo: v.value,
                    patente: (v.value === '' || v.value === 'bicicleta') ? '' : prev.patente,
                  }))}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-95"
                  style={form.tipo_vehiculo === v.value
                    ? { backgroundColor: 'rgb(var(--brand-primary-rgb) / 0.15)', color: 'var(--brand-primary)', border: '1px solid rgb(var(--brand-primary-rgb) / 0.4)' }
                    : { backgroundColor: 'var(--brand-bg)', color: 'var(--brand-muted)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.1)' }
                  }
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Patente — conditional */}
          {needsPatente && (
            <Input label="Patente" {...f('patente')} placeholder="AB 123 CD" />
          )}

          {/* Acceso */}
          <div className="pt-2" style={{ borderTop: '1px solid rgb(var(--brand-accent-rgb) / 0.08)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--brand-muted)' }}>
              Acceso
            </p>
            <Input
              label={isNew ? 'Contraseña' : 'Nueva contraseña'}
              type="password"
              {...f('password')}
              placeholder={isNew ? '••••••••' : 'Dejar vacío para no cambiar'}
              required={isNew}
            />
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

        {/* Sticky footer */}
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
            form="player-edit-form"
            disabled={saving}
            className="flex-1 py-3 rounded-xl font-display tracking-widest text-white text-sm transition-all active:scale-95 disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand-primary)' }}
          >
            {saving ? 'GUARDANDO…' : 'GUARDAR'}
          </button>
        </div>
      </div>
    </>
  );
}
