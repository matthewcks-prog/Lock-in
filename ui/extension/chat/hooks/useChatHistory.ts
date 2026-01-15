/**
 * useChatHistory Hook
 *
 * TanStack Query-based hook for fetching and managing chat history.
 * Provides cached list of recent chats with optimistic updates.
 */

import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { ChatHistoryItem, UseChatHistoryOptions, HistoryTitleSource } from '../types';
import { coerceChatTitle, clampChatTitle, FALLBACK_CHAT_TITLE } from '../types';
import chatLimits from '@core/config/chatLimits.json';

type ChatHistoryPage = {
    chats: ChatHistoryItem[];
    pagination: {
        hasMore: boolean;
        nextCursor?: string | null;
    };
};

/**
 * Normalizes API response to ChatHistoryItem array.
 */
function normalizeHistory(response: any[]): ChatHistoryItem[] {
    if (!Array.isArray(response)) return [];

    return response.map((item: any) => ({
        id: item.id || `chat-${Math.random().toString(16).slice(2)}`,
        title: coerceChatTitle(item.title, FALLBACK_CHAT_TITLE),
        updatedAt: item.updated_at || item.updatedAt || new Date().toISOString(),
        lastMessage: item.lastMessage || '',
    }));
}

function normalizeHistoryPage(response: any): ChatHistoryPage {
    if (Array.isArray(response)) {
        return {
            chats: normalizeHistory(response),
            pagination: { hasMore: false, nextCursor: null },
        };
    }

    const pagination = response?.pagination || {};
    return {
        chats: normalizeHistory(response?.chats || []),
        pagination: {
            hasMore: Boolean(pagination?.hasMore),
            nextCursor: typeof pagination?.nextCursor === 'string' ? pagination.nextCursor : null,
        },
    };
}

function buildPages(
    items: ChatHistoryItem[],
    pageSize: number,
    existingPages: ChatHistoryPage[] = [],
): ChatHistoryPage[] {
    const pageCount = Math.max(existingPages.length, 1);
    const pages: ChatHistoryPage[] = [];

    for (let index = 0; index < pageCount; index += 1) {
        const start = index * pageSize;
        const chats = items.slice(start, start + pageSize);
        const existingPagination = existingPages[index]?.pagination || {
            hasMore: false,
            nextCursor: null,
        };
        pages.push({ chats, pagination: existingPagination });
    }

    return pages;
}

/**
 * Query key factory for chat history.
 */
export const chatHistoryKeys = {
    all: ['chatHistory'] as const,
    recent: (limit: number) => ['chatHistory', 'recent', limit] as const,
};

/**
 * Hook for fetching chat history with TanStack Query.
 *
 * Features:
 * - Automatic caching and background refetch
 * - Optimistic updates for new/updated chats
 * - Request deduplication
 */
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

            const cursor =
                typeof pageParam === 'string' && pageParam.length > 0 ? pageParam : undefined;
            const response = await apiClient.getRecentChats({ limit: pageSize, cursor });
            return normalizeHistoryPage(response);
        },
        enabled: Boolean(apiClient?.getRecentChats),
        getNextPageParam: (lastPage) =>
            lastPage.pagination?.hasMore ? lastPage.pagination.nextCursor ?? undefined : undefined,
        initialPageParam: undefined,
        staleTime: 2 * 60 * 1000, // 2 minutes
        refetchOnMount: true,
    });

    const recentChats = useMemo(
        () => (query.data?.pages || []).flatMap((page) => page.chats),
        [query.data?.pages],
    );

    /**
     * Upsert a chat in the history list.
     * Moves existing chat to top or adds new one.
     * Handles title merging based on source (local vs server).
     */
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

    /**
     * Remove a chat from history.
     */
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

    /**
     * Invalidate and refetch history.
     */
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
