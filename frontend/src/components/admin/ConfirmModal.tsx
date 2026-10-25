import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { lockBodyScroll } from '../../utils/scrollLock';

interface ConfirmModalProps {
  title: string;
  /** Acepta nodos además de texto para poder mostrar contenido con formato. */
  body: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  onAlternative?: () => void;
  alternativeLabel?: string;
  confirmLabel?: string;
}

export default function ConfirmModal({
  title, body, onCancel, onConfirm, onAlternative, alternativeLabel = 'Desactivar', confirmLabel = 'Eliminar'
}: ConfirmModalProps) {
  useEffect(() => lockBodyScroll(), []);
  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-5"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ backgroundColor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.15)' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-display text-white text-xl tracking-wide mb-2">{title}</h3>
        <div className="text-sm mb-6 max-h-[50vh] overflow-y-auto" style={{ color: 'var(--brand-muted)', lineHeight: 1.6 }}>{body}</div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm transition-all active:scale-95"
            style={{ backgroundColor: 'var(--brand-bg)', color: 'var(--brand-muted)', border: '1px solid rgb(var(--brand-accent-rgb) / 0.15)' }}
          >
            Cancelar
          </button>
          {onAlternative && (
            <button
              onClick={onAlternative}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{ backgroundColor: 'rgba(212,167,44,0.1)', color: 'var(--brand-gold)', border: '1px solid rgba(212,167,44,0.35)' }}
            >
              {alternativeLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
