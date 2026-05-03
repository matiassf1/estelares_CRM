import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { api, Member, ParkingSpot } from '../lib/api.ts';
import { compressImage } from '../utils/image.ts';
import ClubShield from '../components/ClubShield.tsx';
import Input from '../components/Input.tsx';

type FormData = { nombre: string; apellido: string; dni: string; patente: string; password: string; foto_url: string };
const emptyForm: FormData = { nombre: '', apellido: '', dni: '', patente: '', password: '', foto_url: '' };

export default function Admin() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'jugadores' | 'parking'>('jugadores');
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState({ today: 0, total: 0 });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Parking state
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [newSpotNumber, setNewSpotNumber] = useState('');
  const [spotError, setSpotError] = useState('');
  const [addingSpot, setAddingSpot] = useState(false);
  const [assigningSpotId, setAssigningSpotId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [m, s] = await Promise.all([api.getMembers(), api.getStats()]);
    setMembers(m); setStats(s);
  }, []);

  const loadSpots = useCallback(async () => {
    const s = await api.getParkingSpots();
    setSpots(s);
  }, []);

  useEffect(() => { load(); loadSpots(); }, [load, loadSpots]);

  const openCreate = () => {
    setForm(emptyForm); setEditingId(null); setFormError(''); setShowForm(true);
  };
  const openEdit = (m: Member) => {
    setForm({ nombre: m.nombre, apellido: m.apellido, dni: m.dni, patente: m.patente || '', password: '', foto_url: m.foto_url || '' });
    setEditingId(m.id); setFormError(''); setShowForm(true);
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file, 400);
    setForm(prev => ({ ...prev, foto_url: compressed }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError(''); setSaving(true);
    try {
      if (editingId) {
        const p: Partial<Member & { password: string; foto_url: string }> = { ...form };
        if (!form.password) delete p.password;
        await api.updateMember(editingId, p);
      } else {
        await api.createMember(form);
      }
      setShowForm(false); setEditingId(null); load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error');
    } finally { setSaving(false); }
  };

  const handleToggle = async (m: Member) => { await api.updateMember(m.id, { activo: !m.activo }); load(); };
  const handleDelete = async (m: Member) => {
    if (!confirm(`¿Eliminar a ${m.nombre} ${m.apellido}?`)) return;
    await api.deleteMember(m.id); load();
  };

  const f = (field: keyof FormData) => ({
    value: form[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value })),
  });

  const handleAddSpot = async (e: React.FormEvent) => {
    e.preventDefault(); setSpotError(''); setAddingSpot(true);
    try {
      await api.createParkingSpot(newSpotNumber);
      setNewSpotNumber(''); loadSpots();
    } catch (err) {
      setSpotError(err instanceof Error ? err.message : 'Error');
    } finally { setAddingSpot(false); }
  };

  const handleAssign = async (spotId: number, memberId: string) => {
    await api.assignParking(spotId, memberId);
    setAssigningSpotId(null); loadSpots();
  };

  const handleUnassign = async (spotId: number) => {
    await api.unassignParking(spotId); loadSpots();
  };

  const handleDeleteSpot = async (spot: ParkingSpot) => {
    if (!confirm(`¿Eliminar espacio ${spot.spot_number}?`)) return;
    await api.deleteParking(spot.id); loadSpots();
  };

  const filtered = members.filter(m =>
    `${m.nombre} ${m.apellido} ${m.dni}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen pattern-lines" style={{ backgroundColor: 'var(--brand-bg)' }}>

      {/* ── Header ── */}
      <div className="sticky top-0 z-50 px-5 py-3 flex justify-between items-center"
        style={{ backgroundColor: 'var(--brand-surface)', borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.2)' }}>
        <div className="flex items-center gap-3">
          <ClubShield size={30} className="opacity-90" />
          <div>
            <p className="text-white text-sm font-semibold leading-tight">Estelares Futsal</p>
            <p className="text-xs leading-tight" style={{ color: 'var(--brand-muted)' }}>Panel Admin</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/portero')}
            className="text-xs font-semibold uppercase tracking-wider active:opacity-70"
            style={{ color: 'var(--brand-accent)' }}>
            Portero
          </button>
          <button onClick={logout}
            className="text-xs uppercase tracking-wider active:text-white"
            style={{ color: 'var(--brand-muted)' }}>
            Salir
          </button>
        </div>
      </div>

      <div className="p-5 max-w-lg mx-auto">

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 gap-3 mb-6 mt-2">
          <div className="rounded-2xl p-4 relative overflow-hidden animate-slide-up"
            style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.2)' }}>
            <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ backgroundColor: 'var(--brand-primary)' }} />
            <p className="text-[10px] uppercase tracking-wider pl-3 mb-1" style={{ color: 'var(--brand-accent)' }}>Ingresos hoy</p>
            <p className="font-display text-white pl-3" style={{ fontSize: '3rem', lineHeight: 1 }}>{stats.today}</p>
          </div>
          <div className="rounded-2xl p-4 relative overflow-hidden animate-slide-up" style={{ animationDelay: '0.06s', backgroundColor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.2)' }}>
            <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ backgroundColor: 'var(--brand-accent)' }} />
            <p className="text-[10px] uppercase tracking-wider pl-3 mb-1" style={{ color: 'var(--brand-accent)' }}>Activos</p>
            <p className="font-display text-white pl-3" style={{ fontSize: '3rem', lineHeight: 1 }}>{stats.total}</p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl animate-slide-up" style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.15)', animationDelay: '0.08s' }}>
          {(['jugadores', 'parking'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-lg text-xs font-display tracking-widest uppercase transition-all active:scale-95"
              style={tab === t
                ? { backgroundColor: 'var(--brand-primary)', color: '#fff' }
                : { color: 'var(--brand-muted)' }}>
              {t === 'jugadores' ? 'Jugadores' : 'Estacionamientos'}
            </button>
          ))}
        </div>

        {/* ── TAB CONTENT ── */}
        <div key={tab} className="animate-fade-in">
        {tab === 'jugadores' && (
          <>
            <div className="flex gap-2 mb-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <input
                type="text"
                placeholder="Buscar jugador..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field flex-1"
              />
              <button
                onClick={openCreate}
                className="btn-red font-display tracking-widest text-white text-base px-5 py-2.5 rounded-xl active:scale-95 transition-all whitespace-nowrap"
                style={{ backgroundColor: 'var(--brand-primary)', border: 'none' }}
              >
                + AGREGAR
              </button>
            </div>

            {showForm && (
              <form onSubmit={handleSubmit} className="rounded-2xl p-5 mb-5 animate-slide-up"
                style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-primary-rgb) / 0.35)' }}>

                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 rounded-full" style={{ backgroundColor: 'var(--brand-primary)' }} />
                    <h3 className="font-display text-white tracking-widest text-lg">
                      {editingId ? 'EDITAR JUGADOR' : 'NUEVO JUGADOR'}
                    </h3>
                  </div>
                  <button type="button" onClick={() => setShowForm(false)}
                    className="text-xs uppercase tracking-wider active:text-white"
                    style={{ color: 'var(--brand-muted)' }}>✕</button>
                </div>

                <div className="flex items-center gap-4 mb-5 pb-5"
                  style={{ borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.12)' }}>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="rounded-2xl cursor-pointer overflow-hidden flex-shrink-0 flex items-center justify-center transition-all active:scale-95"
                    style={{ width: 72, height: 72, backgroundColor: 'var(--brand-bg)', border: '2px dashed rgb(var(--brand-accent-rgb) / 0.3)' }}
                  >
                    {form.foto_url ? (
                      <img src={form.foto_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-6 h-6" style={{ color: 'var(--brand-accent)', opacity: 0.5 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-white text-xs font-semibold mb-0.5">Foto del jugador</p>
                    <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>Opcional · se comprime automáticamente</p>
                    {form.foto_url && (
                      <button type="button" onClick={() => setForm(f => ({ ...f, foto_url: '' }))}
                        className="text-xs mt-1 active:opacity-70" style={{ color: 'var(--brand-primary)' }}>
                        Quitar foto
                      </button>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <Input label="Nombre" {...f('nombre')} placeholder="Nombre" required />
                  <Input label="Apellido" {...f('apellido')} placeholder="Apellido" required />
                </div>
                <div className="space-y-3">
                  <Input label="DNI" {...f('dni')} placeholder="12345678" inputMode="numeric" required={!editingId} />
                  <Input label="Patente" {...f('patente')} placeholder="AB 123 CD (opcional)" />
                  <Input
                    label={editingId ? 'Nueva contraseña' : 'Contraseña'}
                    type="password"
                    {...f('password')}
                    placeholder={editingId ? 'Dejar vacío para no cambiar' : '••••••••'}
                    required={!editingId}
                  />
                </div>

                {formError && (
                  <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 mt-3"
                    style={{ backgroundColor: 'rgb(var(--brand-primary-rgb) / 0.1)', border: '1px solid rgb(var(--brand-primary-rgb) / 0.3)' }}>
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--brand-primary)' }} />
                    <p className="text-sm" style={{ color: 'var(--brand-primary)' }}>{formError}</p>
                  </div>
                )}

                <div className="flex gap-2 mt-5">
                  <button type="submit" disabled={saving}
                    className="btn-red flex-1 font-display tracking-widest text-white text-base py-3 rounded-xl active:scale-95 transition-all disabled:opacity-50"
                    style={{ backgroundColor: 'var(--brand-primary)', border: 'none' }}>
                    {saving ? 'GUARDANDO...' : 'GUARDAR'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)}
                    className="px-5 rounded-xl text-sm active:text-white transition-colors"
                    style={{ backgroundColor: 'var(--brand-surface-2)', color: 'var(--brand-muted)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.15)' }}>
                    Cancelar
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {filtered.length === 0 && (
                <div className="text-center py-12 text-sm" style={{ color: 'rgb(var(--brand-muted-rgb) / 0.4)' }}>
                  {search ? 'Sin resultados para esa búsqueda' : 'No hay jugadores cargados'}
                </div>
              )}
              {filtered.map((m, i) => (
                <div key={m.id}
                  className="rounded-xl px-4 py-3 transition-all"
                  style={{
                    backgroundColor: 'var(--brand-surface)',
                    border: m.activo ? '1px solid rgb(var(--brand-accent-rgb) / 0.2)' : '1px solid rgb(var(--brand-border-rgb) / 0.5)',
                    opacity: m.activo ? 1 : 0.45,
                  }}>
                  <div className="flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: 'var(--brand-bg)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.15)' }}>
                        {m.foto_url ? (
                          <img src={m.foto_url} alt={m.nombre} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-display text-sm" style={{ color: 'var(--brand-muted)' }}>{i + 1}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{m.nombre} {m.apellido}</p>
                        <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                          DNI {m.dni}{m.patente ? ` · ${m.patente}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0 items-center">
                      <button onClick={() => openEdit(m)}
                        className="text-xs px-2.5 py-1 rounded-lg text-[#7A7A7A] border border-[rgba(122,122,122,0.15)] bg-transparent transition-all duration-150 active:scale-90 hover:text-white hover:border-[rgba(255,255,255,0.25)] hover:bg-[rgba(255,255,255,0.06)]">
                        Editar
                      </button>
                      <button onClick={() => handleToggle(m)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-semibold border transition-all duration-150 active:scale-90 ${
                          m.activo
                            ? 'text-[rgba(201,168,76,0.7)] border-[rgba(201,168,76,0.2)] bg-transparent hover:text-[#C9A84C] hover:border-[rgba(201,168,76,0.5)] hover:bg-[rgba(201,168,76,0.1)]'
                            : 'text-[#22c55e] border-[rgba(34,197,94,0.2)] bg-transparent hover:text-white hover:border-[rgba(34,197,94,0.5)] hover:bg-[rgba(34,197,94,0.1)]'
                        }`}>
                        {m.activo ? 'Desact.' : 'Activar'}
                      </button>
                      <button onClick={() => handleDelete(m)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[rgba(204,34,34,0.4)] border border-[rgba(204,34,34,0.15)] bg-transparent transition-all duration-150 active:scale-90 hover:bg-[rgba(204,34,34,0.12)] hover:border-[rgba(204,34,34,0.45)] hover:text-[#FF6B6B]">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filtered.length > 0 && (
              <p className="text-center text-xs mt-6 tracking-widest uppercase"
                style={{ color: 'rgb(var(--brand-accent-rgb) / 0.25)' }}>
                {filtered.length} jugador{filtered.length !== 1 ? 'es' : ''}
              </p>
            )}
          </>
        )}

        {/* ── PARKING TAB ── */}
        {tab === 'parking' && (
          <>
            {/* Add spot form */}
            <form onSubmit={handleAddSpot} className="flex gap-2 mb-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <input
                type="text"
                placeholder="Número de espacio (ej. A1)"
                value={newSpotNumber}
                onChange={e => setNewSpotNumber(e.target.value)}
                className="input-field flex-1"
              />
              <button
                type="submit"
                disabled={addingSpot || !newSpotNumber.trim()}
                className="btn-red font-display tracking-widest text-white text-base px-5 py-2.5 rounded-xl active:scale-95 transition-all whitespace-nowrap disabled:opacity-40"
                style={{ backgroundColor: 'var(--brand-primary)', border: 'none' }}
              >
                + AGREGAR
              </button>
            </form>

            {spotError && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 mb-4 animate-slide-up"
                style={{ backgroundColor: 'rgb(var(--brand-primary-rgb) / 0.1)', border: '1px solid rgb(var(--brand-primary-rgb) / 0.3)' }}>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--brand-primary)' }} />
                <p className="text-sm" style={{ color: 'var(--brand-primary)' }}>{spotError}</p>
              </div>
            )}

            <div className="space-y-2">
              {spots.length === 0 && (
                <div className="text-center py-12 text-sm" style={{ color: 'rgb(var(--brand-muted-rgb) / 0.4)' }}>
                  No hay espacios de estacionamiento cargados
                </div>
              )}
              {spots.map(spot => {
                const isOpen = assigningSpotId === spot.id;
                return (
                  <div key={spot.id} className="rounded-xl px-4 py-3 transition-all duration-200"
                    style={{
                      backgroundColor: 'var(--brand-surface)',
                      border: isOpen
                        ? '1px solid rgb(var(--brand-accent-rgb) / 0.5)'
                        : spot.member_id
                          ? '1px solid rgb(var(--brand-accent-rgb) / 0.28)'
                          : '1px solid rgb(var(--brand-accent-rgb) / 0.12)',
                    }}>

                    {/* Spot header */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center justify-center rounded-xl flex-shrink-0 transition-all duration-200"
                          style={{
                            width: 38, height: 38,
                            backgroundColor: spot.member_id ? 'rgb(var(--brand-accent-rgb) / 0.12)' : 'var(--brand-bg)',
                            border: spot.member_id ? '1px solid rgb(var(--brand-accent-rgb) / 0.4)' : '1px solid rgb(var(--brand-accent-rgb) / 0.15)',
                          }}>
                          <span className="font-display text-sm" style={{ color: 'var(--brand-accent)' }}>{spot.spot_number}</span>
                        </div>
                        <div className="min-w-0">
                          {spot.nombre ? (
                            <>
                              <p className="text-white font-semibold text-sm truncate">
                                {spot.nombre} {spot.apellido}
                              </p>
                              <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                                {spot.patente || 'Sin patente'}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm italic" style={{ color: 'rgb(var(--brand-muted-rgb) / 0.5)' }}>Sin asignar</p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 flex-shrink-0 items-center">
                        {!spot.member_id && (
                          <button
                            onClick={() => setAssigningSpotId(isOpen ? null : spot.id)}
                            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[rgba(201,168,76,0.35)] text-[#C9A84C] transition-all duration-150 active:scale-90 hover:bg-[rgba(201,168,76,0.22)] hover:border-[rgba(201,168,76,0.6)] hover:text-[#E8D49E] ${isOpen ? 'bg-[rgba(201,168,76,0.18)]' : 'bg-[rgba(201,168,76,0.08)]'}`}>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              {isOpen
                                ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                : <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />}
                            </svg>
                            {isOpen ? 'Cerrar' : 'Asignar'}
                          </button>
                        )}
                        {spot.member_id && (
                          <button onClick={() => handleUnassign(spot.id)}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[rgba(204,34,34,0.08)] border border-[rgba(204,34,34,0.3)] text-[#FF6B6B] transition-all duration-150 active:scale-90 hover:bg-[rgba(204,34,34,0.2)] hover:border-[rgba(204,34,34,0.6)] hover:text-white">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Liberar
                          </button>
                        )}
                        <button onClick={() => handleDeleteSpot(spot)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[rgba(204,34,34,0.4)] border border-[rgba(204,34,34,0.15)] bg-transparent transition-all duration-150 active:scale-90 hover:bg-[rgba(204,34,34,0.12)] hover:border-[rgba(204,34,34,0.45)] hover:text-[#FF6B6B]">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Member picker */}
                    {isOpen && (
                      <div className="mt-3 pt-3 animate-slide-up" style={{ borderTop: '1px solid rgb(var(--brand-accent-rgb) / 0.12)' }}>
                        <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'rgb(var(--brand-accent-rgb) / 0.6)' }}>
                          Seleccionar jugador
                        </p>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {members.filter(m => m.activo).map(m => (
                            <button
                              key={m.id}
                              onClick={() => handleAssign(spot.id, m.id)}
                              className="w-full text-left rounded-lg px-3 py-2.5 text-sm bg-[rgba(201,168,76,0.05)] border border-[rgba(201,168,76,0.1)] text-[#F5F5F0] transition-all duration-150 active:scale-[0.98] hover:bg-[rgba(201,168,76,0.13)] hover:border-[rgba(201,168,76,0.3)] hover:text-[#E8D49E]">
                              <span className="font-semibold">{m.nombre} {m.apellido}</span>
                              {m.patente && <span className="ml-2 text-xs" style={{ color: 'var(--brand-muted)' }}>{m.patente}</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {spots.length > 0 && (
              <p className="text-center text-xs mt-6 tracking-widest uppercase"
                style={{ color: 'rgb(var(--brand-accent-rgb) / 0.25)' }}>
                {spots.filter(s => s.member_id).length} / {spots.length} espacios asignados
              </p>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}
