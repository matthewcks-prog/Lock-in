/**
 * FeedbackModal Component
 *
 * Modal dialog for submitting user feedback (bug reports, feature requests, questions).
 * Auto-captures context (URL, course code, extension version, browser).
 */

import { useEffect, useRef, useCallback } from 'react';
import { useFeedbackForm } from './hooks/useFeedbackForm';
import type { ApiClient } from '@api/client';
import type { FeedbackType, FeedbackContext } from '@api/resources/feedbackClient';
import { sanitizeUrl } from '@core/utils/urlSanitizer';

export interface FeedbackModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when modal should close */
  onClose: () => void;
  /** API client for submitting feedback */
  apiClient: ApiClient | null;
  /** Current page URL */
  pageUrl?: string;
  /** Course code (if detected) */
  courseCode?: string | null;
}

const FEEDBACK_TYPES: { value: FeedbackType; label: string; description: string }[] = [
  { value: 'bug', label: '🐛 Bug Report', description: 'Something is broken or not working' },
  {
    value: 'feature',
    label: '💡 Feature Request',
    description: 'Suggest a new feature or improvement',
  },
  { value: 'question', label: '❓ Question', description: 'Ask a question about using Lock-in' },
  { value: 'other', label: '💬 Other', description: 'General feedback or comments' },
];

/**
 * Get extension version from Chrome runtime
 */
function getExtensionVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis as any).chrome?.runtime?.getManifest?.()?.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Get browser info from user agent
 */
function getBrowserInfo(): string {
  try {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) {
      const match = ua.match(/Chrome\/(\d+)/);
      return match ? `Chrome ${match[1]}` : 'Chrome';
    }
    if (ua.includes('Firefox')) {
      const match = ua.match(/Firefox\/(\d+)/);
      return match ? `Firefox ${match[1]}` : 'Firefox';
    }
    if (ua.includes('Safari')) {
      const match = ua.match(/Version\/(\d+)/);
      return match ? `Safari ${match[1]}` : 'Safari';
    }
    return 'Unknown browser';
  } catch {
    return 'Unknown browser';
  }
}

export function FeedbackModal({
  isOpen,
  onClose,
  apiClient,
  pageUrl,
  courseCode,
}: FeedbackModalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    formState,
    setType,
    setMessage,
    isSubmitting,
    error,
    isSuccess,
    submit,
    reset,
    validationError,
  } = useFeedbackForm({
    apiClient,
    onSuccess: () => {
      // Keep modal open to show success message, then auto-close
      setTimeout(() => {
        onClose();
        reset();
      }, 2000);
    },
  });

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  const handleSubmit = useCallback(async () => {
    // Sanitize URL to remove sensitive query parameters (sesskey, tokens, etc.)
    const context: FeedbackContext = {
      url: sanitizeUrl(pageUrl || window.location.href),
      extensionVersion: getExtensionVersion(),
      browser: getBrowserInfo(),
    };
    if (courseCode) {
      context.courseCode = courseCode;
    }
    if (document.title) {
      context.page = document.title;
    }

    await submit(context);
  }, [pageUrl, courseCode, submit]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !isSubmitting) {
        onClose();
      }
    },
    [isSubmitting, onClose],
  );

  if (!isOpen) return null;

  return (
    <div className="lockin-feedback-backdrop" onClick={handleBackdropClick}>
      <div
        className="lockin-feedback-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
      >
        {/* Header */}
        <div className="lockin-feedback-header">
          <h2 id="feedback-title" className="lockin-feedback-title">
            Send Feedback
          </h2>
          <button
            className="lockin-feedback-close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close feedback form"
          >
            ×
          </button>
        </div>

        {/* Success State */}
        {isSuccess ? (
          <div className="lockin-feedback-success">
            <div className="lockin-feedback-success-icon">✓</div>
            <p className="lockin-feedback-success-text">
              Thank you for your feedback!
              <br />
              <span className="lockin-feedback-success-subtext">We'll review it soon.</span>
            </p>
          </div>
        ) : (
          <>
            {/* Body */}
            <div className="lockin-feedback-body">
              {/* Type Selection */}
              <div className="lockin-feedback-field">
                <label className="lockin-feedback-label">What type of feedback?</label>
                <div className="lockin-feedback-type-grid">
                  {FEEDBACK_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      className={`lockin-feedback-type-btn ${formState.type === type.value ? 'is-selected' : ''}`}
                      onClick={() => setType(type.value)}
                      disabled={isSubmitting}
                    >
                      <span className="lockin-feedback-type-label">{type.label}</span>
                      <span className="lockin-feedback-type-desc">{type.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div className="lockin-feedback-field">
                <label htmlFor="feedback-message" className="lockin-feedback-label">
                  {formState.type === 'bug'
                    ? 'Describe what happened'
                    : formState.type === 'feature'
                      ? 'Describe your idea'
                      : formState.type === 'question'
                        ? 'What would you like to know?'
                        : 'Your feedback'}
                </label>
                <textarea
                  id="feedback-message"
                  ref={textareaRef}
                  className={`lockin-feedback-textarea ${validationError ? 'has-error' : ''}`}
                  placeholder={
                    formState.type === 'bug'
                      ? 'What were you trying to do? What happened instead?'
                      : formState.type === 'feature'
                        ? 'What feature would help you? How would you use it?'
                        : 'Type your message here...'
                  }
                  value={formState.message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={isSubmitting}
                  rows={5}
                  maxLength={5000}
                />
                <div className="lockin-feedback-textarea-meta">
                  {validationError ? (
                    <span className="lockin-feedback-error">{validationError}</span>
                  ) : (
                    <span className="lockin-feedback-char-count">
                      {formState.message.length} / 5000
                    </span>
                  )}
                </div>
              </div>

              {/* Context Info (Collapsed) */}
              <details className="lockin-feedback-context">
                <summary className="lockin-feedback-context-summary">
                  Auto-captured context (click to expand)
                </summary>
                <div className="lockin-feedback-context-details">
                  <div className="lockin-feedback-context-row">
                    <span className="lockin-feedback-context-label">Page:</span>
                    <span className="lockin-feedback-context-value">
                      {pageUrl || window.location.href}
                    </span>
                  </div>
                  {courseCode && (
                    <div className="lockin-feedback-context-row">
                      <span className="lockin-feedback-context-label">Course:</span>
                      <span className="lockin-feedback-context-value">{courseCode}</span>
                    </div>
                  )}
                  <div className="lockin-feedback-context-row">
                    <span className="lockin-feedback-context-label">Version:</span>
                    <span className="lockin-feedback-context-value">{getExtensionVersion()}</span>
                  </div>
                  <div className="lockin-feedback-context-row">
                    <span className="lockin-feedback-context-label">Browser:</span>
                    <span className="lockin-feedback-context-value">{getBrowserInfo()}</span>
                  </div>
                </div>
              </details>

              {/* Error */}
              {error && <div className="lockin-feedback-error-banner">{error.message}</div>}
            </div>

            {/* Footer */}
            <div className="lockin-feedback-footer">
              <button
                type="button"
                className="lockin-feedback-btn lockin-feedback-btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="lockin-feedback-btn lockin-feedback-btn-primary"
                onClick={handleSubmit}
                disabled={isSubmitting || !formState.message.trim()}
              >
                {isSubmitting ? (
                  <>
                    <span className="lockin-feedback-spinner" />
                    Sending...
                  </>
                ) : (
                  'Send Feedback'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
