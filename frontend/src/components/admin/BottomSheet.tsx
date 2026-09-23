import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

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

function itemColor(color: BottomSheetItem['color'] = 'default') {
  if (color === 'gold') return 'var(--brand-gold)';
  if (color === 'red') return '#f87171';
  return 'rgba(255,255,255,0.85)';
}

export default function BottomSheet({ title, subtitle, items, onClose }: BottomSheetProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(t); document.removeEventListener('keydown', onKey); };
  }, []);

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 260);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col justify-end"
      style={{
        backgroundColor: `rgba(0,0,0,${visible ? 0.6 : 0})`,
        backdropFilter: visible ? 'blur(3px)' : 'blur(0px)',
        transition: 'background-color 0.25s ease, backdrop-filter 0.25s ease',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) close(); }}
      onTouchStart={e => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className="w-full rounded-t-2xl"
        style={{
          backgroundColor: '#1a1a1c',
          border: '1px solid rgba(255,255,255,0.1)',
          borderBottom: 'none',
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.26s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        onMouseDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }} />
        </div>

        {/* Header */}
        <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <p className="font-semibold text-white text-base">{title}</p>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>{subtitle}</p>}
        </div>

        {/* Actions */}
        <div className="py-2">
          {items.map((item, idx) => (
            <div key={idx}>
              {item.separator && (
                <div className="my-1 mx-5 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }} />
              )}
              <button
                onClick={() => { item.onClick(); close(); }}
                className="w-full text-left px-5 py-3.5 text-base active:opacity-60 transition-opacity"
                style={{ color: itemColor(item.color) }}
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>

        {/* Cancel */}
        <div className="px-4 pt-1">
          <button
            onClick={close}
            className="w-full py-3.5 rounded-xl text-sm font-medium text-center active:opacity-60 transition-opacity"
            style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
