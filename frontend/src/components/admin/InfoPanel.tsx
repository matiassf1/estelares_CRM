import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { lockBodyScroll } from '../../utils/scrollLock';

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
}

/**
 * Panel de sólo lectura. Existe porque ConfirmModal ofrece "Cancelar" y
 * "Confirmar": en una vista que no decide nada, ese par no significa nada y
 * confunde. Acá hay una sola salida.
 */
export default function InfoPanel({ title, subtitle, children, onClose }: Props) {
  useEffect(() => {
    const unlock = lockBodyScroll();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { unlock(); document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end md:items-center justify-center md:p-5"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-sm rounded-t-2xl md:rounded-2xl p-5 md:p-6"
        style={{
          backgroundColor: 'var(--brand-surface)',
          border: '1px solid rgb(var(--brand-accent-rgb) / 0.15)',
          paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-display text-white text-lg tracking-wide">{title}</h3>
        {subtitle && (
          <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--brand-muted)' }}>{subtitle}</p>
        )}

        <div className="max-h-[55vh] overflow-y-auto mt-2">{children}</div>

        <button
          onClick={onClose}
          className="w-full mt-5 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95"
          style={{
            backgroundColor: 'var(--brand-bg)',
            color: 'rgba(255,255,255,0.75)',
            border: '1px solid rgb(var(--brand-accent-rgb) / 0.15)',
          }}
        >
          Cerrar
        </button>
      </div>
    </div>,
    document.body
  );
}
