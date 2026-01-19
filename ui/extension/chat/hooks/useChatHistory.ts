/**
 * useChatHistory Hook
 *
 * TanStack Query-based hook for fetching and managing chat history.
 * Provides cached list of recent chats with optimistic updates.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { ChatHistoryItem, UseChatHistoryOptions, HistoryTitleSource } from '../types';
import { coerceChatTitle, clampChatTitle, FALLBACK_CHAT_TITLE } from '../types';

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
    const { apiClient, limit = 8 } = options;
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: chatHistoryKeys.recent(limit),
        queryFn: async (): Promise<ChatHistoryItem[]> => {
            if (!apiClient?.getRecentChats) {
                return [];
            }

            const response = await apiClient.getRecentChats({ limit });
            return normalizeHistory(response);
        },
        enabled: Boolean(apiClient?.getRecentChats),
        staleTime: 2 * 60 * 1000, // 2 minutes
        refetchOnMount: true,
    });

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
            queryClient.setQueryData<ChatHistoryItem[]>(chatHistoryKeys.recent(limit), (prev = []) => {
                const existing = prev.find(
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

                const filtered = prev.filter(
                    (history) => history.id !== item.id && (!previousId || history.id !== previousId),
                );

                return [merged, ...filtered].slice(0, 12);
            });
        },
        [limit, queryClient],
    );

    /**
     * Remove a chat from history.
     */
    const removeFromHistory = useCallback(
        (chatId: string) => {
            queryClient.setQueryData<ChatHistoryItem[]>(chatHistoryKeys.recent(limit), (prev = []) =>
                prev.filter((item) => item.id !== chatId),
            );
        },
        [limit, queryClient],
    );

    /**
     * Invalidate and refetch history.
     */
    const invalidate = useCallback(() => {
        return queryClient.invalidateQueries({ queryKey: chatHistoryKeys.all });
    }, [queryClient]);

    return {
        recentChats: query.data ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch,
        upsertHistory,
        removeFromHistory,
        invalidate,
    };
}
