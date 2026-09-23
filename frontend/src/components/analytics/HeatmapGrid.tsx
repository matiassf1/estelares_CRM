// Heatmap de concurrencia por día de semana × hora del día. Sin deps externas.

interface HeatCell { weekday: number; hour: number; count: number }

interface Props {
  data: HeatCell[];
}

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HOURS = [17, 18, 19, 20, 21, 22, 23];

export default function HeatmapGrid({ data }: Props) {
  const filtered = data.filter(d => HOURS.includes(d.hour));
  const max = Math.max(...filtered.map(d => d.count), 1);

  const getCount = (wd: number, h: number) =>
    filtered.find(d => d.weekday === wd && d.hour === h)?.count ?? 0;

  const activeDays = DAYS.map((day, wd) => ({ day, wd }))
    .filter(({ wd }) => HOURS.some(h => getCount(wd, h) > 0));

  if (activeDays.length === 0) {
    return <p className="text-xs py-4 text-center" style={{ color: 'var(--brand-muted)' }}>Sin datos en este período</p>;
  }

  // Use CSS Grid instead of SVG for full-width responsive layout
  const cellSize = 'minmax(0, 1fr)';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `28px repeat(${HOURS.length}, ${cellSize})`, gap: 2 }}>
      {/* Header row: empty corner + hour labels */}
      <div />
      {HOURS.map(h => (
        <div key={h} className="text-center" style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', paddingBottom: 4 }}>
          {h}
        </div>
      ))}

      {/* Data rows */}
      {activeDays.map(({ day, wd }) => (
        <>
          <div key={`label-${wd}`} className="flex items-center justify-end pr-1" style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
            {day}
          </div>
          {HOURS.map(h => {
            const count = getCount(wd, h);
            const intensity = count / max;
            return (
              <div
                key={h}
                title={`${day} ${h}:00 — ${count} ingresos`}
                style={{
                  height: 20,
                  borderRadius: 2,
                  backgroundColor: `rgba(220,38,38,${intensity > 0 ? Math.max(0.12, intensity) : 0})`,
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
              />
            );
          })}
        </>
      ))}
    </div>
  );
}
