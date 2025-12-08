/**
 * React hook for managing chat state and operations
 * 
 * Handles chat messages, loading states, and API calls.
 * Chrome-agnostic - uses API client interface.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatMessage, StudyMode, ApiResponse, StudyResponse } from "@core/domain/types";
import type { ApiClient } from "@api/client";

export interface UseChatOptions {
  apiClient: ApiClient;
  chatId?: string | null;
  onChatIdChange?: (chatId: string | null) => void;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: Error | null;
  sendMessage: (text: string, mode: StudyMode, selection?: string) => Promise<void>;
  clearMessages: () => void;
  loadChatHistory: (chatId: string) => Promise<void>;
}

export function useChat(options: UseChatOptions): UseChatReturn {
  const { apiClient, chatId, onChatIdChange } = options;
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const pendingInputRef = useRef("");

  /**
   * Send a message to the API
   */
  const sendMessage = useCallback(
    async (text: string, mode: StudyMode, selection?: string) => {
      if (!text.trim() || isLoading) return;

      setIsLoading(true);
      setError(null);
      pendingInputRef.current = text;

      // Add user message to UI immediately
      const userMessage: ChatMessage = {
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const response: ApiResponse<StudyResponse> = await apiClient.processText({
          selection: selection || "",
          mode,
          chatHistory: messages,
          newUserMessage: text,
          chatId: chatId || undefined,
          pageUrl: window.location.href,
        });

        if (response.success && response.data) {
          // Add assistant response
          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: response.data.explanation,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, assistantMessage]);

          // Update chat ID if new chat was created
          if (response.chatId && response.chatId !== chatId) {
            onChatIdChange?.(response.chatId);
          }
        } else {
          throw new Error(response.error?.message || "Failed to process message");
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        // Remove user message on error
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
        pendingInputRef.current = "";
      }
    },
    [apiClient, messages, chatId, isLoading, onChatIdChange]
  );

  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  /**
   * Load chat history from API
   */
  const loadChatHistory = useCallback(
    async (targetChatId: string) => {
      if (!targetChatId) return;

      setIsLoading(true);
      setError(null);

      try {
        const chatMessages = await apiClient.getChatMessages(targetChatId);
        // Transform API messages to ChatMessage format
        const transformed: ChatMessage[] = chatMessages.map((msg: any) => ({
          role: msg.role as ChatMessage["role"],
          content: msg.input_text || msg.output_text || "",
          timestamp: msg.created_at,
          messageId: msg.id,
        }));
        setMessages(transformed);
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to load chat history");
        setError(error);
      } finally {
        setIsLoading(false);
      }
    },
    [apiClient]
  );

  // Load chat history when chatId changes
  useEffect(() => {
    if (chatId) {
      loadChatHistory(chatId);
    } else {
      clearMessages();
    }
  }, [chatId]); // Only depend on chatId, not loadChatHistory/clearMessages

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    loadChatHistory,
  };
}
