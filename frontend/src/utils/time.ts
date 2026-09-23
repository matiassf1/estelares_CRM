// Format a date string (YYYY-MM-DD or ISO) for display in es-AR.
// "hoy" / "ayer" / "lun 14 sep" / "14 sep 2025" (cross-year)
export function formatLastSeen(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  // If ISO string (has T), apply UTC-3 offset to get Argentina local date
  const argDate = dateStr.includes('T')
    ? new Date(d.getTime() - 3 * 60 * 60 * 1000)
    : d;
  const now = new Date();
  const todayAr = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const todayStr = todayAr.toISOString().slice(0, 10);
  const argStr = argDate.toISOString().slice(0, 10);
  if (argStr === todayStr) return 'hoy';
  const yesterday = new Date(todayAr);
  yesterday.setDate(yesterday.getDate() - 1);
  if (argStr === yesterday.toISOString().slice(0, 10)) return 'ayer';
  const sameYear = argDate.getFullYear() === todayAr.getFullYear();
  return argDate.toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}
