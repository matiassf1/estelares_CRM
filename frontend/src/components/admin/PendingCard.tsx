interface Props {
  /** Cantidad a destacar. Si es 0, el llamador no debería renderizar la tarjeta. */
  value: number;
  title: string;
  detail: string;
  /** 'alert' pinta en rojo (algo está mal); 'warn' en dorado (requiere atención). */
  tone?: 'warn' | 'alert';
  onClick: () => void;
}

export default function PendingCard({ value, title, detail, tone = 'warn', onClick }: Props) {
  const color = tone === 'alert' ? 'var(--brand-danger)' : 'var(--brand-gold)';

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-3 flex gap-3 items-start transition-all active:scale-[0.98]"
      style={{
        backgroundColor: 'var(--brand-surface)',
        border: '1px solid rgb(var(--brand-border-rgb) / 0.9)',
        borderLeft: `3px solid ${color}`,
      }}
    >
      <span className="font-display text-2xl leading-none min-w-[34px]" style={{ color }}>
        {value}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-white">{title}</span>
        <span className="block text-[11px] mt-0.5" style={{ color: 'var(--brand-muted)' }}>
          {detail}
        </span>
      </span>
      <span style={{ color: 'var(--brand-muted)' }}>›</span>
    </button>
  );
}
