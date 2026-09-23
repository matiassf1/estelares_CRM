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
  const today = new Date().toISOString().slice(0, 10);
  const W = 100;
  const barW = W / data.length;
  const axisH = showAxis ? 20 : 0;
  const totalH = height + axisH;

  return (
    <svg
      viewBox={`0 0 ${W} ${totalH}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: showAxis ? height + 24 : height, display: 'block' }}
    >
      {data.map((d, i) => {
        const barH = (d.count / max) * height;
        const isToday = d.date === today;
        const x = i * barW;
        return (
          <g key={i}>
            <rect
              x={x + barW * 0.12}
              y={height - barH}
              width={barW * 0.76}
              height={Math.max(barH, d.count > 0 ? 1.5 : 0)}
              fill={isToday ? '#3FB56B' : d.count > 0 ? color : 'rgba(255,255,255,0.06)'}
              rx="1"
            />
            <title>{d.date}: {d.count}</title>
          </g>
        );
      })}
      {showAxis && data.length > 1 && (
        <>
          <text x={barW * 0.5} y={totalH - 3} fontSize="5" fill="rgba(255,255,255,0.35)" textAnchor="middle">
            {formatLastSeen(data[0].date)}
          </text>
          <text
            x={W - barW * 0.5}
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
