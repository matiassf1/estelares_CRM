import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import type { TrainingSchedule } from '../../lib/api';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

interface Props {
  categoriaId: number;
  categoriaNombre: string;
}

export default function ScheduleConfig({ categoriaId, categoriaNombre }: Props) {
  const [schedules, setSchedules] = useState<TrainingSchedule[]>([]);
  const [form, setForm] = useState({ day_of_week: 0, start_time: '21:00', tolerance_min: 15 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    api.getTrainingSchedules(categoriaId).then(s =>
      setSchedules(s.filter(x => x.valid_until === null))
    );
  };

  useEffect(() => { load(); }, [categoriaId]);

  const handleAdd = async () => {
    setLoading(true); setError('');
    try {
      await api.createTrainingSchedule({
        categoria_id: categoriaId,
        day_of_week: form.day_of_week,
        start_time: form.start_time,
        tolerance_min: form.tolerance_min,
        valid_from: new Date().toISOString().slice(0, 10),
        valid_until: null,
      });
      load();
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteTrainingSchedule(id);
      setSchedules(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-4"
      style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgba(201,168,76,0.15)' }}>
      <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--brand-accent)' }}>
        Horarios — {categoriaNombre}
      </p>

      <div className="flex flex-wrap gap-2">
        {schedules.map(s => (
          <div key={s.id} className="flex items-center gap-2 rounded-lg px-3 py-1.5"
            style={{ backgroundColor: 'var(--brand-bg)', border: '1px solid rgba(201,168,76,0.2)' }}>
            <span className="text-xs text-white">{DAY_NAMES[s.day_of_week]} {s.start_time.slice(0, 5)}</span>
            <span className="text-[10px]" style={{ color: 'var(--brand-muted)' }}>±{s.tolerance_min}min</span>
            <button onClick={() => handleDelete(s.id)}
              className="text-[10px] transition-colors hover:text-red-400"
              style={{ color: 'var(--brand-muted)' }}>✕</button>
          </div>
        ))}
        {schedules.length === 0 && (
          <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>Sin horarios configurados</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <select value={form.day_of_week}
          onChange={e => setForm(f => ({ ...f, day_of_week: Number(e.target.value) }))}
          className="text-sm py-2 px-3 rounded-lg outline-none"
          style={{ backgroundColor: 'var(--brand-bg)', color: 'white', border: '1px solid rgba(201,168,76,0.2)' }}>
          {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
        </select>
        <input type="time" value={form.start_time}
          onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
          className="text-sm py-2 px-3 rounded-lg outline-none"
          style={{ backgroundColor: 'var(--brand-bg)', color: 'white', border: '1px solid rgba(201,168,76,0.2)' }}
        />
        <div className="flex items-center gap-1">
          <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>±</span>
          <input type="number" value={form.tolerance_min} min={0} max={60}
            onChange={e => setForm(f => ({ ...f, tolerance_min: Number(e.target.value) }))}
            className="text-sm py-2 px-3 rounded-lg outline-none w-16"
            style={{ backgroundColor: 'var(--brand-bg)', color: 'white', border: '1px solid rgba(201,168,76,0.2)' }}
          />
          <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>min</span>
        </div>
        <button onClick={handleAdd} disabled={loading}
          className="text-white font-display tracking-widest text-sm px-4 py-2 rounded-xl disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: 'var(--brand-primary)', border: 'none' }}>
          + Agregar
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
