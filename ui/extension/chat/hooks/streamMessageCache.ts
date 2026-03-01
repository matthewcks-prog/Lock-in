/**
 * Stream Message Cache Helpers
 *
 * Utilities for updating the TanStack Query cache during
 * and after SSE streaming of assistant messages.
 */

import type { QueryClient } from '@tanstack/react-query';
import type { ChatMessage } from '../types';
import { chatMessagesKeys } from './useChatMessages';

/**
 * Finalize streaming assistant message in query cache.
 * Sets isStreaming: false, isPending: false, and ensures final content.
 */
export function finalizeStreamMessage(
  queryClient: QueryClient,
  chatId: string,
  content: string,
): void {
  queryClient.setQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId), (oldMessages) => {
    if (oldMessages === undefined || oldMessages === null) return oldMessages;
    return oldMessages.map((msg) =>
      msg.role === 'assistant' && (msg.isPending === true || msg.isStreaming === true)
        ? { ...msg, content, isPending: false, isStreaming: false }
        : msg,
    );
  });
}

/**
 * Update optimistic assistant message in query cache.
 *
 * Transitions the message from pending (thinking) to streaming
 * (content arriving):
 * - isPending: false -- UI stops showing ThinkingIndicator
 * - isStreaming: true -- UI knows tokens are still arriving
 */
export function updateOptimisticMessage(
  queryClient: QueryClient,
  chatId: string,
  content: string,
): void {
  queryClient.setQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId), (oldMessages) => {
    if (oldMessages === undefined || oldMessages === null) return oldMessages;

    return oldMessages.map((msg) =>
      msg.role === 'assistant' && (msg.isPending === true || msg.isStreaming === true)
        ? { ...msg, content, isPending: false, isStreaming: true }
        : msg,
    );
  });
}
