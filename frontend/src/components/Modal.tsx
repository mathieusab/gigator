import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  widthPx?: number;
};

export default function Modal({ open, title, onClose, children, widthPx = 720 }: ModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    // Prevent background scrolling while modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(e) => {
        // Backdrop click closes.
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17,24,39,0.55)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        zIndex: 60,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width: `min(${widthPx}px, 100%)`,
          maxHeight: 'min(80vh, 900px)',
          overflow: 'auto',
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
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            style={{
              background: 'white',
              border: '1px solid #e5e7eb',
            }}
          >
            Fermer
          </button>
        </div>

        <div>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
