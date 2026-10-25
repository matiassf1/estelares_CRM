import type { Member, MembershipStatus } from '../../lib/api';

export const STATUS_COLOR: Record<MembershipStatus, string> = {
  ACTIVE: '#3FB56B',
  SUSPENDED: 'var(--brand-gold)',
  TERMINATED: '#f87171',
};

export const STATUS_LABEL: Record<MembershipStatus, string> = {
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspendido',
  TERMINATED: 'Baja',
};

/** dd/mm a partir de 'YYYY-MM-DD', sin construir un Date (evita corrimiento de zona). */
export function shortDate(iso?: string | null): string {
  if (!iso) return '';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

/** Línea de contexto: desde cuándo rige el estado y hasta cuándo, si se sabe. */
export function statusDetail(m: Pick<Member, 'status' | 'status_since' | 'status_until'>): string {
  if (m.status === 'ACTIVE') return '';
  const desde = m.status_since ? `Desde ${shortDate(m.status_since)}` : '';
  if (m.status === 'SUSPENDED' && m.status_until) {
    return `${desde} · vuelve ${shortDate(m.status_until)}`;
  }
  return desde;
}

interface Props {
  member: Pick<Member, 'status' | 'status_since' | 'status_until' | 'needs_review'>;
  /** Agrega la línea con fechas debajo de la etiqueta. */
  withDetail?: boolean;
  size?: 'sm' | 'md';
}

export default function MembershipBadge({ member, withDetail = false, size = 'sm' }: Props) {
  const status = member.status || 'ACTIVE';
  const color = STATUS_COLOR[status];
  const detail = withDetail ? statusDetail(member) : '';

  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-medium ${
          size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
        }`}
        style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        {STATUS_LABEL[status]}
        {member.needs_review && status !== 'ACTIVE' && ' · revisar'}
      </span>
      {detail && (
        <span className="text-[10px]" style={{ color: 'var(--brand-muted)' }}>
          {detail}
        </span>
      )}
    </div>
  );
}
