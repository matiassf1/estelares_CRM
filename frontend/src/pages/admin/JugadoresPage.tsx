import { useState, useEffect, useCallback } from 'react';
import { api, Member, ParkingSpot, Categoria } from '../../lib/api.ts';
import { formatDni, formatPlayerName, getInitials } from '../../utils/format';
import ActionMenu from '../../components/admin/ActionMenu';
import BottomSheet from '../../components/admin/BottomSheet';
import Toast from '../../components/admin/Toast';
import PlayerEditPanel from '../../components/admin/PlayerEditPanel';
import MembershipBadge from '../../components/admin/MembershipBadge';
import MembershipSheet, { type MembershipOp } from '../../components/admin/MembershipSheet';
import MembershipTimeline from '../../components/admin/MembershipTimeline';
import InfoPanel from '../../components/admin/InfoPanel';

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

type MemberFilter = 'todos' | 'hoy' | 'suspendidos' | 'bajas' | 'revision' | 'sin_foto';

export default function JugadoresPage({ onIrACocheras }: { onIrACocheras: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [stats, setStats] = useState({ today: 0, total: 0, activos: 0, suspendidos: 0, bajas: 0 });
  const [search, setSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('todos');
  const [filterCatId, setFilterCatId] = useState<number | null>(null);
  const [editPanel, setEditPanel] = useState<{ member: Member | null } | null>(null);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);

  const [sheetMember, setSheetMember] = useState<Member | null>(null);
  const [membershipSheet, setMembershipSheet] = useState<{ member: Member; op: MembershipOp } | null>(null);
  const [historyMember, setHistoryMember] = useState<Member | null>(null);
  const [toast, setToast] = useState<{ message: string; onUndo?: () => void } | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const load = useCallback(async () => {
    const [m, s, c] = await Promise.all([api.getMembers(), api.getStats(), api.getCategorias()]);
    setMembers(m); setStats(s); setCategorias(c);
  }, []);

  const loadSpots = useCallback(async () => {
    const s = await api.getParkingSpots();
    setSpots(s);
  }, []);

  useEffect(() => { load(); loadSpots(); }, [load, loadSpots]);

  const openCreate = () => setEditPanel({ member: null });
  const openEdit = (m: Member) => setEditPanel({ member: m });

  /**
   * Acciones disponibles según el estado administrativo. La eliminación física
   * ya no se ofrece: destruía el historial de asistencias. Su reemplazo es la
   * baja, que lo conserva y admite reactivación.
   */
  const playerActionItems = (m: Member) => {
    const status = m.status || 'ACTIVE';
    const openOp = (op: MembershipOp) => () => setMembershipSheet({ member: m, op });
    const verHistorial = { label: 'Ver historial', onClick: () => setHistoryMember(m) };

    if (status === 'TERMINATED') {
      return [
        verHistorial,
        { separator: true as const, label: 'Reactivar', color: 'gold' as const, onClick: openOp('reactivate') },
      ];
    }
    if (status === 'SUSPENDED') {
      return [
        { label: 'Editar datos', onClick: () => openEdit(m) },
        verHistorial,
        { separator: true as const, label: 'Reactivar', color: 'gold' as const, onClick: openOp('reactivate') },
        { label: 'Dar de baja…', color: 'red' as const, onClick: openOp('terminate') },
      ];
    }
    return [
      { label: 'Editar datos', onClick: () => openEdit(m) },
      { label: 'Asignar cochera', onClick: () => onIrACocheras() },
      verHistorial,
      { separator: true as const, label: 'Suspender membresía…', color: 'gold' as const, onClick: openOp('suspend') },
      { label: 'Dar de baja…', color: 'red' as const, onClick: openOp('terminate') },
    ];
  };

  const isActive = (m: Member) => (m.status || 'ACTIVE') === 'ACTIVE';
  const suspendidos = members.filter(m => m.status === 'SUSPENDED').length;
  const bajas = members.filter(m => m.status === 'TERMINATED').length;
  // Jugadores migrados del booleano anterior: el motivo real nunca se registró
  // y el club debe reclasificarlos uno por uno.
  const enRevision = members.filter(m => m.needs_review).length;
  const sinFoto = members.filter(m => isActive(m) && !m.foto_url).length;
  const cocherasLibres = spots.filter(s => !s.member_id).length;

  const CHIP_LABEL: Record<MemberFilter, string> = {
    todos: `Todos ${members.length}`,
    hoy: `Hoy ${stats.today}`,
    suspendidos: `Suspendidos ${suspendidos}`,
    bajas: `Bajas ${bajas}`,
    revision: `Revisar ${enRevision}`,
    sin_foto: `Sin foto ${sinFoto}`,
  };

  const filtered = members
    .filter(m => `${m.nombre} ${m.apellido} ${m.dni}`.toLowerCase().includes(search.toLowerCase()))
    .filter(m => {
      if (memberFilter === 'suspendidos') return m.status === 'SUSPENDED';
      if (memberFilter === 'bajas') return m.status === 'TERMINATED';
      if (memberFilter === 'revision') return !!m.needs_review;
      if (memberFilter === 'sin_foto') return isActive(m) && !m.foto_url;
      // 'hoy': member list lacks per-member check-in date; card shows stats.today count only
      return true;
    })
    .filter(m => filterCatId ? m.categoria_id === filterCatId : true);

  return (
    <>
      <div
        className="sticky top-28 md:top-14 z-40 -mx-5 px-5 md:-mx-8 md:px-8 pt-4 pb-3 mb-2"
        style={{ backgroundColor: 'var(--brand-bg)', borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.08)' }}
      >
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-white text-2xl tracking-widest uppercase">Jugadores</h2>
          <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>
            {stats.activos} activos · {stats.today} hoy
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
            className="font-display tracking-widest text-sm px-4 py-2.5 rounded-xl active:scale-95 transition-all whitespace-nowrap"
            style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-on-primary)', border: 'none' }}
          >
            + AGREGAR
          </button>
        </div>

        {/* Metric cards */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 md:mx-0 md:px-0 mt-3 md:grid md:grid-cols-5 scrollbar-none">
          {[
            { label: 'Ingresos hoy', value: stats.today, color: '#3FB56B', filter: 'hoy' as MemberFilter },
            { label: 'Activos', value: stats.activos, color: 'white', filter: 'todos' as MemberFilter },
            { label: 'Suspendidos', value: stats.suspendidos, color: 'var(--brand-gold)', filter: 'suspendidos' as MemberFilter },
            { label: 'Bajas', value: stats.bajas, color: '#f87171', filter: 'bajas' as MemberFilter },
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
          {(['todos', 'hoy', 'suspendidos', 'bajas', ...(enRevision > 0 ? ['revision' as const] : []), 'sin_foto'] as MemberFilter[]).map(chip => (
            <button
              key={chip}
              onClick={() => setMemberFilter(chip)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
              style={memberFilter === chip
                ? { backgroundColor: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }
                : { backgroundColor: 'var(--brand-surface)', color: 'var(--brand-muted)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.12)' }}
            >
              {CHIP_LABEL[chip]}
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
                      style={{ borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.06)', opacity: isActive(m) ? 1 : 0.55 }}
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
                        <MembershipBadge member={m} withDetail />
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
              border: isActive(m) ? '1px solid rgb(var(--brand-accent-rgb) / 0.2)' : '1px solid rgb(var(--brand-border-rgb) / 0.5)',
              opacity: isActive(m) ? 1 : 0.55,
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
      {membershipSheet && (
        <MembershipSheet
          member={membershipSheet.member}
          op={membershipSheet.op}
          onClose={() => setMembershipSheet(null)}
          onDone={message => { setToast({ message }); load(); }}
        />
      )}
      {historyMember && (
        <InfoPanel
          title="Historial administrativo"
          subtitle={`${historyMember.apellido}, ${historyMember.nombre}`}
          onClose={() => setHistoryMember(null)}
        >
          <MembershipTimeline memberId={historyMember.id} />
        </InfoPanel>
      )}
      {toast && (
        <Toast
          message={toast.message}
          actionLabel="Deshacer"
          onAction={toast.onUndo}
          onDismiss={dismissToast}
        />
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
