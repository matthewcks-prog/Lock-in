/**
 * useChatInput Hook
 *
 * Manages chat input state and textarea behavior.
 * Extracted to keep input logic isolated and reusable.
 */

import { useCallback, useRef, useState, useLayoutEffect } from 'react';

interface UseChatInputOptions {
  /** Called when user submits input (Enter key or send button) */
  onSend?: (value: string) => boolean | void | Promise<boolean | void>;
  /** Whether sending is in progress (disables input) */
  isSending?: boolean;
  /** Whether the input should be focused */
  shouldFocus?: boolean;
  /** Whether sending is allowed even with empty input */
  canSend?: boolean;
}

interface UseChatInputReturn {
  /** Current input value */
  value: string;
  /** Set input value */
  setValue: (value: string) => void;
  /** Clear input */
  clear: () => void;
  /** Ref for textarea element */
  inputRef: React.RefObject<HTMLTextAreaElement>;
  /** Handle input change with auto-resize */
  handleChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  /** Handle keyboard events */
  handleKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Trigger send action */
  handleSend: () => void;
  /** Sync textarea height to content */
  syncHeight: (target?: HTMLTextAreaElement | null) => void;
}

interface UseChatInputHandlersReturn {
  handleChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handleSend: () => void;
  clear: () => void;
}

function useSendTrigger({
  value,
  canSend,
  isSending,
  onSend,
  syncHeight,
  setValue,
}: {
  value: string;
  canSend: boolean;
  isSending: boolean;
  onSend: ((value: string) => boolean | void | Promise<boolean | void>) | undefined;
  syncHeight: (target?: HTMLTextAreaElement | null) => void;
  setValue: (value: string) => void;
}): () => Promise<void> {
  return useCallback(async () => {
    const trimmed = value.trim();
    const shouldSend = trimmed.length > 0 || canSend;
    if (!shouldSend || isSending) return;
    try {
      const shouldClear = await onSend?.(trimmed);
      if (shouldClear === false) return;
      setValue('');
      requestAnimationFrame(() => syncHeight());
    } catch {
      // Swallow errors so the UI stays responsive
    }
  }, [value, isSending, canSend, onSend, syncHeight, setValue]);
}

function useInputLayoutEffects({
  value,
  syncHeight,
  shouldFocus,
  inputRef,
}: {
  value: string;
  syncHeight: (target?: HTMLTextAreaElement | null) => void;
  shouldFocus: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement>;
}): void {
  useLayoutEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  useLayoutEffect(() => {
    if (!shouldFocus) return;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [shouldFocus, inputRef]);
}

function useChatInputHandlers({
  setValue,
  syncHeight,
  triggerSend,
}: {
  setValue: (value: string) => void;
  syncHeight: (target?: HTMLTextAreaElement | null) => void;
  triggerSend: () => Promise<void>;
}): UseChatInputHandlersReturn {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(event.target.value);
      syncHeight(event.currentTarget);
    },
    [setValue, syncHeight],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void triggerSend();
      }
    },
    [triggerSend],
  );

  const handleSend = useCallback(() => {
    void triggerSend();
  }, [triggerSend]);

  const clear = useCallback(() => {
    setValue('');
    requestAnimationFrame(() => syncHeight());
  }, [setValue, syncHeight]);

  return { handleChange, handleKeyDown, handleSend, clear };
}

/**
 * Hook for managing chat input state and behavior.
 *
 * Features:
 * - Auto-resize textarea to content
 * - Enter to send (Shift+Enter for newline)
 * - Clear on send
 * - Focus management
 */
export function useChatInput(options: UseChatInputOptions = {}): UseChatInputReturn {
  const { onSend, isSending = false, shouldFocus = false, canSend = false } = options;
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Sync textarea height to its content.
   * Respects max-height CSS property.
   */
  const syncHeight = useCallback((target?: HTMLTextAreaElement | null) => {
    if (typeof window === 'undefined') return;
    const input = target ?? inputRef.current;
    if (input === null) return;

    input.style.height = 'auto';
    const maxHeightValue = window.getComputedStyle(input).maxHeight;
    const maxHeight = maxHeightValue === 'none' ? 0 : Number.parseFloat(maxHeightValue);
    const nextHeight = input.scrollHeight;

    if (maxHeight <= 0 || Number.isNaN(maxHeight)) {
      input.style.height = `${nextHeight}px`;
      input.style.overflowY = 'hidden';
      return;
    }

    input.style.height = `${Math.min(nextHeight, maxHeight)}px`;
    input.style.overflowY = nextHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  const triggerSend = useSendTrigger({
    value,
    canSend,
    isSending,
    onSend,
    syncHeight,
    setValue,
  });

  const { handleChange, handleKeyDown, handleSend, clear } = useChatInputHandlers({
    setValue,
    syncHeight,
    triggerSend,
  });

  useInputLayoutEffects({ value, syncHeight, shouldFocus, inputRef });

  return {
    value,
    setValue,
    clear,
    inputRef,
    handleChange,
    handleKeyDown,
    handleSend,
    syncHeight,
  };
}
