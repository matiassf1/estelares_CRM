import { useState, useRef, useEffect } from 'react';

interface ActionMenuItem {
  label: string;
  onClick: () => void;
  color?: 'default' | 'gold' | 'red';
  separator?: boolean;
}

interface ActionMenuProps {
  items: ActionMenuItem[];
}

export default function ActionMenu({ items }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const colorStyle = (color: ActionMenuItem['color'] = 'default') => {
    if (color === 'gold') return { color: 'var(--brand-gold)' };
    if (color === 'red') return { color: 'var(--brand-primary)' };
    return { color: 'var(--brand-accent)' };
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
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
      {open && (
        <div
          className="absolute right-0 top-9 z-50 min-w-[180px] rounded-xl py-1.5 shadow-2xl"
          style={{ backgroundColor: '#1e1e20', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          {items.map((item, idx) => (
            <div key={idx}>
              {item.separator && <div className="my-1 h-px mx-3" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />}
              <button
                onClick={() => { item.onClick(); setOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/5 active:opacity-70"
                style={colorStyle(item.color)}
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
