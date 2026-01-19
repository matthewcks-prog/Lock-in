/**
 * useChatInput Hook
 *
 * Manages chat input state and textarea behavior.
 * Extracted to keep input logic isolated and reusable.
 */

import { useCallback, useRef, useState, useLayoutEffect } from 'react';

interface UseChatInputOptions {
    /** Called when user submits input (Enter key or send button) */
    onSend?: (value: string) => void;
    /** Whether sending is in progress (disables input) */
    isSending?: boolean;
    /** Whether the input should be focused */
    shouldFocus?: boolean;
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
    const { onSend, isSending = false, shouldFocus = false } = options;
    const [value, setValue] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    /**
     * Sync textarea height to its content.
     * Respects max-height CSS property.
     */
    const syncHeight = useCallback((target?: HTMLTextAreaElement | null) => {
        if (typeof window === 'undefined') return;
        const input = target ?? inputRef.current;
        if (!input) return;

        input.style.height = 'auto';
        const maxHeightValue = window.getComputedStyle(input).maxHeight;
        const maxHeight = maxHeightValue === 'none' ? 0 : Number.parseFloat(maxHeightValue);
        const nextHeight = input.scrollHeight;

        if (!maxHeight || Number.isNaN(maxHeight)) {
            input.style.height = `${nextHeight}px`;
            input.style.overflowY = 'hidden';
            return;
        }

        input.style.height = `${Math.min(nextHeight, maxHeight)}px`;
        input.style.overflowY = nextHeight > maxHeight ? 'auto' : 'hidden';
    }, []);

    /**
     * Handle input change with auto-resize.
     */
    const handleChange = useCallback(
        (event: React.ChangeEvent<HTMLTextAreaElement>) => {
            setValue(event.target.value);
            syncHeight(event.currentTarget);
        },
        [syncHeight],
    );

    /**
     * Handle keyboard events.
     * Enter to send, Shift+Enter for newline.
     */
    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (value.trim() && !isSending) {
                    onSend?.(value.trim());
                    setValue('');
                    // Reset height after clearing
                    requestAnimationFrame(() => syncHeight());
                }
            }
        },
        [value, isSending, onSend, syncHeight],
    );

    /**
     * Trigger send action programmatically.
     */
    const handleSend = useCallback(() => {
        if (!value.trim() || isSending) return;
        onSend?.(value.trim());
        setValue('');
        requestAnimationFrame(() => syncHeight());
    }, [value, isSending, onSend, syncHeight]);

    /**
     * Clear input value.
     */
    const clear = useCallback(() => {
        setValue('');
        requestAnimationFrame(() => syncHeight());
    }, [syncHeight]);

    // Auto-resize on value change
    useLayoutEffect(() => {
        syncHeight();
    }, [value, syncHeight]);

    // Focus management
    useLayoutEffect(() => {
        if (shouldFocus) {
            requestAnimationFrame(() => {
                inputRef.current?.focus();
            });
        }
    }, [shouldFocus]);

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
