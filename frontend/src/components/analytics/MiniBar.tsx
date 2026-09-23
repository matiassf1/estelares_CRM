import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatLastSeen } from '../../utils/time';

interface BarPoint { date: string; count: number; }
interface MiniBarProps {
  data: BarPoint[];
  height?: number;
  color?: string;
  showAxis?: boolean;
}

export default function MiniBar({ data, height = 40, color = '#E5484D', showAxis = false }: MiniBarProps) {
  if (!data.length) return null;
  const today = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const chartData = data.map(d => ({
    ...d,
    isToday: d.date === today,
    label: d.date === today ? 'Hoy' : d.date === data[0].date ? formatLastSeen(d.date) : '',
  }));

  const totalHeight = showAxis ? height + 28 : height;

  return (
    <ResponsiveContainer width="100%" height={totalHeight}>
      <BarChart data={chartData} margin={{ top: 2, right: 0, bottom: showAxis ? 16 : 0, left: 0 }} barCategoryGap="20%">
        {showAxis && (
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.35)' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
        )}
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as BarPoint & { isToday: boolean };
            return (
              <div className="text-xs px-2 py-1 rounded" style={{ background: '#1a1a1a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                {d.date}: {d.count}
              </div>
            );
          }}
        />
        <Bar dataKey="count" radius={[2, 2, 0, 0]} minPointSize={d => (d > 0 ? 2 : 0)}>
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
