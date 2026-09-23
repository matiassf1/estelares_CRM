import { formatLastSeen } from '../../utils/time';

interface BarPoint { date: string; count: number; }
interface MiniBarProps {
  data: BarPoint[];
  height?: number;
  color?: string;
  showAxis?: boolean;
}

export default function MiniBar({ data, height = 40, color = 'var(--brand-primary)', showAxis = false }: MiniBarProps) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  const today = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const W = 100;
  const barW = W / data.length;
  const offsetX = 0;
  const axisH = showAxis ? 20 : 0;
  const totalH = height + axisH;

  return (
    <svg
      viewBox={`0 0 ${W} ${totalH}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: showAxis ? height + 24 : height, display: 'block' }}
    >
      {/* baseline */}
      <line x1={0} y1={height} x2={W} y2={height} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
      {data.map((d, i) => {
        const barH = (d.count / max) * (height - 2);
        const isToday = d.date === today;
        const x = offsetX + i * barW;
        const barColor = isToday ? '#3FB56B' : d.count > 0 ? color : 'rgba(255,255,255,0.06)';
        return (
          <g key={d.date}>
            <rect
              x={x + barW * 0.1}
              y={height - barH}
              width={barW * 0.8}
              height={Math.max(barH, d.count > 0 ? 1.5 : 0)}
              style={{ fill: barColor }}
              rx="1"
            />
            <title>{d.date}: {d.count}</title>
          </g>
        );
      })}
      {showAxis && data.length > 1 && (
        <>
          <text x={offsetX + barW * 0.5} y={totalH - 3} fontSize="5" fill="rgba(255,255,255,0.35)" textAnchor="middle">
            {formatLastSeen(data[0].date)}
          </text>
          <text
            x={offsetX + barsW - barW * 0.5}
            y={totalH - 3}
            fontSize="5"
            fill={data[data.length - 1].date === today ? '#3FB56B' : 'rgba(255,255,255,0.35)'}
            textAnchor="middle"
          >
            {data[data.length - 1].date === today ? 'Hoy' : formatLastSeen(data[data.length - 1].date)}
          </text>
        </>
      )}
    </svg>
  );
}
