import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  duration?: number;
}

export default function Toast({ message, actionLabel, onAction, onDismiss, duration = 5000 }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onDismiss, 300); }, duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss]);

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl transition-all duration-300"
      style={{
        backgroundColor: '#1e1e20',
        border: '1px solid rgba(255,255,255,0.12)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(12px)',
      }}
    >
      <span className="text-sm text-white">{message}</span>
      {actionLabel && onAction && (
        <button
          onClick={() => { onAction(); onDismiss(); }}
          className="text-sm font-semibold active:opacity-70"
          style={{ color: 'var(--brand-gold)' }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
