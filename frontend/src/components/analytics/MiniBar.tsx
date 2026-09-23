// Sparkline de barras SVG inline. Sin dependencias externas.

interface BarPoint { date?: string; count: number }

interface Props {
  data: BarPoint[];
  height?: number;
  color?: string;
}

export default function MiniBar({ data, height = 40, color = 'var(--brand-primary)' }: Props) {
  if (!data.length) return <div style={{ height }} className="opacity-20 rounded" />;
  const max = Math.max(...data.map(d => d.count), 1);
  const w = 100 / data.length;
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      {data.map((d, i) => {
        const barH = (d.count / max) * height;
        return (
          <rect
            key={i}
            x={i * w + 0.5}
            y={height - barH}
            width={w - 1}
            height={barH}
            rx={1}
            fill={color}
            opacity={0.8}
          />
        );
      })}
    </svg>
  );
}
