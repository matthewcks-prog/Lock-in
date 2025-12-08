/**
 * Chat History Panel Component
 *
 * Displays list of recent chats.
 * Uses useChatHistory hook for state management.
 */

import React from "react";
import { useChatHistory } from "../hooks/useChatHistory";
import type { ApiClient } from "@api/client";
import { formatTimestamp } from "@core/utils/textUtils";
import { buildFallbackChatTitle } from "@core/utils/textUtils";

export interface ChatHistoryPanelProps {
  apiClient: ApiClient;
  currentChatId?: string | null;
  onChatSelect?: (chatId: string | null) => void;
  onNewChat?: () => void;
}

export function ChatHistoryPanel({
  apiClient,
  currentChatId,
  onChatSelect,
  onNewChat,
}: ChatHistoryPanelProps) {
  const { chats, isLoading, error, deleteChat } = useChatHistory({
    apiClient,
    currentChatId,
  });

  const handleChatSelect = (chatId: string) => {
    onChatSelect?.(chatId);
  };

  const handleChatDelete = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (confirm("Delete this chat?")) {
      try {
        await deleteChat(chatId);
        if (currentChatId === chatId) {
          onChatSelect?.(null); // Clear current chat if deleted
        }
      } catch (err) {
        console.error("Failed to delete chat:", err);
      }
    }
  };

  return (
    <div className="lockin-history-panel">
      <div className="lockin-history-actions">
        <span className="lockin-history-label">Chats</span>
        <button className="lockin-new-chat-btn" onClick={onNewChat}>
          + New Chat
        </button>
      </div>
      <div className="lockin-history-list">
        {isLoading && <p className="lockin-history-empty">Loading chats...</p>}
        {error && (
          <p className="lockin-history-empty">
            Failed to load chats. Please try again.
          </p>
        )}
        {!isLoading && !error && chats.length === 0 && (
          <p className="lockin-history-empty">No chats yet.</p>
        )}
        {chats.map((chat) => {
          const isActive = chat.id === currentChatId;
          return (
            <div
              key={chat.id}
              className={`lockin-history-item ${isActive ? "active" : ""}`}
              onClick={() => handleChatSelect(chat.id)}
            >
              <div className="lockin-history-item-content">
                <span className="lockin-history-title">
                  {chat.title || buildFallbackChatTitle(chat.id)}
                </span>
                <span className="lockin-history-meta">
                  {formatTimestamp(chat.lastMessageAt || chat.createdAt)}
                </span>
              </div>
              <button
                className="lockin-history-item-menu"
                onClick={(e) => handleChatDelete(e, chat.id)}
                title="Delete chat"
                aria-label="Delete chat menu"
              >
                <span className="lockin-menu-dots">&#8230;</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
