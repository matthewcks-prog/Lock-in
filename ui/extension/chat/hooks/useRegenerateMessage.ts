/**
 * useRegenerateMessage Hook
 *
 * Handles regenerating the last assistant response.
 * Flow:
 * 1. Call backend to truncate the last assistant message
 * 2. Update local cache with canonical timeline
 * 3. Trigger a new streaming request to regenerate
 */

import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '@api/client';
import type { ChatMessage } from '../types';
import { normalizeChatMessage } from '../types';
import { chatMessagesKeys } from './useChatMessages';

export interface UseRegenerateMessageOptions {
  apiClient: ApiClient | null;
  chatId: string | null;
  /** Cancel any active stream before regenerating */
  cancelStream?: () => void;
  /** Trigger a new streaming send after truncation */
  onRegenerateReady?: (canonicalMessages: ChatMessage[]) => void;
}

export interface UseRegenerateMessageReturn {
  /** Whether a regeneration request is in progress */
  isRegenerating: boolean;
  /** Trigger regeneration of the last assistant message */
  regenerate: () => Promise<boolean>;
}

/**
 * Hook for regenerating the last assistant response.
 */
export function useRegenerateMessage(
  options: UseRegenerateMessageOptions,
): UseRegenerateMessageReturn {
  const { apiClient, chatId, cancelStream, onRegenerateReady } = options;
  const queryClient = useQueryClient();
  const [isRegenerating, setIsRegenerating] = useState(false);

  const regenerate = useCallback(async (): Promise<boolean> => {
    if (!apiClient?.regenerateMessage || !chatId) {
      return false;
    }

    // Auto-cancel any active stream
    cancelStream?.();

    setIsRegenerating(true);

    try {
      const result = await apiClient.regenerateMessage(chatId);

      // Update the query cache with the truncated canonical timeline
      const normalizedMessages = result.canonicalMessages.map((msg: Record<string, unknown>) =>
        normalizeChatMessage(msg),
      );

      queryClient.setQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId), normalizedMessages);

      // Notify the caller that it's time to send a new streaming request
      onRegenerateReady?.(normalizedMessages);

      return true;
    } catch (error) {
      console.error('[useRegenerateMessage] Failed to regenerate:', error);
      return false;
    } finally {
      setIsRegenerating(false);
    }
  }, [apiClient, chatId, cancelStream, queryClient, onRegenerateReady]);

  return {
    isRegenerating,
    regenerate,
  };
}
