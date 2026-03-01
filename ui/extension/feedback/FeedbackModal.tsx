import { useCallback, useRef } from 'react';
import type { ApiClient } from '@api/client';
import { useFeedbackForm } from './hooks/useFeedbackForm';
import {
  FeedbackFormContent,
  FeedbackModalHeader,
  FeedbackSuccessState,
} from './FeedbackModalContent';
import {
  buildFeedbackContext,
  FEEDBACK_MODAL_AUTO_CLOSE_DELAY_MS,
  useCloseOnEscape,
  useFocusTextareaOnOpen,
  useResetFormOnClose,
} from './feedbackModalUtils';

export interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiClient: ApiClient | null;
  pageUrl?: string;
  courseCode?: string | null;
}

interface FeedbackModalRuntime {
  error: Error | null;
  formState: ReturnType<typeof useFeedbackForm>['formState'];
  handleBackdropClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleSubmit: () => Promise<void>;
  isSubmitting: boolean;
  isSuccess: boolean;
  setMessage: (message: string) => void;
  setType: ReturnType<typeof useFeedbackForm>['setType'];
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  validationError: string | null;
}

function useFeedbackModalHandlers({
  courseCode,
  isSubmitting,
  onClose,
  pageUrl,
  submit,
}: {
  courseCode: string | null | undefined;
  isSubmitting: boolean;
  onClose: () => void;
  pageUrl: string | undefined;
  submit: ReturnType<typeof useFeedbackForm>['submit'];
}): Pick<FeedbackModalRuntime, 'handleBackdropClick' | 'handleSubmit'> {
  const handleSubmit = useCallback(async () => {
    const context = buildFeedbackContext({ pageUrl, courseCode });
    await submit(context);
  }, [courseCode, pageUrl, submit]);
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget && !isSubmitting) onClose();
    },
    [isSubmitting, onClose],
  );
  return { handleBackdropClick, handleSubmit };
}

function useFeedbackModalRuntime({
  isOpen,
  onClose,
  apiClient,
  pageUrl,
  courseCode,
}: FeedbackModalProps): FeedbackModalRuntime {
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
      window.setTimeout(() => {
        onClose();
        reset();
      }, FEEDBACK_MODAL_AUTO_CLOSE_DELAY_MS);
    },
  });

  useFocusTextareaOnOpen({ isOpen, textareaRef });
  useResetFormOnClose({ isOpen, reset });
  useCloseOnEscape({ isOpen, isSubmitting, onClose });
  const handlers = useFeedbackModalHandlers({
    courseCode,
    isSubmitting,
    onClose,
    pageUrl,
    submit,
  });

  return {
    error,
    formState,
    handleBackdropClick: handlers.handleBackdropClick,
    handleSubmit: handlers.handleSubmit,
    isSubmitting,
    isSuccess,
    setMessage,
    setType,
    textareaRef,
    validationError,
  };
}

export function FeedbackModal(props: FeedbackModalProps): JSX.Element | null {
  const runtime = useFeedbackModalRuntime(props);
  const { isOpen, onClose, pageUrl, courseCode } = props;

  if (!isOpen) return null;
  return (
    <div className="lockin-feedback-backdrop" onClick={runtime.handleBackdropClick}>
      <div
        className="lockin-feedback-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
      >
        <FeedbackModalHeader onClose={onClose} isSubmitting={runtime.isSubmitting} />
        {runtime.isSuccess ? (
          <FeedbackSuccessState />
        ) : (
          <FeedbackFormContent
            courseCode={courseCode}
            error={runtime.error}
            isSubmitting={runtime.isSubmitting}
            message={runtime.formState.message}
            onClose={onClose}
            onSubmit={() => {
              void runtime.handleSubmit();
            }}
            pageUrl={pageUrl}
            setMessage={runtime.setMessage}
            setType={runtime.setType}
            textareaRef={runtime.textareaRef}
            type={runtime.formState.type}
            validationError={runtime.validationError}
          />
        )}
      </div>
    </div>
  );
}
