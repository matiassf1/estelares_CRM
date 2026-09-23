// Heatmap de concurrencia por día de semana × hora del día. Sin deps externas.

interface HeatCell { weekday: number; hour: number; count: number }

interface Props {
  data: HeatCell[];
  startHour?: number;
  endHour?: number;
}

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HOURS = [17, 18, 19, 20, 21, 22, 23];

export default function HeatmapGrid({ data, startHour = 7, endHour = 23 }: Props) {
  const hours = HOURS;
  const filtered = data.filter(d => HOURS.includes(d.hour));
  const max = Math.max(...filtered.map(d => d.count), 1);

  const cellW = 36;
  const cellH = 24;
  const labelW = 28;
  const labelH = 20;
  const totalW = labelW + hours.length * cellW;
  const totalH = labelH + DAYS.length * cellH;

  const getCount = (wd: number, h: number) =>
    filtered.find(d => d.weekday === wd && d.hour === h)?.count ?? 0;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${totalW} ${totalH}`} style={{ width: totalW, height: totalH, display: 'block' }}>
        {/* hour labels */}
        {hours.map((h, i) => (
          <text key={h} x={labelW + i * cellW + cellW / 2} y={12}
            textAnchor="middle" fontSize={7} fill="rgba(255,255,255,0.4)">
            {h}
          </text>
        ))}
        {/* day labels + cells */}
        {DAYS.map((day, wd) => (
          <g key={wd}>
            <text x={labelW - 3} y={labelH + wd * cellH + cellH / 2 + 3}
              textAnchor="end" fontSize={8} fill="rgba(255,255,255,0.5)">
              {day}
            </text>
            {hours.map((h, hi) => {
              const count = getCount(wd, h);
              const intensity = count / max;
              return (
                <rect key={h}
                  x={labelW + hi * cellW + 1}
                  y={labelH + wd * cellH + 1}
                  width={cellW - 2} height={cellH - 2} rx={2}
                  fill={`rgba(220,38,38,${intensity > 0 ? Math.max(0.08, intensity) : 0})`}
                  stroke="rgba(255,255,255,0.04)" strokeWidth={0.5}
                >
                  <title>{day} {h}:00 — {count} ingresos</title>
                </rect>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}
