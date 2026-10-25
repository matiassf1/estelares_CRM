import { useState, useEffect, useCallback } from 'react';
import { api, Member, ParkingSpot, Categoria } from '../../lib/api.ts';
import { getInitials } from '../../utils/format';
import ActionMenu from '../../components/admin/ActionMenu';
import ConfirmModal from '../../components/admin/ConfirmModal';
import PlayerEditPanel from '../../components/admin/PlayerEditPanel';
import CategoryDrawer from '../../components/admin/CategoryDrawer';
import CategoryDetailView from '../../components/admin/CategoryDetailView';

function avatarColor(name: string): string {
  const colors = ['#c0392b','#8e44ad','#2980b9','#16a085','#d35400','#27ae60','#2c3e50'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

type ClubView = 'categorias' | 'cocheras';

const VIEWS: { id: ClubView; label: string }[] = [
  { id: 'categorias', label: 'Categorías' },
  { id: 'cocheras', label: 'Cocheras' },
];

export default function ClubPage() {
  const [view, setView] = useState<ClubView>('categorias');

  const [members, setMembers] = useState<Member[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [editPanel, setEditPanel] = useState<{ member: Member | null } | null>(null);

  // Categorias state
  const [catView, setCatView] = useState<Categoria | null>(null);
  const [catDrawer, setCatDrawer] = useState<{ mode: 'create' | 'edit'; cat: Categoria | null } | null>(null);
  const [deleteCatTarget, setDeleteCatTarget] = useState<Categoria | null>(null);

  // Parking state
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [newSpotNumber, setNewSpotNumber] = useState('');
  const [spotError, setSpotError] = useState('');
  const [addingSpot, setAddingSpot] = useState(false);
  const [assigningSpotId, setAssigningSpotId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [m, c] = await Promise.all([api.getMembers(), api.getCategorias()]);
    setMembers(m); setCategorias(c);
  }, []);

  const loadSpots = useCallback(async () => {
    const s = await api.getParkingSpots();
    setSpots(s);
  }, []);

  useEffect(() => { load(); loadSpots(); }, [load, loadSpots]);

  const openCreate = () => setEditPanel({ member: null });
  const openEdit = (m: Member) => setEditPanel({ member: m });

  const handleDeleteCategoria = async () => {
    if (!deleteCatTarget) return;
    await api.deleteCategoria(deleteCatTarget.id);
    setDeleteCatTarget(null);
    setCatView(null);
    load();
  };

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
  const handleUnassign = async (spotId: number) => { await api.unassignParking(spotId); loadSpots(); };
  const handleDeleteSpot = async (spot: ParkingSpot) => {
    if (!confirm(`¿Eliminar espacio ${spot.spot_number}?`)) return;
    await api.deleteParking(spot.id); loadSpots();
  };

  return (
    <>
      {/* Sub-navegación */}
      <nav
        className="flex gap-1 mb-4"
        style={{ borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.14)' }}
      >
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className="font-display tracking-widest text-xs px-3 py-2"
            style={{
              color: view === v.id ? '#F5F5F0' : 'var(--brand-muted)',
              borderBottom: `2px solid ${view === v.id ? 'var(--brand-primary)' : 'transparent'}`,
            }}
          >
            {v.label}
          </button>
        ))}
      </nav>

      {/* ──────────── CATEGORÍAS ──────────── */}
      {view === 'categorias' && (
        <>
          {catView ? (
            <CategoryDetailView
              categoria={catView}
              members={members.filter(m => m.categoria_id === catView.id)}
              categorias={categorias}
              onBack={() => setCatView(null)}
              onEditMember={openEdit}
              onCreateMember={openCreate}
            />
          ) : (
            <>
              {/* Header */}
              <div
                className="sticky top-14 z-40 -mx-5 px-5 md:-mx-8 md:px-8 pt-4 pb-3 mb-4"
                style={{ backgroundColor: 'var(--brand-bg)', borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.08)' }}
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-white text-2xl tracking-widest uppercase">Categorías</h2>
                  <button
                    onClick={() => setCatDrawer({ mode: 'create', cat: null })}
                    className="font-display tracking-widest text-sm px-4 py-2 rounded-xl active:scale-95 transition-all whitespace-nowrap"
                    style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-on-primary)', border: 'none' }}
                  >
                    + Nueva
                  </button>
                </div>
              </div>

              {/* 2-col grid */}
              {categorias.length === 0 ? (
                <div className="text-center py-16 text-sm" style={{ color: 'rgb(var(--brand-muted-rgb) / 0.4)' }}>
                  No hay categorías creadas
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {categorias.map(c => {
                    const catMembers = members
                      .filter(m => m.categoria_id === c.id)
                      .sort((a, b) => (a.apellido || '').localeCompare(b.apellido || '', 'es'));
                    const catColor = c.color || '#E5484D';
                    const preview = catMembers.slice(0, 5);
                    const overflow = catMembers.length - 5;
                    return (
                      <div
                        key={c.id}
                        className="rounded-2xl overflow-hidden flex flex-col"
                        style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.18)' }}
                      >
                        {/* Card header */}
                        <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />
                            <div className="min-w-0">
                              <p className="text-white font-bold text-base leading-tight truncate">{c.nombre}</p>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>
                                {catMembers.length} jugador{catMembers.length !== 1 ? 'es' : ''}
                              </p>
                            </div>
                          </div>
                          <ActionMenu items={[
                            { label: 'Editar categoría', onClick: () => setCatDrawer({ mode: 'edit', cat: c }) },
                            { label: 'Eliminar…', color: 'red' as const, onClick: () => setDeleteCatTarget(c) },
                          ]} />
                        </div>

                        {/* Avatar preview strip */}
                        <div className="px-4 py-3 flex-1" style={{ borderTop: '1px solid rgb(var(--brand-accent-rgb) / 0.08)' }}>
                          {catMembers.length === 0 ? (
                            <p className="text-xs py-1 text-center" style={{ color: 'rgb(var(--brand-muted-rgb) / 0.35)' }}>
                              Sin jugadores asignados
                            </p>
                          ) : (
                            <div className="flex items-center gap-2">
                              {preview.map(m => {
                                const bgColor = avatarColor(`${m.apellido}${m.nombre}`);
                                return (
                                  <div
                                    key={m.id}
                                    className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
                                    style={{
                                      backgroundColor: m.foto_url ? 'var(--brand-bg)' : bgColor,
                                      border: '2px solid rgb(var(--brand-accent-rgb) / 0.15)',
                                      opacity: (m.status || "ACTIVE") === "ACTIVE" ? 1 : 0.4,
                                    }}
                                  >
                                    {m.foto_url
                                      ? <img src={m.foto_url} alt={m.nombre} className="w-full h-full object-cover" />
                                      : <span className="text-xs font-bold text-white">{getInitials(m.apellido, m.nombre)}</span>
                                    }
                                  </div>
                                );
                              })}
                              {overflow > 0 && (
                                <div
                                  className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                                  style={{ backgroundColor: 'rgb(var(--brand-accent-rgb) / 0.12)', color: 'var(--brand-accent)', border: '2px solid rgb(var(--brand-accent-rgb) / 0.2)' }}
                                >
                                  +{overflow}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Footer link */}
                        <button
                          onClick={() => setCatView(c)}
                          className="w-full px-4 py-2.5 text-xs font-semibold tracking-wider text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.05]"
                          style={{ color: 'var(--brand-accent)', borderTop: '1px solid rgb(var(--brand-accent-rgb) / 0.1)' }}
                        >
                          Ver categoría →
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {categorias.length > 0 && (
                <p className="text-center text-xs mt-6 tracking-widest uppercase"
                  style={{ color: 'rgb(var(--brand-accent-rgb) / 0.25)' }}>
                  {categorias.length} categoría{categorias.length !== 1 ? 's' : ''}
                </p>
              )}
            </>
          )}

          {deleteCatTarget && (
            <ConfirmModal
              title={`¿Eliminar "${deleteCatTarget.nombre}"?`}
              body="Los jugadores de esta categoría quedarán sin categoría asignada. No se puede deshacer."
              onCancel={() => setDeleteCatTarget(null)}
              onConfirm={handleDeleteCategoria}
              confirmLabel="Eliminar"
            />
          )}

          {catDrawer && (
            <CategoryDrawer
              mode={catDrawer.mode}
              categoria={catDrawer.cat}
              onSave={saved => {
                setCatDrawer(null);
                if (catView && saved.id === catView.id) setCatView(saved);
                load();
              }}
              onClose={() => setCatDrawer(null)}
            />
          )}
        </>
      )}

      {/* ──────────── COCHERAS ──────────── */}
      {view === 'cocheras' && (
        <>
          <form onSubmit={handleAddSpot} className="flex gap-2 mb-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <input
              type="text" placeholder="Número de espacio (ej. A1)"
              value={newSpotNumber} onChange={e => setNewSpotNumber(e.target.value)}
              className="input-field flex-1"
            />
            <button type="submit" disabled={addingSpot || !newSpotNumber.trim()}
              className="btn-red font-display tracking-widest text-base px-5 py-2.5 rounded-xl active:scale-95 transition-all whitespace-nowrap disabled:opacity-40"
              style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-on-primary)', border: 'none' }}>
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
                            <p className="text-white font-semibold text-sm truncate">{spot.nombre} {spot.apellido}</p>
                            <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{spot.patente || 'Sin patente'}</p>
                          </>
                        ) : (
                          <p className="text-sm italic" style={{ color: 'rgb(var(--brand-muted-rgb) / 0.5)' }}>Sin asignar</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 items-center">
                      {!spot.member_id && (
                        <button onClick={() => setAssigningSpotId(isOpen ? null : spot.id)}
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
                  {isOpen && (
                    <div className="mt-3 pt-3 animate-slide-up" style={{ borderTop: '1px solid rgb(var(--brand-accent-rgb) / 0.12)' }}>
                      <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'rgb(var(--brand-accent-rgb) / 0.6)' }}>
                        Seleccionar jugador
                      </p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {members.filter(m => (m.status || "ACTIVE") === "ACTIVE").map(m => (
                          <button key={m.id} onClick={() => handleAssign(spot.id, m.id)}
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

      {editPanel !== null && (
        <PlayerEditPanel
          member={editPanel.member}
          categorias={categorias}
          onSave={() => { setEditPanel(null); load(); }}
          onClose={() => setEditPanel(null)}
        />
      )}
    </>
  );
}
