import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { ChatHistoryItem, UseChatHistoryOptions, HistoryTitleSource } from '../types';
import { coerceChatTitle, clampChatTitle, FALLBACK_CHAT_TITLE } from '../types';
import { buildPages, normalizeHistoryPage, type ChatHistoryPage } from './chatHistoryUtils';
import chatLimits from '@core/config/chatLimits.json';

const DEFAULT_HISTORY_LIMIT = 20;
const STALE_TIME_MINUTES = 2;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;

export const chatHistoryKeys = {
  all: ['chatHistory'] as const,
  recent: (limit: number) => ['chatHistory', 'recent', limit] as const,
};

type ChatHistoryData = InfiniteData<ChatHistoryPage, string | undefined>;

interface UseChatHistoryResult {
  recentChats: ChatHistoryItem[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasMore: boolean;
  loadMore: () => Promise<unknown>;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
  upsertHistory: (
    item: ChatHistoryItem,
    previousId?: string | null,
    titleSource?: HistoryTitleSource,
  ) => void;
  removeFromHistory: (chatId: string) => void;
  invalidate: () => Promise<void>;
}

function resolveHistoryLimits(limit: number | undefined): { maxLimit: number; pageSize: number } {
  const parsedDefaultLimit = Number(chatLimits.DEFAULT_CHAT_LIST_LIMIT);
  const parsedMaxLimit = Number(chatLimits.MAX_CHAT_LIST_LIMIT);
  const defaultLimit =
    Number.isFinite(parsedDefaultLimit) && parsedDefaultLimit > 0
      ? parsedDefaultLimit
      : DEFAULT_HISTORY_LIMIT;
  const maxLimit = Number.isFinite(parsedMaxLimit) && parsedMaxLimit > 0 ? parsedMaxLimit : 100;
  const safeLimit =
    typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? limit : defaultLimit;
  return {
    maxLimit,
    pageSize: Math.min(safeLimit, maxLimit),
  };
}

function createEmptyHistoryPage(): ChatHistoryPage {
  return {
    chats: [],
    pagination: { hasMore: false, nextCursor: null },
  };
}

function normalizeCursor(pageParam: string | undefined): string | null {
  return typeof pageParam === 'string' && pageParam.length > 0 ? pageParam : null;
}

function flattenHistoryPages(data: ChatHistoryData | undefined): ChatHistoryItem[] {
  return (data?.pages ?? []).flatMap((page) => page.chats);
}

function createInitialHistoryData(item: ChatHistoryItem): ChatHistoryData {
  return {
    pages: [{ chats: [item], pagination: { hasMore: false, nextCursor: null } }],
    pageParams: [undefined],
  };
}

function findExistingHistoryItem(
  flattened: ChatHistoryItem[],
  itemId: string,
  previousId?: string | null,
): ChatHistoryItem | undefined {
  return flattened.find((history) => {
    if (history.id === itemId) return true;
    return previousId !== null && previousId !== undefined && previousId.length > 0
      ? history.id === previousId
      : false;
  });
}

function mergeHistoryItem(
  existing: ChatHistoryItem | undefined,
  incoming: ChatHistoryItem,
  titleSource: HistoryTitleSource,
): ChatHistoryItem {
  const existingTitle = existing?.title ?? '';
  const incomingTitle = coerceChatTitle(
    incoming.title,
    existingTitle.length > 0 ? existingTitle : FALLBACK_CHAT_TITLE,
  );
  const normalizedExisting = clampChatTitle(existingTitle);
  const hasMeaningfulTitle =
    normalizedExisting.length > 0 && normalizedExisting !== FALLBACK_CHAT_TITLE;
  const shouldOverrideTitle = titleSource === 'server' || !hasMeaningfulTitle;

  return {
    ...existing,
    ...incoming,
    title: shouldOverrideTitle || existingTitle.length === 0 ? incomingTitle : existingTitle,
  };
}

function removeReplacedItems(
  flattened: ChatHistoryItem[],
  itemId: string,
  previousId?: string | null,
): ChatHistoryItem[] {
  return flattened.filter((history) => {
    if (history.id === itemId) return false;
    if (previousId === null || previousId === undefined || previousId.length === 0) return true;
    return history.id !== previousId;
  });
}

function upsertHistoryData({
  prev,
  item,
  previousId,
  titleSource,
  pageSize,
  maxLimit,
}: {
  prev: ChatHistoryData | undefined;
  item: ChatHistoryItem;
  previousId: string | null | undefined;
  titleSource: HistoryTitleSource;
  pageSize: number;
  maxLimit: number;
}): ChatHistoryData {
  if (prev === undefined) {
    return createInitialHistoryData(item);
  }

  const flattened = flattenHistoryPages(prev);
  const existing = findExistingHistoryItem(flattened, item.id, previousId);
  const merged = mergeHistoryItem(existing, item, titleSource);
  const filtered = removeReplacedItems(flattened, item.id, previousId);
  const maxItems = Math.min(maxLimit, pageSize * prev.pages.length);
  const nextItems = [merged, ...filtered].slice(0, maxItems);

  return {
    ...prev,
    pages: buildPages(nextItems, pageSize, prev.pages),
  };
}

function removeFromHistoryData({
  prev,
  chatId,
  pageSize,
}: {
  prev: ChatHistoryData | undefined;
  chatId: string;
  pageSize: number;
}): ChatHistoryData | undefined {
  if (prev === undefined) {
    return prev;
  }

  const flattened = flattenHistoryPages(prev);
  const nextItems = flattened.filter((item) => item.id !== chatId);
  return {
    ...prev,
    pages: buildPages(nextItems, pageSize, prev.pages),
  };
}

async function fetchHistoryPage({
  apiClient,
  pageSize,
  pageParam,
}: {
  apiClient: UseChatHistoryOptions['apiClient'];
  pageSize: number;
  pageParam: string | undefined;
}): Promise<ChatHistoryPage> {
  if (apiClient === null || apiClient.getRecentChats === undefined) {
    return createEmptyHistoryPage();
  }

  const cursor = normalizeCursor(pageParam);
  const requestParams: { limit: number; cursor?: string | null } = { limit: pageSize };
  if (cursor !== null && cursor.length > 0) {
    requestParams.cursor = cursor;
  }
  const response = await apiClient.getRecentChats(requestParams);
  return normalizeHistoryPage(response);
}

function getNextHistoryCursor(lastPage: ChatHistoryPage): string | undefined {
  const nextCursor = lastPage.pagination?.nextCursor;
  const hasCursor =
    nextCursor !== null && nextCursor !== undefined && typeof nextCursor === 'string';
  return lastPage.pagination?.hasMore === true && hasCursor && nextCursor.length > 0
    ? nextCursor
    : undefined;
}

function useRecentHistoryQuery(
  apiClient: UseChatHistoryOptions['apiClient'],
  pageSize: number,
): UseInfiniteQueryResult<ChatHistoryData, Error> {
  return useInfiniteQuery<
    ChatHistoryPage,
    Error,
    ChatHistoryData,
    ReturnType<typeof chatHistoryKeys.recent>,
    string | undefined
  >({
    queryKey: chatHistoryKeys.recent(pageSize),
    queryFn: async ({ pageParam }): Promise<ChatHistoryPage> =>
      fetchHistoryPage({ apiClient, pageSize, pageParam }),
    enabled: Boolean(apiClient?.getRecentChats),
    getNextPageParam: getNextHistoryCursor,
    initialPageParam: undefined,
    staleTime: STALE_TIME_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND,
    refetchOnMount: true,
  });
}

function useUpsertHistory({
  maxLimit,
  pageSize,
  queryClient,
}: {
  maxLimit: number;
  pageSize: number;
  queryClient: ReturnType<typeof useQueryClient>;
}): UseChatHistoryResult['upsertHistory'] {
  return useCallback(
    (
      item: ChatHistoryItem,
      previousId?: string | null,
      titleSource: HistoryTitleSource = 'local',
    ) => {
      queryClient.setQueryData<ChatHistoryData>(chatHistoryKeys.recent(pageSize), (prev) =>
        upsertHistoryData({ prev, item, previousId, titleSource, pageSize, maxLimit }),
      );
    },
    [maxLimit, pageSize, queryClient],
  );
}

function useRemoveFromHistory({
  pageSize,
  queryClient,
}: {
  pageSize: number;
  queryClient: ReturnType<typeof useQueryClient>;
}): UseChatHistoryResult['removeFromHistory'] {
  return useCallback(
    (chatId: string) => {
      queryClient.setQueryData<ChatHistoryData>(chatHistoryKeys.recent(pageSize), (prev) =>
        removeFromHistoryData({ prev, chatId, pageSize }),
      );
    },
    [pageSize, queryClient],
  );
}

function useInvalidateHistory(
  queryClient: ReturnType<typeof useQueryClient>,
): UseChatHistoryResult['invalidate'] {
  return useCallback(async () => {
    return queryClient.invalidateQueries({ queryKey: chatHistoryKeys.all });
  }, [queryClient]);
}

export const useChatHistory = (options: UseChatHistoryOptions): UseChatHistoryResult => {
  const { apiClient, limit } = options;
  const queryClient = useQueryClient();
  const { maxLimit, pageSize } = resolveHistoryLimits(limit);
  const query = useRecentHistoryQuery(apiClient, pageSize);

  const recentChats = useMemo(() => flattenHistoryPages(query.data), [query.data]);
  const upsertHistory = useUpsertHistory({ maxLimit, pageSize, queryClient });
  const removeFromHistory = useRemoveFromHistory({ pageSize, queryClient });
  const invalidate = useInvalidateHistory(queryClient);

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
};
