import { useEffect } from 'react';
import type { FeedbackContext, FeedbackType } from '@api/resources/feedbackClient';
import { sanitizeUrl } from '@core/utils/urlSanitizer';

type ChromeRuntimeLike = {
  runtime?: { getManifest?: () => { version?: string } };
};

export const FEEDBACK_MODAL_AUTO_CLOSE_DELAY_MS = 2000;
const TEXTAREA_FOCUS_DELAY_MS = 100;

export const FEEDBACK_TYPES: { value: FeedbackType; label: string; description: string }[] = [
  { value: 'bug', label: 'Bug Report', description: 'Something is broken or not working' },
  {
    value: 'feature',
    label: 'Feature Request',
    description: 'Suggest a new feature or improvement',
  },
  { value: 'question', label: 'Question', description: 'Ask a question about using Lock-in' },
  { value: 'other', label: 'Other', description: 'General feedback or comments' },
];

export function getExtensionVersion(): string {
  try {
    const chromeRuntime = (globalThis as typeof globalThis & { chrome?: ChromeRuntimeLike }).chrome;
    const version = chromeRuntime?.runtime?.getManifest?.()?.version;
    return typeof version === 'string' && version.length > 0 ? version : 'unknown';
  } catch {
    return 'unknown';
  }
}

export function getBrowserInfo(): string {
  try {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) {
      const match = ua.match(/Chrome\/(\d+)/);
      return match !== null ? `Chrome ${match[1]}` : 'Chrome';
    }
    if (ua.includes('Firefox')) {
      const match = ua.match(/Firefox\/(\d+)/);
      return match !== null ? `Firefox ${match[1]}` : 'Firefox';
    }
    if (ua.includes('Safari')) {
      const match = ua.match(/Version\/(\d+)/);
      return match !== null ? `Safari ${match[1]}` : 'Safari';
    }
    return 'Unknown browser';
  } catch {
    return 'Unknown browser';
  }
}

export function resolveMessageLabel(type: FeedbackType): string {
  if (type === 'bug') return 'Describe what happened';
  if (type === 'feature') return 'Describe your idea';
  if (type === 'question') return 'What would you like to know?';
  return 'Your feedback';
}

export function resolveMessagePlaceholder(type: FeedbackType): string {
  if (type === 'bug') return 'What were you trying to do? What happened instead?';
  if (type === 'feature') return 'What feature would help you? How would you use it?';
  return 'Type your message here...';
}

export function hasCourseCode(courseCode: string | null | undefined): courseCode is string {
  return courseCode !== null && courseCode !== undefined && courseCode.length > 0;
}

export function buildFeedbackContext({
  pageUrl,
  courseCode,
}: {
  pageUrl: string | undefined;
  courseCode: string | null | undefined;
}): FeedbackContext {
  const context: FeedbackContext = {
    url: sanitizeUrl(pageUrl ?? window.location.href),
    extensionVersion: getExtensionVersion(),
    browser: getBrowserInfo(),
  };
  if (hasCourseCode(courseCode)) context.courseCode = courseCode;
  if (document.title.length > 0) context.page = document.title;
  return context;
}

export function useFocusTextareaOnOpen({
  isOpen,
  textareaRef,
}: {
  isOpen: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}): void {
  useEffect(() => {
    if (!isOpen || textareaRef.current === null) return;
    const timeout = window.setTimeout(() => textareaRef.current?.focus(), TEXTAREA_FOCUS_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [isOpen, textareaRef]);
}

export function useResetFormOnClose({
  isOpen,
  reset,
}: {
  isOpen: boolean;
  reset: () => void;
}): void {
  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);
}

export function useCloseOnEscape({
  isOpen,
  isSubmitting,
  onClose,
}: {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
}): void {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);
}
