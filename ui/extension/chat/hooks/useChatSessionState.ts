import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { UseChatOptions } from '../types';
import { ACTIVE_CHAT_ID_KEY, buildInitialChatTitle, isValidUUID } from '../types';

interface ChatSessionStateOptions {
  apiClient: UseChatOptions['apiClient'];
  storage?: UseChatOptions['storage'];
}

interface UseChatSessionStateReturn {
  activeChatId: string | null;
  setActiveChatId: Dispatch<SetStateAction<string | null>>;
  activeHistoryId: string | null;
  setActiveHistoryId: Dispatch<SetStateAction<string | null>>;
  isHistoryOpen: boolean;
  setIsHistoryOpen: Dispatch<SetStateAction<boolean>>;
  error: Error | null;
  setError: Dispatch<SetStateAction<Error | null>>;
  clearError: () => void;
  activeChatIdRef: MutableRefObject<string | null>;
  activeHistoryIdRef: MutableRefObject<string | null>;
  ensureChatId: (initialMessage?: string) => Promise<string | null>;
}

function useSyncedRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef<T>(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

function useRestoreSessionFromStorage({
  storage,
  setActiveChatId,
  setActiveHistoryId,
}: {
  storage: ChatSessionStateOptions['storage'];
  setActiveChatId: Dispatch<SetStateAction<string | null>>;
  setActiveHistoryId: Dispatch<SetStateAction<string | null>>;
}): void {
  useEffect(() => {
    if (storage === undefined) return;

    storage
      .get<string>(ACTIVE_CHAT_ID_KEY)
      .then((storedChatId) => {
        if (typeof storedChatId === 'string' && isValidUUID(storedChatId)) {
          setActiveChatId(storedChatId);
          setActiveHistoryId(storedChatId);
        }
      })
      .catch(() => {
        // Ignore storage errors
      });
  }, [setActiveChatId, setActiveHistoryId, storage]);
}

function usePersistActiveChatId({
  storage,
  activeChatId,
}: {
  storage: ChatSessionStateOptions['storage'];
  activeChatId: string | null;
}): void {
  useEffect(() => {
    if (storage === undefined) return;
    if (activeChatId !== null && activeChatId.length > 0 && isValidUUID(activeChatId)) {
      storage.set(ACTIVE_CHAT_ID_KEY, activeChatId).catch(() => {
        /* ignore */
      });
    }
  }, [activeChatId, storage]);
}

function useEnsureChatId({
  apiClient,
  activeChatIdRef,
  setActiveChatId,
  setActiveHistoryId,
}: {
  apiClient: ChatSessionStateOptions['apiClient'];
  activeChatIdRef: MutableRefObject<string | null>;
  setActiveChatId: Dispatch<SetStateAction<string | null>>;
  setActiveHistoryId: Dispatch<SetStateAction<string | null>>;
}): UseChatSessionStateReturn['ensureChatId'] {
  return useCallback(
    async (initialMessage?: string): Promise<string | null> => {
      const existingChatId = activeChatIdRef.current;
      if (existingChatId !== null && existingChatId.length > 0 && isValidUUID(existingChatId)) {
        return existingChatId;
      }
      if (apiClient?.createChat === undefined) {
        throw new Error('Chat session is not available');
      }

      const fallbackTitle = buildInitialChatTitle(initialMessage ?? '');
      const chat = await apiClient.createChat({ title: fallbackTitle });
      const chatId =
        typeof chat === 'object' && chat !== null && typeof chat['id'] === 'string'
          ? chat['id']
          : null;
      if (chatId === null || chatId.length === 0) {
        throw new Error('Failed to create chat session');
      }
      setActiveChatId(chatId);
      setActiveHistoryId(chatId);
      return chatId;
    },
    [activeChatIdRef, apiClient, setActiveChatId, setActiveHistoryId],
  );
}

export function useChatSessionState({
  apiClient,
  storage,
}: ChatSessionStateOptions): UseChatSessionStateReturn {
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const activeChatIdRef = useSyncedRef<string | null>(activeChatId);
  const activeHistoryIdRef = useSyncedRef<string | null>(activeHistoryId);

  useRestoreSessionFromStorage({ storage, setActiveChatId, setActiveHistoryId });
  usePersistActiveChatId({ storage, activeChatId });
  const ensureChatId = useEnsureChatId({
    apiClient,
    activeChatIdRef,
    setActiveChatId,
    setActiveHistoryId,
  });
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
