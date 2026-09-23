import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.tsx';
import { api, Member, ParkingSpot, Categoria } from '../lib/api.ts';
import { formatDni, formatPlayerName, getInitials } from '../utils/format';
import ClubShield from '../components/ClubShield.tsx';
import Analytics from './Analytics';
import ActionMenu from '../components/admin/ActionMenu';
import BottomSheet from '../components/admin/BottomSheet';
import ConfirmModal from '../components/admin/ConfirmModal';
import Toast from '../components/admin/Toast';
import PlayerEditPanel from '../components/admin/PlayerEditPanel';
import CategoryDrawer from '../components/admin/CategoryDrawer';
import CategoryDetailView from '../components/admin/CategoryDetailView';


function VehicleIcon({ tipo, size = 14 }: { tipo?: string | null; size?: number }) {
  if (!tipo) return null;
  if (tipo === 'moto') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" />
      <path d="M8 17.5h7M15 17.5l-3-6h-2l-2 3h2" /><path d="M17 10l-2-3h-4" />
    </svg>
  );
  if (tipo === 'auto') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3a1 1 0 01-1-1v-4l2-5h14l2 5v4a1 1 0 01-1 1h-2" />
      <circle cx="7.5" cy="17.5" r="2.5" /><circle cx="16.5" cy="17.5" r="2.5" />
      <path d="M5 12h14" />
    </svg>
  );
  if (tipo === 'bicicleta') return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="17" r="3" /><circle cx="19" cy="17" r="3" />
      <path d="M12 17V9l-3 3m3-3l3 3" /><path d="M9 17l3-8h5" />
    </svg>
  );
  return null;
}

function avatarColor(name: string): string {
  const colors = ['#c0392b','#8e44ad','#2980b9','#16a085','#d35400','#27ae60','#2c3e50'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

type MemberFilter = 'todos' | 'hoy' | 'inactivos' | 'sin_foto';

export default function Admin() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'jugadores' | 'categorias' | 'parking' | 'analitica'>('jugadores');
  const [navHidden, setNavHidden] = useState(false);
  const lastScrollY = useRef(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [stats, setStats] = useState({ today: 0, total: 0 });
  const [search, setSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('todos');
  const [filterCatId, setFilterCatId] = useState<number | null>(null);
  const [editPanel, setEditPanel] = useState<{ member: Member | null } | null>(null);

  // Parking state
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [newSpotNumber, setNewSpotNumber] = useState('');
  const [spotError, setSpotError] = useState('');
  const [addingSpot, setAddingSpot] = useState(false);
  const [assigningSpotId, setAssigningSpotId] = useState<number | null>(null);

  // Categorias state
  const [catView, setCatView] = useState<Categoria | null>(null);
  const [catDrawer, setCatDrawer] = useState<{ mode: 'create' | 'edit'; cat: Categoria | null } | null>(null);
  const [deleteCatTarget, setDeleteCatTarget] = useState<Categoria | null>(null);

  const load = useCallback(async () => {
    const [m, s, c] = await Promise.all([api.getMembers(), api.getStats(), api.getCategorias()]);
    setMembers(m); setStats(s); setCategorias(c);
  }, []);

  const loadSpots = useCallback(async () => {
    const s = await api.getParkingSpots();
    setSpots(s);
  }, []);

  useEffect(() => { load(); loadSpots(); }, [load, loadSpots]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastScrollY.current + 10) setNavHidden(true);
      else if (y < lastScrollY.current - 6) setNavHidden(false);
      lastScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const openCreate = () => setEditPanel({ member: null });
  const openEdit = (m: Member) => setEditPanel({ member: m });

  const [sheetMember, setSheetMember] = useState<Member | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [toast, setToast] = useState<{ message: string; onUndo?: () => void } | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const handleToggle = async (m: Member) => { await api.updateMember(m.id, { activo: !m.activo }); load(); };

  const handleDeactivate = async (m: Member) => {
    const wasActive = m.activo;
    await api.updateMember(m.id, { activo: false });
    setMembers(prev => prev.map(x => x.id === m.id ? { ...x, activo: false } : x));
    setToast({
      message: `${m.apellido}, ${m.nombre} desactivado`,
      onUndo: async () => {
        await api.updateMember(m.id, { activo: wasActive });
        setMembers(prev => prev.map(x => x.id === m.id ? { ...x, activo: wasActive } : x));
      },
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await api.deleteMember(deleteTarget.id);
    setMembers(prev => prev.filter(x => x.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const handleDeleteCategoria = async () => {
    if (!deleteCatTarget) return;
    await api.deleteCategoria(deleteCatTarget.id);
    setDeleteCatTarget(null);
    setCatView(null);
    load();
  };

  const playerActionItems = (m: Member) => [
    { label: 'Editar datos', onClick: () => openEdit(m) },
    { label: 'Asignar cochera', onClick: () => setTab('parking') },
    { separator: true as const, label: m.activo ? 'Desactivar' : 'Activar', color: 'gold' as const,
      onClick: () => m.activo ? handleDeactivate(m) : handleToggle(m) },
    { label: 'Eliminar jugador…', color: 'red' as const, onClick: () => setDeleteTarget(m) },
  ];

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

  const inactivos = members.filter(m => !m.activo).length;
  const sinFoto = members.filter(m => m.activo && !m.foto_url).length;
  const cocherasLibres = spots.filter(s => !s.member_id).length;

  const filtered = members
    .filter(m => `${m.nombre} ${m.apellido} ${m.dni}`.toLowerCase().includes(search.toLowerCase()))
    .filter(m => {
      if (memberFilter === 'inactivos') return !m.activo;
      if (memberFilter === 'sin_foto') return m.activo && !m.foto_url;
      // 'hoy': member list lacks per-member check-in date; card shows stats.today count only
      return true;
    })
    .filter(m => filterCatId ? m.categoria_id === filterCatId : true);

  return (
    <div className="min-h-screen pattern-lines" style={{ backgroundColor: 'var(--brand-bg)' }}>

      {/* ── Header ── */}
      <div className="sticky top-0 z-50 px-5 py-3 flex justify-between items-center"
        style={{ backgroundColor: 'var(--brand-surface)', borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.2)' }}>
        <div className="flex items-center gap-3 md:hidden">
          <ClubShield size={30} className="opacity-90" />
          <div>
            <p className="text-white text-sm font-semibold leading-tight">Estelares Futsal</p>
            <p className="text-xs leading-tight" style={{ color: 'var(--brand-muted)' }}>Panel Admin</p>
          </div>
        </div>
        <div className="hidden md:block" />
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

      <div className="flex min-h-[calc(100vh-56px)]">

        {/* Sidebar — desktop only */}
        <aside
          className="hidden md:flex flex-col w-52 flex-shrink-0 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto"
          style={{ backgroundColor: 'var(--brand-surface)', borderRight: '1px solid rgb(var(--brand-accent-rgb) / 0.15)' }}
        >
          <div className="px-5 py-5 flex items-center gap-3" style={{ borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.1)' }}>
            <ClubShield size={24} className="opacity-90" />
            <div>
              <p className="text-white text-xs font-semibold leading-tight">Estelares Futsal</p>
              <p className="text-[10px] leading-tight" style={{ color: 'var(--brand-muted)' }}>Panel Admin</p>
            </div>
          </div>
          <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
            {(['jugadores', 'categorias', 'parking', 'analitica'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex items-center gap-3 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all text-left w-full"
                style={tab === t
                  ? { backgroundColor: 'rgb(var(--brand-primary-rgb) / 0.12)', color: 'var(--brand-primary)', borderLeft: '2px solid var(--brand-primary)', paddingLeft: '10px' }
                  : { color: 'var(--brand-muted)', borderLeft: '2px solid transparent', paddingLeft: '10px' }
                }
              >
                {t === 'jugadores' ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ) : t === 'categorias' ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                ) : t === 'parking' ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                )}
                {t === 'jugadores' ? 'Jugadores' : t === 'categorias' ? 'Categorías' : t === 'parking' ? 'Parking' : 'Analítica'}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 p-5 md:p-8 min-w-0">

        {/* ── Tabs ── */}
        <div className="sticky top-14 z-40 -mx-5 px-5 pt-3 pb-2 md:hidden" style={{ backgroundColor: 'var(--brand-bg)', transform: navHidden ? 'translateY(-110%)' : 'translateY(0)', transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)' }}>
        <div className="flex gap-1 p-1 rounded-xl animate-slide-up" style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.15)', animationDelay: '0.08s' }}>
          {(['jugadores', 'categorias', 'parking', 'analitica'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-lg text-xs font-display tracking-widest uppercase transition-all active:scale-95"
              style={tab === t
                ? { backgroundColor: 'var(--brand-primary)', color: '#fff' }
                : { color: 'var(--brand-muted)' }}>
              {t === 'jugadores' ? 'Jugadores' : t === 'categorias' ? 'Categorías' : t === 'parking' ? 'Parking' : 'Analítica'}
            </button>
          ))}
        </div>
        </div>

        {/* ── TAB CONTENT ── */}
        <div key={tab} className="animate-fade-in">

        {/* ──────────── JUGADORES ──────────── */}
        {tab === 'jugadores' && (
          <>
            <div
              className="sticky top-14 z-40 -mx-5 px-5 md:-mx-8 md:px-8 pt-4 pb-3 mb-2"
              style={{ backgroundColor: 'var(--brand-bg)', borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.08)' }}
            >
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-display text-white text-2xl tracking-widest uppercase">Jugadores</h2>
                <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                  {members.filter(m => m.activo).length} activos · {stats.today} hoy
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text" placeholder="Buscar por nombre o DNI"
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="input-field flex-1"
                />
                <button
                  onClick={openCreate}
                  className="font-display tracking-widest text-white text-sm px-4 py-2.5 rounded-xl active:scale-95 transition-all whitespace-nowrap"
                  style={{ backgroundColor: 'var(--brand-primary)', border: 'none' }}
                >
                  + AGREGAR
                </button>
              </div>

              {/* Metric cards */}
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 md:mx-0 md:px-0 mt-3 md:grid md:grid-cols-4 scrollbar-none">
                {[
                  { label: 'Ingresos hoy', value: stats.today, color: '#3FB56B', filter: 'hoy' as MemberFilter },
                  { label: 'Activos', value: stats.total, color: 'white', filter: 'todos' as MemberFilter },
                  { label: 'Inactivos', value: inactivos, color: 'var(--brand-gold)', filter: 'inactivos' as MemberFilter },
                  { label: 'Cocheras libres', value: cocherasLibres, color: 'white', filter: 'todos' as MemberFilter },
                ].map(card => (
                  <button
                    key={card.label}
                    onClick={() => setMemberFilter(memberFilter === card.filter && card.filter !== 'todos' ? 'todos' : card.filter)}
                    className="flex-shrink-0 flex-1 min-w-[120px] rounded-xl p-3 text-left transition-all active:scale-95"
                    style={{
                      backgroundColor: 'var(--brand-surface)',
                      border: memberFilter === card.filter && card.filter !== 'todos'
                        ? '1px solid rgb(var(--brand-primary-rgb) / 0.5)'
                        : '1px solid rgb(var(--brand-accent-rgb) / 0.12)',
                    }}
                  >
                    <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--brand-muted)' }}>{card.label}</p>
                    <p className="font-display text-2xl" style={{ color: card.color, lineHeight: 1 }}>{card.value}</p>
                  </button>
                ))}
              </div>

              {/* Filter chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 mt-2 -mx-5 px-5 md:mx-0 md:px-0 scrollbar-none">
                {(['todos', 'hoy', 'inactivos', 'sin_foto'] as const).map(chip => (
                  <button
                    key={chip}
                    onClick={() => setMemberFilter(chip)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
                    style={memberFilter === chip
                      ? { backgroundColor: 'var(--brand-primary)', color: '#fff' }
                      : { backgroundColor: 'var(--brand-surface)', color: 'var(--brand-muted)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.12)' }}
                  >
                    {chip === 'todos' ? `Todos ${members.length}` : chip === 'hoy' ? `Hoy ${stats.today}` : chip === 'inactivos' ? `Inactivos ${inactivos}` : `Sin foto ${sinFoto}`}
                  </button>
                ))}
                <select
                  value={filterCatId ?? ''}
                  onChange={e => setFilterCatId(e.target.value ? parseInt(e.target.value) : null)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold appearance-none outline-none"
                  style={{ color: filterCatId ? 'var(--brand-accent)' : 'var(--brand-muted)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.12)', backgroundColor: 'var(--brand-surface)' }}
                >
                  <option value="">Categoría</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              {filtered.length === 0 && (
                <div className="text-center py-12 text-sm" style={{ color: 'rgb(var(--brand-muted-rgb) / 0.4)' }}>
                  {search ? 'Sin resultados para esa búsqueda' : 'No hay jugadores cargados'}
                </div>
              )}

              {/* Desktop table */}
              {filtered.length > 0 && (
                <div className="hidden md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--brand-muted)', borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.1)' }}>
                        <th className="text-left py-2 font-semibold">Jugador</th>
                        <th className="text-left py-2 font-semibold">Categoría</th>
                        <th className="text-left py-2 font-semibold">Cochera</th>
                        <th className="text-left py-2 font-semibold">Estado</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(m => {
                        const cat = categorias.find(c => c.id === m.categoria_id);
                        const catColor = cat?.color || '#E5484D';
                        const spot = spots.find(s => s.member_id === m.id);
                        const initials = getInitials(m.apellido, m.nombre);
                        return (
                          <tr
                            key={m.id}
                            className="transition-colors hover:bg-white/[0.02]"
                            style={{ borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.06)', opacity: m.activo ? 1 : 0.45 }}
                          >
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                  style={{ backgroundColor: avatarColor(`${m.apellido}${m.nombre}`) }}>
                                  {m.foto_url ? <img src={m.foto_url} alt="" className="w-full h-full object-cover rounded-full" /> : initials}
                                </div>
                                <div>
                                  <p className="font-semibold text-white">{formatPlayerName(m.apellido, m.nombre)}</p>
                                  <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>DNI {formatDni(m.dni)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              {cat ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--brand-accent)' }}>
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />
                                  {cat.nombre}
                                </span>
                              ) : <span style={{ color: 'var(--brand-muted)' }}>—</span>}
                            </td>
                            <td className="py-3 pr-4 text-xs" style={{ color: spot ? 'var(--brand-accent)' : 'var(--brand-muted)' }}>
                              {spot ? `Nº ${spot.spot_number}${m.patente ? ` · ${m.patente}` : ''}` : '—'}
                            </td>
                            <td className="py-3 pr-4">
                              <span
                                className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                style={m.activo
                                  ? { backgroundColor: 'rgb(63 181 107 / 0.15)', color: '#3FB56B', border: '1px solid rgb(63 181 107 / 0.3)' }
                                  : { backgroundColor: 'rgb(var(--brand-accent-rgb) / 0.08)', color: 'var(--brand-muted)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.15)' }}
                              >
                                {m.activo ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td className="py-3">
                              <ActionMenu items={playerActionItems(m)} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Mobile cards */}
              <div className="md:hidden">
              {filtered.map((m) => (
                <div key={m.id} className="rounded-xl px-4 py-3 mb-2 transition-all cursor-pointer md:cursor-default"
                  onClick={() => { if (window.innerWidth < 768) setSheetMember(m); }}
                  style={{
                    backgroundColor: 'var(--brand-surface)',
                    border: m.activo ? '1px solid rgb(var(--brand-accent-rgb) / 0.2)' : '1px solid rgb(var(--brand-border-rgb) / 0.5)',
                    opacity: m.activo ? 1 : 0.45,
                  }}>
                  <div className="flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
                        style={{
                          backgroundColor: m.foto_url ? 'var(--brand-bg)' : avatarColor(`${m.apellido}${m.nombre}`),
                          border: '1px solid rgb(var(--brand-accent-rgb) / 0.15)',
                        }}
                      >
                        {m.foto_url ? (
                          <img src={m.foto_url} alt={m.nombre} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-white">{getInitials(m.apellido, m.nombre)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate">
                          {formatPlayerName(m.apellido, m.nombre)}
                        </p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                            DNI {formatDni(m.dni)}{m.patente ? ` · ${m.patente}` : ''}
                          </p>
                          {m.tipo_vehiculo && (
                            <span style={{ color: 'var(--brand-muted)' }}>
                              <VehicleIcon tipo={m.tipo_vehiculo} size={12} />
                            </span>
                          )}
                          {m.categoria_nombre && (() => {
                            const cat = categorias.find(c => c.id === m.categoria_id);
                            const catColor = cat?.color || '#E5484D';
                            return (
                              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-semibold tracking-wide" style={{ color: 'var(--brand-accent)' }}>
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />
                                {m.categoria_nombre}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Desktop: ⋯ menu */}
                      <div className="hidden md:block" onClick={e => e.stopPropagation()}>
                        <ActionMenu items={playerActionItems(m)} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </div>

            {filtered.length > 0 && (
              <p className="text-center text-xs mt-6 tracking-widest uppercase"
                style={{ color: 'rgb(var(--brand-accent-rgb) / 0.25)' }}>
                {filtered.length} jugador{filtered.length !== 1 ? 'es' : ''}
              </p>
            )}

            {sheetMember && (
              <BottomSheet
                title={`${sheetMember.apellido}, ${sheetMember.nombre}`}
                subtitle={`DNI ${sheetMember.dni}`}
                items={playerActionItems(sheetMember)}
                onClose={() => setSheetMember(null)}
              />
            )}
            {deleteTarget && (
              <ConfirmModal
                title={`¿Eliminar a ${deleteTarget.nombre} ${deleteTarget.apellido}?`}
                body="Se borran su carnet, su historial de ingresos y su cochera. No se puede deshacer. Si solo deja de venir, mejor desactivalo."
                onCancel={() => setDeleteTarget(null)}
                onConfirm={confirmDelete}
                onAlternative={() => { handleDeactivate(deleteTarget!); setDeleteTarget(null); }}
                alternativeLabel="Desactivar"
                confirmLabel="Eliminar"
              />
            )}
            {toast && (
              <Toast
                message={toast.message}
                actionLabel="Deshacer"
                onAction={toast.onUndo}
                onDismiss={dismissToast}
              />
            )}
          </>
        )}

        {/* ──────────── CATEGORÍAS ──────────── */}
        {tab === 'categorias' && (
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
                      className="font-display tracking-widest text-white text-sm px-4 py-2 rounded-xl active:scale-95 transition-all whitespace-nowrap"
                      style={{ backgroundColor: 'var(--brand-primary)', border: 'none' }}
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
                                        opacity: m.activo ? 1 : 0.4,
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

        {/* ──────────── PARKING ──────────── */}
        {tab === 'parking' && (
          <>
            <form onSubmit={handleAddSpot} className="flex gap-2 mb-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <input
                type="text" placeholder="Número de espacio (ej. A1)"
                value={newSpotNumber} onChange={e => setNewSpotNumber(e.target.value)}
                className="input-field flex-1"
              />
              <button type="submit" disabled={addingSpot || !newSpotNumber.trim()}
                className="btn-red font-display tracking-widest text-white text-base px-5 py-2.5 rounded-xl active:scale-95 transition-all whitespace-nowrap disabled:opacity-40"
                style={{ backgroundColor: 'var(--brand-primary)', border: 'none' }}>
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
                          {members.filter(m => m.activo).map(m => (
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
        {/* ──────────── ANALÍTICA ──────────── */}
        {tab === 'analitica' && <Analytics />}
        </div>
        </div>
      </div>

      {editPanel !== null && (
        <PlayerEditPanel
          member={editPanel.member}
          categorias={categorias}
          onSave={() => { setEditPanel(null); load(); }}
          onClose={() => setEditPanel(null)}
        />
      )}
    </div>
  );
}
