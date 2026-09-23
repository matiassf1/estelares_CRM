import { useState, useMemo, useEffect } from 'react';
import { Categoria, Member, CategoryAnalytics, api } from '../../lib/api';
import { formatDni, formatPlayerName, getInitials } from '../../utils/format';
import { formatLastSeen } from '../../utils/time';
import ActionMenu from './ActionMenu';
import MiniBar from '../analytics/MiniBar';

function formatHour(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function getRange() {
  const to = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function avatarColor(name: string): string {
  const colors = ['#c0392b','#8e44ad','#2980b9','#16a085','#d35400','#27ae60','#2c3e50'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

interface Props {
  categoria: Categoria;
  members: Member[];
  categorias: Categoria[];
  onBack: () => void;
  onEditMember: (m: Member) => void;
  onCreateMember: () => void;
}

type DetailTab = 'plantel' | 'asistencia';

export default function CategoryDetailView({ categoria, members, onBack, onEditMember, onCreateMember }: Props) {
  const [activeTab, setActiveTab] = useState<DetailTab>('plantel');
  const [search, setSearch] = useState('');
  const [analytics, setAnalytics] = useState<CategoryAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsSort, setAnalyticsSort] = useState<'count' | 'avg_hour' | 'apellido'>('count');

  useEffect(() => {
    if (activeTab !== 'asistencia') return;
    setAnalyticsLoading(true);
    api.analyticsCategory(categoria.id, getRange())
      .then(setAnalytics)
      .finally(() => setAnalyticsLoading(false));
  }, [activeTab, categoria.id]);

  const catMembers = useMemo(() =>
    members
      .filter(m => m.categoria_id === categoria.id)
      .filter(m => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return `${m.nombre} ${m.apellido} ${m.dni}`.toLowerCase().includes(q);
      })
      .sort((a, b) => (a.apellido || '').localeCompare(b.apellido || '', 'es')),
    [members, categoria.id, search]
  );

  const catColor = categoria.color || '#E5484D';
  const totalMembers = members.filter(m => m.categoria_id === categoria.id).length;

  return (
    <div className="flex flex-col min-h-0">
      {/* Back nav + title */}
      <div
        className="sticky top-14 z-40 -mx-5 px-5 md:-mx-8 md:px-8 pt-4 pb-0"
        style={{ backgroundColor: 'var(--brand-bg)', borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.08)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs mb-3 transition-opacity active:opacity-60"
          style={{ color: 'var(--brand-muted)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver a categorías
        </button>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />
            <div>
              <h2 className="font-display text-white text-2xl tracking-widest uppercase leading-tight">{categoria.nombre}</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>
                {totalMembers} jugador{totalMembers !== 1 ? 'es' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0">
          {(['plantel', 'asistencia'] as const).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all relative"
              style={activeTab === t
                ? { color: '#ffffff', borderBottom: '2px solid #E5484D' }
                : { color: 'var(--brand-muted)', borderBottom: '2px solid transparent' }
              }
            >
              {t === 'plantel' ? 'Plantel' : 'Asistencia'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="pt-5">
        {activeTab === 'plantel' && (
          <>
            {/* Search + Add */}
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: 'var(--brand-muted)' }}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar jugador..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="input-field w-full pl-9"
                  style={{ backgroundColor: 'var(--brand-input-bg)', color: '#F5F5F0' }}
                />
              </div>
              <button
                onClick={onCreateMember}
                className="font-display tracking-widest text-white text-sm px-4 py-2.5 rounded-xl active:scale-95 transition-all whitespace-nowrap"
                style={{ backgroundColor: 'var(--brand-primary)', border: 'none' }}
              >
                + Agregar
              </button>
            </div>

            {/* Empty — no members */}
            {catMembers.length === 0 && !search && (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: 'rgb(var(--brand-accent-rgb) / 0.08)' }}>
                  <svg className="w-6 h-6" style={{ color: 'var(--brand-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-sm mb-1 text-white font-semibold">Sin jugadores en esta categoría</p>
                <p className="text-xs mb-4" style={{ color: 'var(--brand-muted)' }}>Agregá jugadores para comenzar.</p>
                <button
                  onClick={onCreateMember}
                  className="text-sm font-semibold px-4 py-2 rounded-lg transition-all active:scale-95"
                  style={{ backgroundColor: 'rgb(var(--brand-primary-rgb) / 0.15)', color: 'var(--brand-primary)', border: '1px solid rgb(var(--brand-primary-rgb) / 0.3)' }}
                >
                  + Agregar jugador
                </button>
              </div>
            )}

            {/* Empty — search no results */}
            {catMembers.length === 0 && search && (
              <div className="text-center py-12 text-sm" style={{ color: 'rgb(var(--brand-muted-rgb) / 0.4)' }}>
                Sin resultados para &ldquo;{search}&rdquo;
              </div>
            )}

            {/* Desktop table */}
            {catMembers.length > 0 && (
              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--brand-muted)', borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.1)' }}>
                      <th className="text-left py-2 font-semibold">Jugador</th>
                      <th className="text-left py-2 font-semibold">DNI</th>
                      <th className="text-left py-2 font-semibold">Vehículo</th>
                      <th className="text-left py-2 font-semibold">Estado</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {catMembers.map(m => {
                      const initials = getInitials(m.apellido, m.nombre);
                      const bgColor = avatarColor(`${m.apellido}${m.nombre}`);
                      return (
                        <tr
                          key={m.id}
                          className="transition-colors hover:bg-white/[0.02] cursor-pointer"
                          style={{ borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.06)', opacity: m.activo ? 1 : 0.45 }}
                          onClick={() => onEditMember(m)}
                        >
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                style={{ backgroundColor: m.foto_url ? 'var(--brand-bg)' : bgColor }}>
                                {m.foto_url
                                  ? <img src={m.foto_url} alt="" className="w-full h-full object-cover" />
                                  : initials}
                              </div>
                              <p className="font-semibold text-white">{formatPlayerName(m.apellido, m.nombre)}</p>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-xs" style={{ color: 'var(--brand-muted)' }}>{formatDni(m.dni)}</td>
                          <td className="py-3 pr-4 text-xs capitalize" style={{ color: 'var(--brand-muted)' }}>
                            {m.tipo_vehiculo || 'Sin vehículo'}
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                              style={m.activo
                                ? { backgroundColor: 'rgb(63 181 107 / 0.15)', color: '#3FB56B', border: '1px solid rgb(63 181 107 / 0.3)' }
                                : { backgroundColor: 'rgb(var(--brand-accent-rgb) / 0.08)', color: 'var(--brand-muted)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.15)' }
                              }
                            >
                              {m.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="py-3" onClick={e => e.stopPropagation()}>
                            <ActionMenu items={[
                              { label: 'Editar jugador', onClick: () => onEditMember(m) },
                            ]} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Mobile cards */}
            {catMembers.length > 0 && (
              <div className="md:hidden space-y-2">
                {catMembers.map(m => {
                  const initials = getInitials(m.apellido, m.nombre);
                  const bgColor = avatarColor(`${m.apellido}${m.nombre}`);
                  return (
                    <div
                      key={m.id}
                      onClick={() => onEditMember(m)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors active:opacity-70"
                      style={{
                        backgroundColor: 'var(--brand-surface)',
                        border: '1px solid rgb(var(--brand-accent-rgb) / 0.15)',
                        opacity: m.activo ? 1 : 0.45,
                      }}
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: m.foto_url ? 'var(--brand-bg)' : bgColor }}>
                        {m.foto_url
                          ? <img src={m.foto_url} alt="" className="w-full h-full object-cover" />
                          : initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm truncate">{formatPlayerName(m.apellido, m.nombre)}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>
                          {m.tipo_vehiculo ? m.tipo_vehiculo.charAt(0).toUpperCase() + m.tipo_vehiculo.slice(1) : 'Sin vehículo'} · {m.activo ? 'Activo' : 'Inactivo'}
                        </p>
                      </div>
                      <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--brand-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  );
                })}
              </div>
            )}

            {catMembers.length > 0 && (
              <p className="text-center text-xs mt-6 tracking-widest uppercase" style={{ color: 'rgb(var(--brand-accent-rgb) / 0.25)' }}>
                {catMembers.length} jugador{catMembers.length !== 1 ? 'es' : ''}
              </p>
            )}
          </>
        )}

        {activeTab === 'asistencia' && (
          <div className="flex flex-col gap-4">
            {analyticsLoading && (
              <div className="py-12 text-center text-xs" style={{ color: 'var(--brand-muted)' }}>Cargando...</div>
            )}
            {!analyticsLoading && analytics && (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Ingresos', value: analytics.total_checkins },
                    { label: 'Jugadores', value: `${analytics.unique_members}/${analytics.active_members}` },
                    { label: 'Horarios', value: analytics.schedules.length, sub: 'configurados' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl px-3 py-3" style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgba(201,168,76,0.12)' }}>
                      <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: 'var(--brand-accent)' }}>{s.label}</p>
                      <p className="text-xl font-bold text-white leading-none">{s.value}</p>
                      {s.sub && <p className="text-[9px] mt-0.5" style={{ color: 'var(--brand-muted)' }}>{s.sub}</p>}
                    </div>
                  ))}
                </div>

                {/* Bar chart */}
                {analytics.by_day.length > 0 && (
                  <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgba(201,168,76,0.12)' }}>
                    <p className="text-[9px] uppercase tracking-widest mb-3" style={{ color: 'var(--brand-accent)' }}>Ingresos por día</p>
                    <MiniBar data={analytics.by_day} height={48} showAxis />
                  </div>
                )}

                {/* Member table */}
                <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgba(201,168,76,0.12)' }}>
                  <div className="px-4 py-2.5 flex gap-1.5 items-center flex-wrap border-b" style={{ borderColor: 'rgba(201,168,76,0.1)' }}>
                    <span className="text-[9px] uppercase tracking-widest mr-auto" style={{ color: 'var(--brand-accent)' }}>Jugadores</span>
                    {(['count', 'avg_hour', 'apellido'] as const).map(s => (
                      <button key={s} onClick={() => setAnalyticsSort(s)}
                        className="text-[9px] px-2 py-1 rounded uppercase tracking-wider"
                        style={{ backgroundColor: analyticsSort === s ? '#E5484D' : 'var(--brand-bg)', color: analyticsSort === s ? '#fff' : 'var(--brand-muted)' }}>
                        {s === 'count' ? 'Asistencias' : s === 'avg_hour' ? 'Hora' : 'Nombre'}
                      </button>
                    ))}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
                          {['Jugador', 'Ingresos', 'Hora prom.', 'Último'].map(h => (
                            <th key={h} className="px-4 py-2 text-left text-[9px] uppercase tracking-widest" style={{ color: 'var(--brand-accent)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...analytics.members]
                          .sort((a, b) => analyticsSort === 'count' ? b.count - a.count : analyticsSort === 'avg_hour' ? (a.avg_hour ?? 99) - (b.avg_hour ?? 99) : a.apellido.localeCompare(b.apellido, 'es'))
                          .map(m => (
                            <tr key={m.id} style={{ borderBottom: '1px solid rgba(201,168,76,0.06)' }}>
                              <td className="px-4 py-3 text-white font-medium">{m.apellido}, {m.nombre}</td>
                              <td className="px-4 py-3" style={{ color: '#E5484D' }}>{m.count}</td>
                              <td className="px-4 py-3" style={{ color: 'var(--brand-muted)' }}>{m.avg_hour != null ? formatHour(m.avg_hour) : '—'}</td>
                              <td className="px-4 py-3" style={{ color: 'var(--brand-muted)' }}>{formatLastSeen(m.last_checkin)}</td>
                            </tr>
                          ))}
                        {analytics.members.length === 0 && (
                          <tr><td colSpan={4} className="px-4 py-8 text-center text-xs" style={{ color: 'var(--brand-muted)' }}>Sin ingresos en los últimos 30 días</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
