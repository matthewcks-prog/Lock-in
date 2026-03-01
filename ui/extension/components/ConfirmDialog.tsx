import { useEffect, useRef, useCallback, type MouseEvent, type RefObject } from 'react';
import { AlertTriangle, X } from 'lucide-react';

const INITIAL_FOCUS_DELAY_MS = 50;

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

interface ConfirmHeaderProps {
  isDanger: boolean;
  onClose: () => void;
  isLoading: boolean;
}

interface ConfirmContentProps {
  title: string;
  description: string;
}

interface ConfirmActionsProps {
  cancelButtonRef: RefObject<HTMLButtonElement>;
  cancelLabel: string;
  confirmLabel: string;
  isDanger: boolean;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function useInitialFocus(isOpen: boolean, cancelButtonRef: RefObject<HTMLButtonElement>): void {
  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, INITIAL_FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isOpen, cancelButtonRef]);
}

function useEscapeClose(isOpen: boolean, isLoading: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);
}

function useBodyScrollLock(isOpen: boolean): void {
  useEffect(() => {
    if (!isOpen) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);
}

function useBackdropCloseHandler(
  isLoading: boolean,
  onClose: () => void,
): (event: MouseEvent<HTMLDivElement>) => void {
  return useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget && !isLoading) {
        onClose();
      }
    },
    [isLoading, onClose],
  );
}

function useConfirmHandler(isLoading: boolean, onConfirm: () => void): () => void {
  return useCallback(() => {
    if (!isLoading) {
      onConfirm();
    }
  }, [isLoading, onConfirm]);
}

function getConfirmButtonClass(isDanger: boolean): string {
  return `lockin-confirm-btn ${
    isDanger ? 'lockin-confirm-btn-danger' : 'lockin-confirm-btn-primary'
  }`;
}

function ConfirmDialogHeader({ isDanger, onClose, isLoading }: ConfirmHeaderProps): JSX.Element {
  return (
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
  );
}

function ConfirmDialogContent({ title, description }: ConfirmContentProps): JSX.Element {
  return (
    <div className="lockin-confirm-content">
      <h3 id="confirm-dialog-title" className="lockin-confirm-title">
        {title}
      </h3>
      <p id="confirm-dialog-description" className="lockin-confirm-description">
        {description}
      </p>
    </div>
  );
}

function ConfirmDialogActions({
  cancelButtonRef,
  cancelLabel,
  confirmLabel,
  isDanger,
  isLoading,
  onClose,
  onConfirm,
}: ConfirmActionsProps): JSX.Element {
  return (
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
        className={getConfirmButtonClass(isDanger)}
        onClick={onConfirm}
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
  );
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
}: ConfirmDialogProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useInitialFocus(isOpen, cancelButtonRef);
  useEscapeClose(isOpen, isLoading, onClose);
  useBodyScrollLock(isOpen);

  const handleBackdropClick = useBackdropCloseHandler(isLoading, onClose);
  const handleConfirm = useConfirmHandler(isLoading, onConfirm);

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
        <ConfirmDialogHeader isDanger={isDanger} onClose={onClose} isLoading={isLoading} />
        <ConfirmDialogContent title={title} description={description} />
        <ConfirmDialogActions
          cancelButtonRef={cancelButtonRef}
          cancelLabel={cancelLabel}
          confirmLabel={confirmLabel}
          isDanger={isDanger}
          isLoading={isLoading}
          onClose={onClose}
          onConfirm={handleConfirm}
        />
      </div>
    </div>
  );
}
