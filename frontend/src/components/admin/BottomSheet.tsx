import { useEffect } from 'react';

interface BottomSheetItem {
  label: string;
  onClick: () => void;
  color?: 'default' | 'gold' | 'red';
  separator?: boolean;
}

interface BottomSheetProps {
  title: string;
  subtitle?: string;
  items: BottomSheetItem[];
  onClose: () => void;
}

export default function BottomSheet({ title, subtitle, items, onClose }: BottomSheetProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const colorStyle = (color: BottomSheetItem['color'] = 'default') => {
    if (color === 'gold') return { color: 'var(--brand-gold)' };
    if (color === 'red') return { color: 'var(--brand-primary)' };
    return { color: 'var(--brand-accent)' };
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col justify-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-t-3xl p-5"
        style={{
          backgroundColor: 'var(--brand-surface)',
          border: '1px solid rgb(var(--brand-accent-rgb) / 0.12)',
          paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: '1px solid rgb(var(--brand-accent-rgb) / 0.1)' }}>
          <div className="flex-1">
            <p className="font-semibold text-white text-base">{title}</p>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>{subtitle}</p>}
          </div>
        </div>
        <div className="flex flex-col">
          {items.map((item, idx) => (
            <div key={idx}>
              {item.separator && <div className="my-1.5 h-px" style={{ backgroundColor: 'rgb(var(--brand-accent-rgb) / 0.08)' }} />}
              <button
                onClick={() => { item.onClick(); onClose(); }}
                className="w-full text-left py-3.5 text-base transition-opacity active:opacity-60"
                style={colorStyle(item.color)}
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
