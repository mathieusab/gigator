import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

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
      className="overlay"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="panel"
        style={{ width: `min(${widthPx}px, 100%)` }}
      >
        <div className="panel-header">
          <div className="panel-title">{title}</div>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            className="btn btn-icon"
            aria-label="Fermer"
            title="Fermer"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
