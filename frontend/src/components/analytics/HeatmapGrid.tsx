import { useState } from 'react';

interface HeatCell { weekday: number; hour: number; count: number }
interface Props { data: HeatCell[] }

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HOURS = [17, 18, 19, 20, 21, 22, 23];

interface TooltipState {
  day: string; hour: number; count: number;
  x: number; y: number;
}

export default function HeatmapGrid({ data }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const filtered = data.filter(d => HOURS.includes(d.hour));
  const max = Math.max(...filtered.map(d => d.count), 1);

  const getCount = (wd: number, h: number) =>
    filtered.find(d => d.weekday === wd && d.hour === h)?.count ?? 0;

  const activeDays = DAYS.map((day, wd) => ({ day, wd }))
    .filter(({ wd }) => HOURS.some(h => getCount(wd, h) > 0));

  if (activeDays.length === 0) {
    return <p className="text-xs py-4 text-center" style={{ color: 'var(--brand-muted)' }}>Sin datos en este período</p>;
  }

  return (
    <div className="relative" onMouseLeave={() => setTooltip(null)}>
      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 text-xs px-2 py-1.5 rounded whitespace-nowrap"
          style={{
            left: tooltip.x,
            top: tooltip.y - 36,
            transform: 'translateX(-50%)',
            background: '#1a1a1a',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>{tooltip.day} {tooltip.hour}:00–{tooltip.hour + 1}:00</span>
          <span className="ml-2 font-semibold">
            {tooltip.count} ingreso{tooltip.count !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: `28px repeat(${HOURS.length}, minmax(0, 1fr))`, gap: 2 }}>
        {/* Header */}
        <div />
        {HOURS.map(h => (
          <div key={h} className="text-center" style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', paddingBottom: 4 }}>
            {h}
          </div>
        ))}

        {/* Rows */}
        {activeDays.map(({ day, wd }) => (
          <>
            <div key={`label-${wd}`} className="flex items-center justify-end pr-1" style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
              {day}
            </div>
            {HOURS.map(h => {
              const count = getCount(wd, h);
              const intensity = count / max;
              const isHovered = tooltip?.day === day && tooltip?.hour === h;
              return (
                <div
                  key={h}
                  onMouseEnter={e => {
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    const parent = (e.currentTarget as HTMLDivElement).closest('.relative')!.getBoundingClientRect();
                    setTooltip({
                      day, hour: h, count,
                      x: rect.left - parent.left + rect.width / 2,
                      y: rect.top - parent.top,
                    });
                  }}
                  style={{
                    height: 20,
                    borderRadius: 2,
                    cursor: count > 0 ? 'default' : 'default',
                    backgroundColor: `rgba(220,38,38,${intensity > 0 ? Math.max(0.12, intensity) : 0})`,
                    border: isHovered
                      ? '1px solid rgba(255,255,255,0.5)'
                      : '1px solid rgba(255,255,255,0.04)',
                    transition: 'border-color 0.1s',
                    transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                  }}
                />
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
