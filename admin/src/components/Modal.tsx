import { useEffect, useRef } from 'react';

export type ModalTone = 'default' | 'danger';

interface ModalProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
  /** Confirm button label. Omit to hide the footer confirm action. */
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ModalTone;
  busy?: boolean;
  onConfirm?: () => void;
  onClose: () => void;
}

/**
 * Reusable modal dialog. Replaces all `alert()` / `confirm()` usage.
 * Closes on backdrop click and Escape. Focuses the confirm/cancel action on open.
 */
export function Modal({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Close',
  tone = 'default',
  busy = false,
  onConfirm,
  onClose,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    // Focus first actionable button for accessibility.
    const t = setTimeout(() => {
      panelRef.current?.querySelector<HTMLButtonElement>('[data-autofocus]')?.focus();
    }, 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  const showFooter = confirmLabel !== undefined || cancelLabel !== undefined;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <h3 className="modal-title">{title}</h3>
          <button
            type="button"
            className="modal-x"
            aria-label="Close dialog"
            onClick={onClose}
            disabled={busy}
          >
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {showFooter && (
          <div className="modal-foot">
            <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
              {cancelLabel}
            </button>
            {confirmLabel && (
              <button
                type="button"
                data-autofocus
                className={tone === 'danger' ? 'btn danger-solid' : 'btn'}
                onClick={onConfirm}
                disabled={busy}
              >
                {busy ? 'Working…' : confirmLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
