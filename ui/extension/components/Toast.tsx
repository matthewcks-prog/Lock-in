import { useEffect, useState } from 'react';
import { Star, Check, X, AlertCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'star';

interface ToastState {
  message: string;
  type: ToastType;
  isVisible: boolean;
}

export interface UseToastResult {
  toast: ToastState | null;
  showToast: (message: string, type?: ToastType) => void;
  hideToast: () => void;
}

export interface ToastProps {
  /** Toast message */
  message: string;
  /** Toast type for styling */
  type?: ToastType;
  /** Duration in ms before auto-dismiss (0 = no auto-dismiss) */
  duration?: number;
  /** Called when toast should be dismissed */
  onDismiss: () => void;
  /** Whether the toast is visible */
  isVisible: boolean;
}

const ICON_MAP = {
  success: Check,
  error: AlertCircle,
  info: AlertCircle,
  star: Star,
};
const DEFAULT_TOAST_DURATION_MS = 3000;
const TOAST_EXIT_ANIMATION_MS = 200;

/**
 * A toast notification component following industry best practices:
 * - Accessible with proper ARIA attributes
 * - Auto-dismisses after configurable duration
 * - Smooth enter/exit animations
 * - Supports multiple types with appropriate icons
 */
export function Toast({
  message,
  type = 'info',
  duration = DEFAULT_TOAST_DURATION_MS,
  onDismiss,
  isVisible,
}: ToastProps): JSX.Element | null {
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (!isVisible || duration === 0) return;

    const timer = setTimeout(() => {
      setIsLeaving(true);
      // Wait for exit animation before actually dismissing
      setTimeout(onDismiss, TOAST_EXIT_ANIMATION_MS);
    }, duration);

    return () => clearTimeout(timer);
  }, [isVisible, duration, onDismiss]);

  const handleDismiss = (): void => {
    setIsLeaving(true);
    setTimeout(onDismiss, TOAST_EXIT_ANIMATION_MS);
  };

  if (!isVisible) return null;

  const Icon = ICON_MAP[type];

  return (
    <div
      className={`lockin-toast lockin-toast-${type} ${isLeaving ? 'is-leaving' : ''}`}
      role="alert"
      aria-live="polite"
    >
      <div className="lockin-toast-icon">
        <Icon size={16} strokeWidth={2.5} />
      </div>
      <span className="lockin-toast-message">{message}</span>
      <button
        type="button"
        className="lockin-toast-dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss notification"
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

/**
 * Hook for managing toast state
 */
export function useToast(): UseToastResult {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (message: string, type: ToastType = 'info'): void => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = (): void => {
    setToast(null);
  };

  return {
    toast,
    showToast,
    hideToast,
  };
}
