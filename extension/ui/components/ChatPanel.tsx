/**
 * Chat Panel Component
 * 
 * Displays chat messages and input form.
 * Uses useChat hook for state management.
 */

import React, { useState, useRef, useEffect } from "react";
import { useChat } from "../hooks/useChat";
import type { StudyMode } from "@core/domain/types";
import type { ApiClient } from "@api/client";

export interface ChatPanelProps {
  apiClient: ApiClient;
  chatId?: string | null;
  onChatIdChange?: (chatId: string | null) => void;
  currentMode: StudyMode;
  selectedText?: string;
}

export function ChatPanel({
  apiClient,
  chatId,
  onChatIdChange,
  currentMode,
  selectedText,
}: ChatPanelProps) {
  const { messages, isLoading, error, sendMessage } = useChat({
    apiClient,
    chatId,
    onChatIdChange,
  });

  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const lastSelectedTextRef = useRef<string>("");

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-send message when selectedText changes (text selection)
  useEffect(() => {
    if (selectedText && selectedText.trim() && selectedText !== lastSelectedTextRef.current && !isLoading && messages.length === 0) {
      // Only auto-send if this is a new selection and we don't have messages yet
      // This prevents re-sending when the component re-renders
      lastSelectedTextRef.current = selectedText;
      // Auto-send the selected text as a message
      sendMessage(selectedText, currentMode, selectedText).catch((err) => {
        console.error("Failed to send selected text:", err);
      });
    } else if (selectedText && selectedText !== lastSelectedTextRef.current) {
      // Update ref even if we don't send (to track changes)
      lastSelectedTextRef.current = selectedText;
    }
  }, [selectedText, currentMode, sendMessage, isLoading, messages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || isLoading) return;

    const messageText = messageInput.trim();
    setMessageInput("");
    await sendMessage(messageText, currentMode, selectedText);
  };

  const isSendDisabled = isLoading || !messageInput.trim();

  return (
    <div className="lockin-chat-panel">
      <div className="lockin-chat-messages-wrapper">
        <div className="lockin-chat-messages" id="lockin-chat-messages">
          {messages.length === 0 && (
            <div className="lockin-chat-empty">
              <p>Start a conversation by asking a question or selecting text.</p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`lockin-chat-message lockin-chat-message-${msg.role}`}
            >
              <div className="lockin-chat-message-content">
                {msg.content}
              </div>
              {msg.timestamp && (
                <div className="lockin-chat-message-time">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="lockin-chat-message lockin-chat-message-assistant">
              <div className="lockin-chat-message-content">
                <span className="lockin-loading">Thinking...</span>
              </div>
            </div>
          )}
          {error && (
            <div className="lockin-chat-error">
              <p>Error: {error.message}</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="lockin-chat-bottom-section">
        <form className="lockin-chat-input" onSubmit={handleSubmit}>
          <input
            ref={messageInputRef}
            className="lockin-chat-input-field"
            id="lockin-chat-input"
            name="lockin-chat-input"
            placeholder="Ask a follow-up question..."
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            disabled={isLoading}
          />
          <button
            className="lockin-send-btn"
            type="submit"
            disabled={isSendDisabled}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
