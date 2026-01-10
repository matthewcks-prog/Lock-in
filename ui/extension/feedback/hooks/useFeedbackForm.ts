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

  const setType = useCallback((type: FeedbackType) => {
    setFormState((prev) => ({ ...prev, type }));
    setValidationError(null);
  }, []);

  const setMessage = useCallback((message: string) => {
    // Enforce max length
    const trimmed = message.slice(0, MAX_MESSAGE_LENGTH);
    setFormState((prev) => ({ ...prev, message: trimmed }));
    setValidationError(null);
  }, []);

  const validate = useCallback((): boolean => {
    if (!formState.message.trim()) {
      setValidationError('Please describe your feedback');
      return false;
    }
    if (formState.message.length < 10) {
      setValidationError('Please provide more details (at least 10 characters)');
      return false;
    }
    setValidationError(null);
    return true;
  }, [formState.message]);

  const submit = useCallback(
    async (context?: FeedbackContext): Promise<boolean> => {
      if (!apiClient) {
        setError(new Error('Not authenticated. Please sign in to submit feedback.'));
        return false;
      }

      if (!validate()) {
        return false;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        await apiClient.submitFeedback({
          type: formState.type,
          message: formState.message.trim(),
          context,
        });

        setIsSuccess(true);
        onSuccess?.();
        return true;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to submit feedback');
        setError(error);
        onError?.(error);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [apiClient, formState, validate, onSuccess, onError],
  );

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
