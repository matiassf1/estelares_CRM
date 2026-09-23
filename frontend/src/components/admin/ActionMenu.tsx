import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ActionMenuItem {
  label: string;
  onClick: () => void;
  color?: 'default' | 'gold' | 'red';
  separator?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
  header?: { title: string; subtitle?: string };
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

function colorStyle(color: ActionMenuItem['color'] = 'default') {
  if (color === 'gold') return { color: 'var(--brand-gold)' };
  if (color === 'red') return { color: '#f87171' };
  return { color: 'rgba(255,255,255,0.85)' };
}

// ── Mobile bottom sheet ───────────────────────────────────────────────────────
function BottomSheet({ items, header, onClose }: ActionMenuProps & { onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Delay so the initial render is off-screen, then animate in
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 260);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col justify-end"
      style={{ backgroundColor: `rgba(0,0,0,${visible ? 0.55 : 0})`, transition: 'background-color 0.25s ease' }}
      onMouseDown={e => { if (e.target === e.currentTarget) close(); }}
      onTouchStart={e => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className="w-full rounded-t-2xl pb-safe-bottom"
        style={{
          backgroundColor: '#1a1a1c',
          border: '1px solid rgba(255,255,255,0.1)',
          borderBottom: 'none',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.26s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }} />
        </div>

        {/* Header */}
        {header && (
          <div className="px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <p className="text-white font-semibold text-base">{header.title}</p>
            {header.subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>{header.subtitle}</p>}
          </div>
        )}

        {/* Actions */}
        <div className="py-2">
          {items.map((item, idx) => (
            <div key={idx}>
              {item.separator && (
                <div className="my-1 mx-4 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.07)' }} />
              )}
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => { item.onClick(); close(); }}
                className="w-full text-left px-5 py-3.5 text-base active:opacity-60 transition-opacity"
                style={colorStyle(item.color)}
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>

        {/* Cancel */}
        <div className="px-4 pb-6 pt-1">
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

// ── Desktop dropdown ──────────────────────────────────────────────────────────
function Dropdown({ items, onClose }: { items: ActionMenuItem[]; onClose: () => void }) {
  return (
    <div
      className="absolute right-0 top-9 z-50 min-w-[180px] rounded-xl py-1.5 shadow-2xl"
      style={{ backgroundColor: '#1e1e20', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      {items.map((item, idx) => (
        <div key={idx}>
          {item.separator && <div className="my-1 h-px mx-3" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />}
          <button
            onClick={() => { item.onClick(); onClose(); }}
            className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/5 active:opacity-70"
            style={colorStyle(item.color)}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ActionMenu({ items, header }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile || !open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open, isMobile]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className="w-8 h-8 flex items-center justify-center rounded-lg transition-all active:scale-90"
        style={{
          color: open ? 'var(--brand-accent)' : 'var(--brand-muted)',
          backgroundColor: open ? 'rgb(var(--brand-accent-rgb) / 0.1)' : 'transparent',
        }}
        aria-label="Más acciones"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
        </svg>
      </button>

      {open && isMobile && (
        <BottomSheet items={items} header={header} onClose={() => setOpen(false)} />
      )}
      {open && !isMobile && (
        <Dropdown items={items} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
