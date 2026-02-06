import { useCallback, useEffect, useRef, useState } from 'react';
import type { UseChatOptions } from '../types';
import { ACTIVE_CHAT_ID_KEY, buildInitialChatTitle, isValidUUID } from '../types';

interface ChatSessionStateOptions {
  apiClient: UseChatOptions['apiClient'];
  storage?: UseChatOptions['storage'];
}

export function useChatSessionState({ apiClient, storage }: ChatSessionStateOptions) {
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const activeChatIdRef = useRef<string | null>(null);
  const activeHistoryIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    activeHistoryIdRef.current = activeHistoryId;
  }, [activeHistoryId]);

  useEffect(() => {
    if (!storage) return;

    storage
      .get<string>(ACTIVE_CHAT_ID_KEY)
      .then(async (storedChatId) => {
        if (typeof storedChatId === 'string' && isValidUUID(storedChatId)) {
          setActiveChatId(storedChatId);
          setActiveHistoryId(storedChatId);
        }
      })
      .catch(() => {
        // Ignore storage errors
      });
  }, [storage]);

  useEffect(() => {
    if (!storage) return;
    if (activeChatId && isValidUUID(activeChatId)) {
      storage.set(ACTIVE_CHAT_ID_KEY, activeChatId).catch(() => {
        /* ignore */
      });
    }
  }, [activeChatId, storage]);

  const ensureChatId = useCallback(
    async (initialMessage?: string): Promise<string | null> => {
      const existingChatId = activeChatIdRef.current;
      if (existingChatId && isValidUUID(existingChatId)) {
        return existingChatId;
      }
      if (!apiClient?.createChat) {
        throw new Error('Chat session is not available');
      }

      const fallbackTitle = buildInitialChatTitle(initialMessage || '');
      const chat = await apiClient.createChat({ title: fallbackTitle });
      const chatId = typeof chat?.['id'] === 'string' ? chat['id'] : null;
      if (!chatId) {
        throw new Error('Failed to create chat session');
      }

      setActiveChatId(chatId);
      setActiveHistoryId(chatId);

      return chatId;
    },
    [apiClient],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    activeChatId,
    setActiveChatId,
    activeHistoryId,
    setActiveHistoryId,
    isHistoryOpen,
    setIsHistoryOpen,
    error,
    setError,
    clearError,
    activeChatIdRef,
    activeHistoryIdRef,
    ensureChatId,
  };
}
