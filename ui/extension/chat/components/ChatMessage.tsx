/**
 * ChatMessage Component
 *
 * Renders a single chat message with markdown support.
 * Handles both user and assistant messages with appropriate styling.
 */

import React, { memo } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import type { ChatAttachment, ChatMessage as ChatMessageType } from '../types';

interface ChatMessageProps {
  /** The message to render */
  message: ChatMessageType;
  /** Optional action component to display (e.g., save to notes) */
  action?: React.ReactNode;
  /** Whether to show the thinking animation */
  isThinking?: boolean;
}

/**
 * Thinking animation dots
 */
function ThinkingIndicator() {
  return (
    <div className="lockin-chat-thinking">
      <span className="lockin-chat-thinking-text">Thinking</span>
      <span className="lockin-chat-thinking-dots">
        <span className="lockin-chat-thinking-dot" style={{ animationDelay: '0ms' }} />
        <span className="lockin-chat-thinking-dot" style={{ animationDelay: '150ms' }} />
        <span className="lockin-chat-thinking-dot" style={{ animationDelay: '300ms' }} />
      </span>
    </div>
  );
}

export const ChatMessage = memo(function ChatMessage({
  message,
  action,
  isThinking = false,
}: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isPending = message.isPending;
  const isError = message.isError;
  const attachments = message.attachments?.filter(Boolean) ?? [];

  const renderAttachment = (attachment: ChatAttachment) => {
    const src = attachment.url || attachment.dataUrl;
    if (attachment.kind === 'image' && src) {
      return (
        <div className="lockin-chat-attachment-thumb">
          <img
            src={src}
            alt={attachment.name}
            className="lockin-chat-attachment-thumb-img"
            loading="lazy"
          />
        </div>
      );
    }

    return (
      <div className="lockin-chat-attachment-file">
        <span className="lockin-chat-attachment-file-icon" aria-hidden="true">
          📎
        </span>
        <span className="lockin-chat-attachment-file-name" title={attachment.name}>
          {attachment.name}
        </span>
      </div>
    );
  };

  return (
    <div
      className={`lockin-chat-msg ${isUser ? 'lockin-chat-msg-user' : 'lockin-chat-msg-assistant'} ${
        isPending ? 'lockin-chat-msg-pending' : ''
      } ${isError ? 'lockin-chat-msg-error' : ''}`}
    >
      {/* Message bubble */}
      <div className="lockin-chat-bubble">
        {isPending || isThinking ? (
          <ThinkingIndicator />
        ) : isUser ? (
          // User messages are plain text
          <p>{message.content}</p>
        ) : (
          // Assistant messages get markdown rendering
          <MarkdownRenderer content={message.content} />
        )}
      </div>

      {isUser && attachments.length > 0 && (
        <div className="lockin-chat-attachments" aria-label="Message attachments">
          {attachments.map((attachment, index) => (
            <div className="lockin-chat-attachment" key={`${message.id}-attach-${index}`}>
              {renderAttachment(attachment)}
            </div>
          ))}
        </div>
      )}

      {/* Action button (e.g., save to notes) */}
      {action && !isPending && !isUser && action}

      {/* Timestamp - optional, hidden by default */}
      {/* {message.timestamp && (
        <span className="text-xs text-gray-400 px-2">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      )} */}
    </div>
  );
});
