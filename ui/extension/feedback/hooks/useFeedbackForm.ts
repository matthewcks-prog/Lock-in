/**
 * useFeedbackForm Hook
 *
 * Manages feedback form state, validation, and submission.
 * Uses the API client to submit feedback to the backend.
 */

import { useState, useCallback } from 'react';
import type { ApiClient } from '@api/client';
import type { FeedbackType, FeedbackContext } from '@api/resources/feedbackClient';

export interface UseFeedbackFormOptions {
  apiClient: ApiClient | null;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export interface FeedbackFormState {
  type: FeedbackType;
  message: string;
}

export interface UseFeedbackFormResult {
  /** Current form state */
  formState: FeedbackFormState;
  /** Set feedback type */
  setType: (type: FeedbackType) => void;
  /** Set feedback message */
  setMessage: (message: string) => void;
  /** Whether form is currently submitting */
  isSubmitting: boolean;
  /** Submission error (if any) */
  error: Error | null;
  /** Whether form was successfully submitted */
  isSuccess: boolean;
  /** Submit the feedback */
  submit: (context?: FeedbackContext) => Promise<boolean>;
  /** Reset form to initial state */
  reset: () => void;
  /** Validation error message (if any) */
  validationError: string | null;
}

const INITIAL_STATE: FeedbackFormState = {
  type: 'bug',
  message: '',
};

const MAX_MESSAGE_LENGTH = 5000;
const MIN_FEEDBACK_MESSAGE_LENGTH = 10;

function clampMessageLength(message: string): string {
  return message.slice(0, MAX_MESSAGE_LENGTH);
}

function validateFeedbackMessage(message: string): string | null {
  if (message.trim().length === 0) {
    return 'Please describe your feedback';
  }
  if (message.length < MIN_FEEDBACK_MESSAGE_LENGTH) {
    return 'Please provide more details (at least 10 characters)';
  }
  return null;
}

function createFeedbackPayload({
  formState,
  context,
}: {
  formState: FeedbackFormState;
  context: FeedbackContext | undefined;
}): { type: FeedbackType; message: string; context?: FeedbackContext } {
  const payload: { type: FeedbackType; message: string; context?: FeedbackContext } = {
    type: formState.type,
    message: formState.message.trim(),
  };
  if (context !== undefined) {
    payload.context = context;
  }
  return payload;
}

function toFeedbackError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Failed to submit feedback');
}

function useFeedbackFieldSetters({
  setFormState,
  setValidationError,
}: {
  setFormState: React.Dispatch<React.SetStateAction<FeedbackFormState>>;
  setValidationError: React.Dispatch<React.SetStateAction<string | null>>;
}): Pick<UseFeedbackFormResult, 'setType' | 'setMessage'> {
  const setType = useCallback(
    (type: FeedbackType) => {
      setFormState((prev) => ({ ...prev, type }));
      setValidationError(null);
    },
    [setFormState, setValidationError],
  );

  const setMessage = useCallback(
    (message: string) => {
      setFormState((prev) => ({ ...prev, message: clampMessageLength(message) }));
      setValidationError(null);
    },
    [setFormState, setValidationError],
  );

  return { setType, setMessage };
}

function useFeedbackValidation({
  message,
  setValidationError,
}: {
  message: string;
  setValidationError: React.Dispatch<React.SetStateAction<string | null>>;
}): () => boolean {
  return useCallback((): boolean => {
    const validationMessage = validateFeedbackMessage(message);
    setValidationError(validationMessage);
    return validationMessage === null;
  }, [message, setValidationError]);
}

function useFeedbackSubmit({
  apiClient,
  formState,
  onError,
  onSuccess,
  setError,
  setIsSubmitting,
  setIsSuccess,
  validate,
}: {
  apiClient: ApiClient | null;
  formState: FeedbackFormState;
  onError: ((error: Error) => void) | undefined;
  onSuccess: (() => void) | undefined;
  setError: React.Dispatch<React.SetStateAction<Error | null>>;
  setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSuccess: React.Dispatch<React.SetStateAction<boolean>>;
  validate: () => boolean;
}): UseFeedbackFormResult['submit'] {
  return useCallback(
    async (context?: FeedbackContext): Promise<boolean> => {
      if (apiClient === null) {
        setError(new Error('Not authenticated. Please sign in to submit feedback.'));
        return false;
      }
      if (!validate()) return false;

      setIsSubmitting(true);
      setError(null);
      try {
        const payload = createFeedbackPayload({ formState, context });
        await apiClient.submitFeedback(payload);
        setIsSuccess(true);
        onSuccess?.();
        return true;
      } catch (submitError: unknown) {
        const normalizedError = toFeedbackError(submitError);
        setError(normalizedError);
        onError?.(normalizedError);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [apiClient, formState, onError, onSuccess, setError, setIsSubmitting, setIsSuccess, validate],
  );
}

/**
 * Hook for managing feedback form state and submission
 */
export function useFeedbackForm({
  apiClient,
  onSuccess,
  onError,
}: UseFeedbackFormOptions): UseFeedbackFormResult {
  const [formState, setFormState] = useState<FeedbackFormState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { setType, setMessage } = useFeedbackFieldSetters({ setFormState, setValidationError });
  const validate = useFeedbackValidation({
    message: formState.message,
    setValidationError,
  });
  const submit = useFeedbackSubmit({
    apiClient,
    formState,
    onError,
    onSuccess,
    setError,
    setIsSubmitting,
    setIsSuccess,
    validate,
  });

  const reset = useCallback(() => {
    setFormState(INITIAL_STATE);
    setIsSubmitting(false);
    setError(null);
    setIsSuccess(false);
    setValidationError(null);
  }, []);

  return {
    formState,
    setType,
    setMessage,
    isSubmitting,
    error,
    isSuccess,
    submit,
    reset,
    validationError,
  };
}
