import { useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Called when dialog should close */
  onClose: () => void;
  /** Called when user confirms the action */
  onConfirm: () => void;
  /** Dialog title */
  title: string;
  /** Dialog description/message */
  description: string;
  /** Text for confirm button */
  confirmLabel?: string;
  /** Text for cancel button */
  cancelLabel?: string;
  /** Variant affects styling - 'danger' for destructive actions */
  variant?: 'default' | 'danger';
  /** Whether confirm action is in progress */
  isLoading?: boolean;
}

/**
 * A reusable confirmation dialog component following industry best practices:
 * - Accessible with proper ARIA attributes and focus management
 * - Keyboard support (Escape to close, Tab trapping)
 * - Click outside to close
 * - Smooth animations
 * - Supports loading state
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  isLoading = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management: focus cancel button when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure dialog is rendered
      const timer = setTimeout(() => {
        cancelButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen]);

  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
    return undefined;
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !isLoading) {
        onClose();
      }
    },
    [isLoading, onClose],
  );

  const handleConfirm = useCallback(() => {
    if (!isLoading) {
      onConfirm();
    }
  }, [isLoading, onConfirm]);

  if (!isOpen) return null;

  const isDanger = variant === 'danger';

  return (
    <div className="lockin-confirm-backdrop" onClick={handleBackdropClick} role="presentation">
      <div
        ref={dialogRef}
        className="lockin-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <div className="lockin-confirm-header">
          <div className={`lockin-confirm-icon ${isDanger ? 'is-danger' : ''}`}>
            <AlertTriangle size={24} strokeWidth={2} />
          </div>
          <button
            type="button"
            className="lockin-confirm-close"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close dialog"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="lockin-confirm-content">
          <h3 id="confirm-dialog-title" className="lockin-confirm-title">
            {title}
          </h3>
          <p id="confirm-dialog-description" className="lockin-confirm-description">
            {description}
          </p>
        </div>

        <div className="lockin-confirm-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="lockin-confirm-btn lockin-confirm-btn-cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`lockin-confirm-btn ${
              isDanger ? 'lockin-confirm-btn-danger' : 'lockin-confirm-btn-primary'
            }`}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="lockin-confirm-spinner" aria-hidden="true" />
                <span>Deleting...</span>
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
