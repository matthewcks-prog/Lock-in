/**
 * MessageEditor Component
 *
 * Inline editor for user messages. Replaces the message content
 * with a textarea and Cancel/Send buttons when in edit mode.
 *
 * Follows ChatGPT/Claude edit UX patterns:
 * - Pre-filled with current message content
 * - Cancel restores original, Send submits the edit
 * - Auto-focuses and auto-resizes
 */

import { memo, useCallback, useEffect, useRef } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';

export interface MessageEditorProps {
  /** Current draft content */
  draft: string;
  /** Update draft content */
  onDraftChange: (content: string) => void;
  /** Submit the edit */
  onSubmit: () => void;
  /** Cancel the edit */
  onCancel: () => void;
  /** Whether submission is in progress */
  isSubmitting?: boolean;
}

/** Focus textarea and place cursor at end */
function focusAtEnd(textarea: HTMLTextAreaElement): void {
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

/** Resize textarea to fit content */
function resizeToContent(textarea: HTMLTextAreaElement): void {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function useEditorAutoFocus(ref: React.RefObject<HTMLTextAreaElement | null>): void {
  useEffect(() => {
    const textarea = ref.current;
    if (textarea !== null) {
      focusAtEnd(textarea);
    }
  }, [ref]);
}

function useEditorAutoResize(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  draft: string,
): void {
  useEffect(() => {
    const textarea = ref.current;
    if (textarea !== null) {
      resizeToContent(textarea);
    }
  }, [draft, ref]);
}

function useEditorChangeHandler(
  onDraftChange: (content: string) => void,
): (event: ChangeEvent<HTMLTextAreaElement>) => void {
  return useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      onDraftChange(event.target.value);
    },
    [onDraftChange],
  );
}

function useEditorKeyDownHandler(
  onSubmit: () => void,
  onCancel: () => void,
): (event: KeyboardEvent<HTMLTextAreaElement>) => void {
  return useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        onSubmit();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    },
    [onSubmit, onCancel],
  );
}

function MessageEditorActions({
  isSubmitting,
  canSubmit,
  onCancel,
  onSubmit,
}: {
  isSubmitting: boolean;
  canSubmit: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}): JSX.Element {
  return (
    <div className="lockin-msg-editor-actions">
      <button
        type="button"
        className="lockin-msg-editor-cancel"
        onClick={onCancel}
        disabled={isSubmitting}
      >
        Cancel
      </button>
      <button
        type="button"
        className="lockin-msg-editor-submit"
        onClick={onSubmit}
        disabled={!canSubmit}
      >
        {isSubmitting ? 'Saving...' : 'Send'}
      </button>
    </div>
  );
}

export const MessageEditor = memo(function MessageEditor({
  draft,
  onDraftChange,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: MessageEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEditorAutoFocus(textareaRef);
  useEditorAutoResize(textareaRef, draft);
  const handleChange = useEditorChangeHandler(onDraftChange);
  const handleKeyDown = useEditorKeyDownHandler(onSubmit, onCancel);

  const canSubmit = draft.trim().length > 0 && !isSubmitting;

  return (
    <div className="lockin-msg-editor">
      <textarea
        ref={textareaRef}
        className="lockin-msg-editor-textarea"
        value={draft}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={isSubmitting}
        aria-label="Edit message"
        rows={1}
      />
      <MessageEditorActions
        isSubmitting={isSubmitting}
        canSubmit={canSubmit}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </div>
  );
});
