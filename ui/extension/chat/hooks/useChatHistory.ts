import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { ChatHistoryItem, UseChatHistoryOptions, HistoryTitleSource } from '../types';
import { coerceChatTitle, clampChatTitle, FALLBACK_CHAT_TITLE } from '../types';
import { buildPages, normalizeHistoryPage, type ChatHistoryPage } from './chatHistoryUtils';
import chatLimits from '@core/config/chatLimits.json';

export const chatHistoryKeys = {
  all: ['chatHistory'] as const,
  recent: (limit: number) => ['chatHistory', 'recent', limit] as const,
};

export function useChatHistory(options: UseChatHistoryOptions) {
  const { apiClient, limit } = options;
  const queryClient = useQueryClient();
  const defaultLimit = Number(chatLimits.DEFAULT_CHAT_LIST_LIMIT) || 20;
  const maxLimit = Number(chatLimits.MAX_CHAT_LIST_LIMIT) || 100;
  const safeLimit =
    typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? limit : defaultLimit;
  const pageSize = Math.min(safeLimit, maxLimit);

  const query = useInfiniteQuery<
    ChatHistoryPage,
    Error,
    InfiniteData<ChatHistoryPage>,
    ReturnType<typeof chatHistoryKeys.recent>,
    string | undefined
  >({
    queryKey: chatHistoryKeys.recent(pageSize),
    queryFn: async ({ pageParam }): Promise<ChatHistoryPage> => {
      if (!apiClient?.getRecentChats) {
        return {
          chats: [],
          pagination: { hasMore: false, nextCursor: null },
        };
      }

      const cursor = typeof pageParam === 'string' && pageParam.length > 0 ? pageParam : null;
      const requestParams: { limit: number; cursor?: string | null } = { limit: pageSize };
      if (cursor) {
        requestParams.cursor = cursor;
      }
      const response = await apiClient.getRecentChats(requestParams);
      return normalizeHistoryPage(response);
    },
    enabled: Boolean(apiClient?.getRecentChats),
    getNextPageParam: (lastPage) =>
      lastPage.pagination?.hasMore && lastPage.pagination.nextCursor
        ? lastPage.pagination.nextCursor
        : undefined,
    initialPageParam: undefined,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnMount: true,
  });

  const recentChats = useMemo(
    () => (query.data?.pages || []).flatMap((page) => page.chats),
    [query.data?.pages],
  );

  const upsertHistory = useCallback(
    (
      item: ChatHistoryItem,
      previousId?: string | null,
      titleSource: HistoryTitleSource = 'local',
    ) => {
      queryClient.setQueryData<InfiniteData<ChatHistoryPage, string | undefined>>(
        chatHistoryKeys.recent(pageSize),
        (prev) => {
          if (!prev) {
            return {
              pages: [
                {
                  chats: [item],
                  pagination: { hasMore: false, nextCursor: null },
                },
              ],
              pageParams: [undefined],
            };
          }

          const flattened = prev.pages.flatMap((page) => page.chats);
          const existing = flattened.find(
            (history) => history.id === item.id || (previousId && history.id === previousId),
          );

          const existingTitle = existing?.title || '';
          const incomingTitle = coerceChatTitle(item.title, existingTitle || FALLBACK_CHAT_TITLE);
          const normalizedExisting = clampChatTitle(existingTitle);
          const hasMeaningfulTitle =
            Boolean(normalizedExisting) && normalizedExisting !== FALLBACK_CHAT_TITLE;
          const shouldOverrideTitle = titleSource === 'server' || !hasMeaningfulTitle;

          const merged: ChatHistoryItem = {
            ...existing,
            ...item,
            title: shouldOverrideTitle ? incomingTitle : existingTitle || FALLBACK_CHAT_TITLE,
          };

          const filtered = flattened.filter(
            (history) => history.id !== item.id && (!previousId || history.id !== previousId),
          );

          const maxItems = Math.min(maxLimit, pageSize * prev.pages.length);
          const nextItems = [merged, ...filtered].slice(0, maxItems);

          return {
            ...prev,
            pages: buildPages(nextItems, pageSize, prev.pages),
          };
        },
      );
    },
    [maxLimit, pageSize, queryClient],
  );

  const removeFromHistory = useCallback(
    (chatId: string) => {
      queryClient.setQueryData<InfiniteData<ChatHistoryPage, string | undefined>>(
        chatHistoryKeys.recent(pageSize),
        (prev) => {
          if (!prev) return prev;
          const flattened = prev.pages.flatMap((page) => page.chats);
          const nextItems = flattened.filter((item) => item.id !== chatId);

          return {
            ...prev,
            pages: buildPages(nextItems, pageSize, prev.pages),
          };
        },
      );
    },
    [pageSize, queryClient],
  );

  const invalidate = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: chatHistoryKeys.all });
  }, [queryClient]);

  return {
    recentChats,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasMore: Boolean(query.hasNextPage),
    loadMore: query.fetchNextPage,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    upsertHistory,
    removeFromHistory,
    invalidate,
  };
}
