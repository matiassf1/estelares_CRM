import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface BarPoint { date: string; count: number; }
interface MiniBarProps {
  data: BarPoint[];
  height?: number;
  color?: string;
  showAxis?: boolean;
}

function toDateStr(raw: string): string {
  return raw.slice(0, 10); // handles both "2026-08-26" and "2026-08-26T03:00:00.000Z"
}

function fmtDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${days[date.getDay()]}, ${d} ${months[m - 1]}`;
}

export default function MiniBar({ data, height = 40, color = '#E5484D', showAxis = false }: MiniBarProps) {
  if (!data.length) return null;
  const today = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const chartData = data.map((d, i) => {
    const day = toDateStr(d.date);
    const isToday = day === today;
    const isFirst = i === 0;
    const isLast = i === data.length - 1;
    return {
      day,
      count: d.count,
      isToday,
      axisLabel: isToday ? 'Hoy' : (isFirst || isLast) ? fmtDate(day) : '',
    };
  });

  const totalHeight = showAxis ? height + 28 : height;

  return (
    <ResponsiveContainer width="100%" height={totalHeight}>
      <BarChart data={chartData} margin={{ top: 2, right: 0, bottom: showAxis ? 16 : 0, left: 0 }} barCategoryGap="15%">
        {showAxis && (
          <XAxis
            dataKey="axisLabel"
            tick={({ x, y, payload, index }) => {
              const d = chartData[index];
              if (!d?.axisLabel) return <g />;
              return (
                <text
                  x={x} y={y + 8}
                  textAnchor={index === 0 ? 'start' : index === chartData.length - 1 ? 'end' : 'middle'}
                  fontSize={9}
                  fill={d.isToday ? '#3FB56B' : 'rgba(255,255,255,0.35)'}
                >
                  {d.axisLabel}
                </text>
              );
            }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
        )}
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as typeof chartData[0];
            return (
              <div className="text-xs px-2 py-1 rounded" style={{ background: '#1a1a1a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ color: d.isToday ? '#3FB56B' : 'rgba(255,255,255,0.6)' }}>{d.isToday ? 'Hoy' : fmtDate(d.day)}</span>
                <span className="ml-2 font-semibold">{d.count} ingreso{d.count !== 1 ? 's' : ''}</span>
              </div>
            );
          }}
        />
        <Bar dataKey="count" radius={[2, 2, 0, 0]}>
          {chartData.map((d, i) => (
            <Cell
              key={i}
              fill={d.isToday ? '#3FB56B' : d.count > 0 ? color : 'rgba(255,255,255,0.06)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
