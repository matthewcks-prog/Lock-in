import type { FeedbackType } from '@api/resources/feedbackClient';
import {
  FEEDBACK_TYPES,
  getBrowserInfo,
  getExtensionVersion,
  hasCourseCode,
  resolveMessageLabel,
  resolveMessagePlaceholder,
} from './feedbackModalUtils';

export function FeedbackModalHeader({
  isSubmitting,
  onClose,
}: {
  isSubmitting: boolean;
  onClose: () => void;
}): JSX.Element {
  return (
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
        x
      </button>
    </div>
  );
}

export function FeedbackSuccessState(): JSX.Element {
  return (
    <div className="lockin-feedback-success">
      <div className="lockin-feedback-success-icon">OK</div>
      <p className="lockin-feedback-success-text">
        Thank you for your feedback!
        <br />
        <span className="lockin-feedback-success-subtext">We'll review it soon.</span>
      </p>
    </div>
  );
}

function FeedbackTypeSelection({
  disabled,
  selectedType,
  setType,
}: {
  disabled: boolean;
  selectedType: FeedbackType;
  setType: (type: FeedbackType) => void;
}): JSX.Element {
  return (
    <div className="lockin-feedback-field">
      <label className="lockin-feedback-label">What type of feedback?</label>
      <div className="lockin-feedback-type-grid">
        {FEEDBACK_TYPES.map((feedbackType) => (
          <button
            key={feedbackType.value}
            type="button"
            className={`lockin-feedback-type-btn ${selectedType === feedbackType.value ? 'is-selected' : ''}`}
            onClick={() => setType(feedbackType.value)}
            disabled={disabled}
          >
            <span className="lockin-feedback-type-label">{feedbackType.label}</span>
            <span className="lockin-feedback-type-desc">{feedbackType.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FeedbackMessageInput({
  disabled,
  message,
  setMessage,
  textareaRef,
  type,
  validationError,
}: {
  disabled: boolean;
  message: string;
  setMessage: (message: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  type: FeedbackType;
  validationError: string | null;
}): JSX.Element {
  const hasValidationError = validationError !== null && validationError.length > 0;
  return (
    <div className="lockin-feedback-field">
      <label htmlFor="feedback-message" className="lockin-feedback-label">
        {resolveMessageLabel(type)}
      </label>
      <textarea
        id="feedback-message"
        ref={textareaRef}
        className={`lockin-feedback-textarea ${hasValidationError ? 'has-error' : ''}`}
        placeholder={resolveMessagePlaceholder(type)}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        disabled={disabled}
        rows={5}
        maxLength={5000}
      />
      <div className="lockin-feedback-textarea-meta">
        {hasValidationError ? (
          <span className="lockin-feedback-error">{validationError}</span>
        ) : (
          <span className="lockin-feedback-char-count">{message.length} / 5000</span>
        )}
      </div>
    </div>
  );
}

function FeedbackContextDetails({
  courseCode,
  pageUrl,
}: {
  courseCode: string | null | undefined;
  pageUrl: string | undefined;
}): JSX.Element {
  const resolvedPageUrl = pageUrl ?? window.location.href;
  return (
    <details className="lockin-feedback-context">
      <summary className="lockin-feedback-context-summary">
        Auto-captured context (click to expand)
      </summary>
      <div className="lockin-feedback-context-details">
        <div className="lockin-feedback-context-row">
          <span className="lockin-feedback-context-label">Page:</span>
          <span className="lockin-feedback-context-value">{resolvedPageUrl}</span>
        </div>
        {hasCourseCode(courseCode) && (
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
  );
}

function FeedbackModalFooter({
  hasMessage,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  hasMessage: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}): JSX.Element {
  return (
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
        onClick={onSubmit}
        disabled={isSubmitting || !hasMessage}
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
  );
}

function FeedbackFormBody({
  courseCode,
  error,
  isSubmitting,
  message,
  pageUrl,
  setMessage,
  setType,
  textareaRef,
  type,
  validationError,
}: {
  courseCode: string | null | undefined;
  error: Error | null;
  isSubmitting: boolean;
  message: string;
  pageUrl: string | undefined;
  setMessage: (message: string) => void;
  setType: (type: FeedbackType) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  type: FeedbackType;
  validationError: string | null;
}): JSX.Element {
  return (
    <div className="lockin-feedback-body">
      <FeedbackTypeSelection disabled={isSubmitting} selectedType={type} setType={setType} />
      <FeedbackMessageInput
        disabled={isSubmitting}
        message={message}
        setMessage={setMessage}
        textareaRef={textareaRef}
        type={type}
        validationError={validationError}
      />
      <FeedbackContextDetails pageUrl={pageUrl} courseCode={courseCode} />
      {error !== null && <div className="lockin-feedback-error-banner">{error.message}</div>}
    </div>
  );
}

export function FeedbackFormContent({
  courseCode,
  error,
  isSubmitting,
  message,
  onClose,
  onSubmit,
  pageUrl,
  setMessage,
  setType,
  textareaRef,
  type,
  validationError,
}: {
  courseCode: string | null | undefined;
  error: Error | null;
  isSubmitting: boolean;
  message: string;
  onClose: () => void;
  onSubmit: () => void;
  pageUrl: string | undefined;
  setMessage: (message: string) => void;
  setType: (type: FeedbackType) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  type: FeedbackType;
  validationError: string | null;
}): JSX.Element {
  return (
    <>
      <FeedbackFormBody
        courseCode={courseCode}
        error={error}
        isSubmitting={isSubmitting}
        message={message}
        pageUrl={pageUrl}
        setMessage={setMessage}
        setType={setType}
        textareaRef={textareaRef}
        type={type}
        validationError={validationError}
      />
      <FeedbackModalFooter
        hasMessage={message.trim().length > 0}
        isSubmitting={isSubmitting}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </>
  );
}
