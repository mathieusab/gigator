import { useEffect, useRef } from 'react';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // Focus the safest action by default.
    cancelButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!isConfirming) onCancel();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel, isConfirming]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        // Backdrop click cancels.
        if (e.target === e.currentTarget && !isConfirming) onCancel();
      }}
      className="overlay"
      style={{ zIndex: 50 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="panel"
        style={{ width: 'min(560px, 100%)' }}
      >
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
          {description ? (
            <div style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.35 }}>{description}</div>
          ) : null}
        </div>

        <div className="actions actions-right">
          <button
            type="button"
            ref={cancelButtonRef}
            onClick={onCancel}
            disabled={isConfirming}
            className="btn btn-sm"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="btn btn-danger btn-sm"
          >
            {isConfirming ? 'Suppression…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
