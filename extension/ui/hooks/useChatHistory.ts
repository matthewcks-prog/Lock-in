/**
 * React hook for managing chat history
 * 
 * Handles loading and managing recent chats.
 * Chrome-agnostic - uses API client interface.
 */

import { useState, useCallback, useEffect } from "react";
import type { ChatSession } from "@core/domain/types";
import type { ApiClient } from "@api/client";

export interface UseChatHistoryOptions {
  apiClient: ApiClient;
  currentChatId?: string | null;
  limit?: number;
}

export interface UseChatHistoryReturn {
  chats: ChatSession[];
  isLoading: boolean;
  error: Error | null;
  loadChats: () => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  createNewChat: () => void;
}

export function useChatHistory(options: UseChatHistoryOptions): UseChatHistoryReturn {
  const { apiClient, limit = 10 } = options;

  const [chats, setChats] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Load recent chats
   */
  const loadChats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const recentChats = await apiClient.getRecentChats({ limit });
      // Transform API response to ChatSession format
      const transformed: ChatSession[] = Array.isArray(recentChats)
        ? recentChats.map((chat: any) => ({
            id: chat.id,
            title: chat.title || undefined,
            createdAt: chat.created_at,
            updatedAt: chat.updated_at,
            lastMessageAt: chat.last_message_at || undefined,
            messageCount: chat.message_count || undefined,
          }))
        : [];
      setChats(transformed);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to load chats");
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, [apiClient, limit]);

  /**
   * Delete a chat
   */
  const deleteChat = useCallback(
    async (chatId: string) => {
      try {
        await apiClient.deleteChat(chatId);
        setChats((prev) => prev.filter((chat) => chat.id !== chatId));
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to delete chat");
        setError(error);
        throw error;
      }
    },
    [apiClient]
  );

  /**
   * Create new chat (clears current chat ID)
   */
  const createNewChat = useCallback(() => {
    // This is handled by the parent component that manages chatId
    // This hook just provides the callback interface
  }, []);

  // Load chats on mount
  useEffect(() => {
    loadChats();
  }, []); // Only load once on mount

  return {
    chats,
    isLoading,
    error,
    loadChats,
    deleteChat,
    createNewChat,
  };
}
