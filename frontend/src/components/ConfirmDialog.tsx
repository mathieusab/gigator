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
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17,24,39,0.55)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width: 'min(560px, 100%)',
          background: 'white',
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          boxShadow: '0 24px 48px rgba(0,0,0,0.22)',
          padding: 16,
          display: 'grid',
          gap: 12,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'grid', gap: 6 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
          {description ? (
            <div style={{ color: '#4b5563', fontSize: 14, lineHeight: 1.35 }}>{description}</div>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            ref={cancelButtonRef}
            onClick={onCancel}
            disabled={isConfirming}
            style={{
              background: 'white',
              border: '1px solid #e5e7eb',
            }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            style={{
              background: isConfirming ? '#f3f4f6' : '#fee2e2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontWeight: 650,
            }}
          >
            {isConfirming ? 'Suppression…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
