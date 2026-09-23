import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { OverviewData, CategoryAnalytics, MemberAnalytics, TrafficData, Insight, AnalyticsDateRange } from '../lib/api';
import MiniBar from '../components/analytics/MiniBar';
import HeatmapGrid from '../components/analytics/HeatmapGrid';
import { formatLastSeen } from '../utils/time';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatHour(decimal: number): string {
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function defaultRange(): AnalyticsDateRange {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const PRESETS = [
  { label: 'Hoy',      days: 0 },
  { label: '7 días',   days: 6 },
  { label: '30 días',  days: 29 },
  { label: 'Este mes', days: -1 },
];

function getPresetRange(days: number): AnalyticsDateRange {
  const to = new Date().toISOString().slice(0, 10);
  if (days === -1) {
    const from = new Date();
    from.setDate(1);
    return { from: from.toISOString().slice(0, 10), to };
  }
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: from.toISOString().slice(0, 10), to };
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 rounded-full animate-spin"
        style={{ borderColor: 'var(--brand-primary)', borderTopColor: 'transparent' }} />
    </div>
  );
}

function StatCard({ label, value, sub, trend }: {
  label: string; value: string | number; sub?: string; trend?: number | null;
}) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-1"
      style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgba(201,168,76,0.15)' }}>
      <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--brand-accent)' }}>{label}</p>
      <p className="text-2xl font-display text-white tracking-wide">{value}</p>
      {sub && <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{sub}</p>}
      {trend != null && (
        <p className="text-xs font-semibold" style={{ color: trend >= 0 ? '#4ade80' : '#f87171' }}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs período anterior
        </p>
      )}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 text-xs uppercase tracking-wider self-start mb-4"
      style={{ color: 'var(--brand-muted)' }}>
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Volver
    </button>
  );
}

function PeriodFilter({ range, onChange }: {
  range: AnalyticsDateRange; onChange: (r: AnalyticsDateRange) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap items-center">
      {PRESETS.map(p => {
        const pr = getPresetRange(p.days);
        const active = range.from === pr.from && range.to === pr.to;
        return (
          <button key={p.label} onClick={() => onChange(pr)}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold uppercase tracking-wider transition-all"
            style={{
              backgroundColor: active ? 'var(--brand-primary)' : 'var(--brand-surface)',
              color: active ? '#fff' : 'var(--brand-muted)',
              border: active ? 'none' : '1px solid rgba(201,168,76,0.15)',
            }}>
            {p.label}
          </button>
        );
      })}
      <input type="date" value={range.from}
        onChange={e => onChange({ ...range, from: e.target.value })}
        className="text-xs rounded-lg px-2 py-1.5"
        style={{ backgroundColor: 'var(--brand-surface)', color: 'var(--brand-muted)', border: '1px solid rgba(201,168,76,0.15)' }}
      />
      <span style={{ color: 'var(--brand-muted)' }}>→</span>
      <input type="date" value={range.to}
        onChange={e => onChange({ ...range, to: e.target.value })}
        className="text-xs rounded-lg px-2 py-1.5"
        style={{ backgroundColor: 'var(--brand-surface)', color: 'var(--brand-muted)', border: '1px solid rgba(201,168,76,0.15)' }}
      />
    </div>
  );
}

// ── Overview panel ────────────────────────────────────────────────────────────

function OverviewPanel({
  range, onSelectCategory, onSelectMember,
}: {
  range: AnalyticsDateRange;
  onSelectCategory: (id: number, nombre: string) => void;
  onSelectMember: (id: string) => void;
}) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [traffic, setTraffic] = useState<TrafficData | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.analyticsOverview(range),
      api.analyticsTraffic(range),
      api.analyticsInsights(range),
    ]).then(([d, t, ins]) => {
      setData(d); setTraffic(t); setInsights(ins);
    }).finally(() => setLoading(false));
  }, [range.from, range.to]);

  if (loading) return <Spinner />;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-6">
      {insights.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgb(var(--brand-accent-rgb) / 0.12)' }}>
          <p className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--brand-muted)', borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.08)' }}>
            Insights
          </p>
          {insights.map((ins, i) => (
            <div
              key={i}
              className="px-4 py-3 flex items-start gap-3"
              style={{ borderTop: i > 0 ? '1px solid rgb(var(--brand-accent-rgb) / 0.06)' : undefined }}
            >
              <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                style={{ backgroundColor: ins.severity === 'warning' ? 'var(--brand-gold)' : 'var(--brand-muted)' }} />
              <p className="text-sm flex-1" style={{ color: 'var(--brand-accent)', lineHeight: 1.6 }}>
                {ins.message}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Ingresos" value={data.total_checkins} trend={data.trend_pct} />
        <StatCard label="Jugadores únicos" value={data.unique_members} sub={`de ${data.active_members} activos`} />
        <StatCard label="Promedio diario" value={data.avg_daily} />
        <StatCard label="Sin actividad" value={data.inactive_members.length} sub="en el período" />
      </div>

      <div className="rounded-2xl p-4"
        style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgba(201,168,76,0.15)' }}>
        <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--brand-accent)' }}>Ingresos por día</p>
        <MiniBar data={data.by_day} height={56} showAxis />
      </div>

      {traffic && traffic.heatmap.length > 0 && (
        <div className="rounded-2xl p-4"
          style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgba(201,168,76,0.15)' }}>
          <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--brand-accent)' }}>Concurrencia día × hora</p>
          <HeatmapGrid data={traffic.heatmap} />
        </div>
      )}

      <div className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgba(201,168,76,0.15)' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(201,168,76,0.12)' }}>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--brand-accent)' }}>Por división</p>
        </div>
        {data.active_categories.map(cat => (
          <button key={cat.id} onClick={() => onSelectCategory(cat.id, cat.nombre)}
            className="w-full px-4 py-3 flex justify-between items-center border-b last:border-0 transition-opacity active:opacity-70"
            style={{ borderColor: 'rgba(201,168,76,0.08)', backgroundColor: 'transparent', color: 'inherit' }}>
            <span className="text-white text-sm font-medium">{cat.nombre}</span>
            <div className="flex items-center gap-3">
              <span className="text-sm" style={{ color: 'var(--brand-muted)' }}>{cat.count} ingresos</span>
              <svg className="w-4 h-4" style={{ color: 'var(--brand-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
        {data.active_categories.length === 0 && (
          <p className="px-4 py-6 text-sm text-center" style={{ color: 'var(--brand-muted)' }}>Sin datos en el período</p>
        )}
      </div>

      {data.top_members.length > 0 && (
        <div className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgba(201,168,76,0.15)' }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(201,168,76,0.12)' }}>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--brand-accent)' }}>Mayor actividad</p>
          </div>
          {data.top_members.slice(0, 5).map(m => (
            <button key={m.id} onClick={() => onSelectMember(m.id)}
              className="w-full px-4 py-3 flex justify-between items-center border-b last:border-0 active:opacity-70"
              style={{ borderColor: 'rgba(201,168,76,0.08)', backgroundColor: 'transparent', color: 'inherit' }}>
              <span className="text-white text-sm">{m.apellido}, {m.nombre}</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--brand-primary)' }}>{m.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Category panel ────────────────────────────────────────────────────────────

const DAY_NAMES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

function CategoryPanel({
  catId, range, onSelectMember, onBack,
}: {
  catId: number; range: AnalyticsDateRange;
  onSelectMember: (id: string) => void; onBack: () => void;
}) {
  const [data, setData] = useState<CategoryAnalytics | null>(null);
  const [sort, setSort] = useState<'count' | 'avg_hour' | 'apellido'>('count');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.analyticsCategory(catId, range).then(setData).finally(() => setLoading(false));
  }, [catId, range.from, range.to]);

  const sorted = data?.members
    .filter(m => `${m.nombre} ${m.apellido}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'count') return b.count - a.count;
      if (sort === 'avg_hour') return (a.avg_hour ?? 99) - (b.avg_hour ?? 99);
      return a.apellido.localeCompare(b.apellido, 'es');
    }) ?? [];

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col gap-5">
      <BackButton onClick={onBack} />
      <h2 className="font-display text-white text-2xl tracking-widest">{data?.categoria.nombre}</h2>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Ingresos" value={data?.total_checkins ?? 0} />
        <StatCard label="Jugadores" value={`${data?.unique_members ?? 0}/${data?.active_members ?? 0}`} />
        <StatCard label="Horarios" value={data?.schedules.length ?? 0} sub="configurados" />
      </div>

      {data && data.by_day.length > 0 && (
        <div className="rounded-2xl p-4"
          style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgba(201,168,76,0.15)' }}>
          <MiniBar data={data.by_day} height={40} />
        </div>
      )}

      {data && data.schedules.length > 0 && (
        <div className="rounded-2xl px-4 py-3 flex flex-wrap gap-2"
          style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgba(201,168,76,0.15)' }}>
          {data.schedules.map(s => (
            <span key={s.id} className="text-xs px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: 'var(--brand-bg)', color: 'var(--brand-accent)', border: '1px solid rgba(201,168,76,0.2)' }}>
              {DAY_NAMES[s.day_of_week]} {s.start_time.slice(0, 5)}
            </span>
          ))}
        </div>
      )}

      <div className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgba(201,168,76,0.15)' }}>
        <div className="px-4 py-3 flex gap-2 flex-wrap items-center border-b"
          style={{ borderColor: 'rgba(201,168,76,0.12)' }}>
          <input placeholder="Buscar..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 text-sm py-1.5 px-3 rounded-lg outline-none"
            style={{ backgroundColor: 'var(--brand-bg)', color: 'white', border: '1px solid rgba(201,168,76,0.15)', minWidth: '120px' }}
          />
          {(['count', 'avg_hour', 'apellido'] as const).map(s => (
            <button key={s} onClick={() => setSort(s)}
              className="text-[10px] px-2 py-1 rounded uppercase tracking-wider"
              style={{ backgroundColor: sort === s ? 'var(--brand-primary)' : 'var(--brand-bg)', color: sort === s ? '#fff' : 'var(--brand-muted)' }}>
              {s === 'count' ? 'Asistencias' : s === 'avg_hour' ? 'Hora' : 'Nombre'}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
                {['Jugador', 'Ingresos', 'Hora prom.', 'Último'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-[10px] uppercase tracking-widest"
                    style={{ color: 'var(--brand-accent)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(m => (
                <tr key={m.id} onClick={() => onSelectMember(m.id)}
                  className="cursor-pointer"
                  style={{ borderBottom: '1px solid rgba(201,168,76,0.06)' }}>
                  <td className="px-4 py-3 text-white font-medium">{m.apellido}, {m.nombre}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--brand-primary)' }}>{m.count}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--brand-muted)' }}>
                    {m.avg_hour != null ? formatHour(m.avg_hour) : '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--brand-muted)' }}>{formatLastSeen(m.last_checkin)}</td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center" style={{ color: 'var(--brand-muted)' }}>Sin datos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Member panel ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  early:       { label: 'Temprano',   color: '#60a5fa' },
  on_time:     { label: 'A tiempo',   color: '#4ade80' },
  late:        { label: 'Tarde',      color: '#fbbf24' },
  unscheduled: { label: 'Sin sesión', color: 'var(--brand-muted)' },
};

function MemberPanel({
  memberId, range, onBack,
}: {
  memberId: string; range: AnalyticsDateRange; onBack: () => void;
}) {
  const [data, setData] = useState<MemberAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.analyticsMember(memberId, range).then(setData).finally(() => setLoading(false));
  }, [memberId, range.from, range.to]);

  if (loading) return <Spinner />;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-5">
      <BackButton onClick={onBack} />
      <div>
        <h2 className="font-display text-white text-2xl tracking-widest">
          {data.member.apellido?.toUpperCase()}, {data.member.nombre}
        </h2>
        {data.member.categoria_nombre && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--brand-accent)' }}>{data.member.categoria_nombre}</p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Ingresos" value={data.total_checkins}
          sub={data.sessions_expected > 0 ? `de ${data.sessions_expected} esperados` : undefined} />
        <StatCard label="Asistencia"
          value={data.attendance_pct != null ? `${data.attendance_pct}%` : 'N/A'}
          sub={data.attendance_pct == null ? 'sin horarios config.' : undefined} />
        <StatCard label="Hora promedio" value={data.avg_hour != null ? formatHour(data.avg_hour) : '—'} />
        <StatCard label="Último ingreso" value={data.days_since_last != null ? `hace ${data.days_since_last}d` : '—'} />
      </div>

      <div className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgba(201,168,76,0.15)' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(201,168,76,0.12)' }}>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--brand-accent)' }}>Historial</p>
        </div>
        {data.history.length === 0 && (
          <p className="px-4 py-6 text-center text-sm" style={{ color: 'var(--brand-muted)' }}>Sin registros en el período</p>
        )}
        {data.history.map((h, i) => {
          const status = h.schedule_match ? STATUS_STYLES[h.schedule_match] : null;
          return (
            <div key={i} className="px-4 py-3 flex justify-between items-center border-b last:border-0"
              style={{ borderColor: 'rgba(201,168,76,0.06)' }}>
              <span className="text-white text-sm">{h.date}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm" style={{ color: 'var(--brand-muted)' }}>{formatHour(h.hour_decimal)}</span>
                {status && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: status.color }}>
                    {status.label}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type View =
  | { type: 'overview' }
  | { type: 'category'; id: number; nombre: string }
  | { type: 'member'; id: string; fromCatId?: number; fromCatNombre?: string };

export default function Analytics() {
  const [range, setRange] = useState<AnalyticsDateRange>(defaultRange);
  const [view, setView] = useState<View>({ type: 'overview' });

  const handleSelectCategory = useCallback((id: number, nombre: string) => {
    setView({ type: 'category', id, nombre });
  }, []);

  const handleSelectMember = useCallback((id: string) => {
    setView(v => ({
      type: 'member', id,
      fromCatId: v.type === 'category' ? v.id : undefined,
      fromCatNombre: v.type === 'category' ? v.nombre : undefined,
    }));
  }, []);

  const handleBack = useCallback(() => {
    setView(v => {
      if (v.type === 'member' && v.fromCatId) {
        return { type: 'category', id: v.fromCatId, nombre: v.fromCatNombre ?? '' };
      }
      return { type: 'overview' };
    });
  }, []);

  const breadcrumb = view.type === 'overview' ? 'Club'
    : view.type === 'category' ? `Club → ${view.nombre}`
    : 'Club → Jugador';

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--brand-bg)' }}>
      <div className="max-w-4xl mx-auto px-5 pt-6 pb-10">
        <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: 'var(--brand-accent)' }}>
              {breadcrumb}
            </p>
            <h1 className="font-display text-white text-3xl tracking-widest">ANALÍTICA</h1>
          </div>
          <PeriodFilter range={range} onChange={setRange} />
        </div>

        {view.type === 'overview' && (
          <OverviewPanel range={range} onSelectCategory={handleSelectCategory} onSelectMember={handleSelectMember} />
        )}
        {view.type === 'category' && (
          <CategoryPanel catId={view.id} range={range} onSelectMember={handleSelectMember} onBack={() => setView({ type: 'overview' })} />
        )}
        {view.type === 'member' && (
          <MemberPanel memberId={view.id} range={range} onBack={handleBack} />
        )}
      </div>
    </div>
  );
}
