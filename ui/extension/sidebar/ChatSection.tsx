import { useCallback, useLayoutEffect, useState } from 'react';
import type { ApiClient } from '@api/client';
import type { StudyMode } from '@core/domain/types';
import {
  AttachmentButton,
  AttachmentPreview,
  ChatMessage as ChatMessageComponent,
} from '../chat/components';
import {
  useChat,
  useChatAttachments,
  useChatInput,
  relativeTimeLabel,
  type ChatAttachment,
  type ChatMessage,
} from '../chat';
import { useNoteSaveContext } from '../contexts/NoteSaveContext';
import type { StorageAdapter } from './types';

interface ChatSectionProps {
  apiClient: ApiClient | null;
  storage?: StorageAdapter;
  mode: StudyMode;
  pageUrl: string;
  courseCode: string | null;
  selectedText?: string;
  isOpen: boolean;
  isActive: boolean;
}

function SaveNoteAction({ content }: { content: string }) {
  const { saveNote } = useNoteSaveContext();

  const handleSave = async () => {
    await saveNote({
      content,
      noteType: 'manual',
    });
  };

  return (
    <div className="lockin-chat-save-note-action">
      <button
        className="lockin-chat-save-note-btn"
        onClick={(event) => {
          event.stopPropagation();
          handleSave();
        }}
        type="button"
      >
        Save note
      </button>
    </div>
  );
}

export function ChatSection({
  apiClient,
  storage,
  mode,
  pageUrl,
  courseCode,
  selectedText,
  isOpen,
  isActive,
}: ChatSectionProps) {
  const {
    messages,
    recentChats,
    activeHistoryId,
    isSending,
    sendMessage,
    startBlankChat,
    selectChat,
    isHistoryOpen,
    setIsHistoryOpen,
    ensureChatId,
    hasMoreHistory,
    isLoadingMoreHistory,
    loadMoreHistory,
    isLoadingHistory,
  } = useChat({
    apiClient,
    storage,
    mode,
    pageUrl,
    courseCode,
    selectedText,
  });

  const {
    attachments: pendingAttachments,
    addFiles: addAttachmentFiles,
    removeAttachment,
    clearAttachments,
    setAttachmentStatus,
    isUploading: isAttachmentUploading,
  } = useChatAttachments({ maxAttachments: 5 });

  const [composerError, setComposerError] = useState<string | null>(null);
  const hasPendingAttachments = pendingAttachments.length > 0;

  const uploadAttachments = useCallback(
    async (chatId: string) => {
      if (!apiClient?.uploadChatAsset) {
        throw new Error('Attachment uploads are not available.');
      }

      const attachmentIds: string[] = [];
      const messageAttachments: ChatAttachment[] = [];

      for (const attachment of pendingAttachments) {
        setAttachmentStatus(attachment.id, 'uploading');
        try {
          const asset = await apiClient.uploadChatAsset({
            chatId,
            file: attachment.file,
          });
          attachmentIds.push(asset.id);
          setAttachmentStatus(attachment.id, 'uploaded', asset.id);

          messageAttachments.push({
            kind: asset.type || 'other',
            mime: asset.mimeType,
            name: asset.fileName || attachment.file.name,
            url: asset.url || attachment.previewUrl,
          });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Upload failed';
          setAttachmentStatus(attachment.id, 'error', undefined, message);
          throw error;
        }
      }

      return { attachmentIds, messageAttachments };
    },
    [apiClient, pendingAttachments, setAttachmentStatus],
  );

  const handleSendMessage = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      const hasText = trimmed.length > 0;
      const hasAttachments = hasPendingAttachments;
      if (!hasText && !hasAttachments) return false;
      if (isSending || isAttachmentUploading) return false;

      setComposerError(null);

      let attachmentIds: string[] = [];
      let messageAttachments: ChatAttachment[] = [];

      if (hasAttachments) {
        try {
          const chatId = await ensureChatId(hasText ? trimmed : 'Attachment-based question');
          if (!chatId) {
            throw new Error('Unable to create a chat session for attachments.');
          }

          const uploadResult = await uploadAttachments(chatId);
          attachmentIds = uploadResult.attachmentIds;
          messageAttachments = uploadResult.messageAttachments;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Failed to upload attachments.';
          setComposerError(message);
          return false;
        }
      }

      const displayMessage = hasText ? trimmed : 'Sent attachments';
      sendMessage(displayMessage, {
        source: 'followup',
        attachments: messageAttachments,
        attachmentIds,
        selectionOverride: hasText ? undefined : '',
        userMessageOverride: hasText ? trimmed : undefined,
      });

      clearAttachments();
      return true;
    },
    [
      hasPendingAttachments,
      isSending,
      isAttachmentUploading,
      ensureChatId,
      uploadAttachments,
      sendMessage,
      clearAttachments,
    ],
  );

  const {
    value: inputValue,
    inputRef,
    handleChange: handleInputChange,
    handleKeyDown: handleInputKeyDown,
    handleSend: handleInputSend,
    syncHeight: syncTextareaHeight,
  } = useChatInput({
    onSend: handleSendMessage,
    isSending: isSending || isAttachmentUploading,
    shouldFocus: isOpen && isActive,
    canSend: hasPendingAttachments,
  });
  const canSend = Boolean(inputValue.trim()) || hasPendingAttachments;

  useLayoutEffect(() => {
    if (!isOpen || !isActive) return;
    syncTextareaHeight();
  }, [isOpen, isActive, inputValue, syncTextareaHeight]);

  const renderChatMessages = () => {
    if (!messages.length) {
      return (
        <div className="lockin-chat-empty">Ask anything about this page to start a new chat.</div>
      );
    }

    return messages.map((message: ChatMessage) => (
      <ChatMessageComponent
        key={message.id}
        message={message}
        action={
          message.role === 'assistant' && !message.isPending ? (
            <SaveNoteAction content={message.content} />
          ) : undefined
        }
        isThinking={message.isPending}
      />
    ));
  };

  return (
    <>
      <div className="lockin-chat-toolbar">
        <div className="lockin-chat-toolbar-left">
          <button
            className="lockin-history-toggle-btn"
            onClick={() => setIsHistoryOpen((prev) => !prev)}
            aria-label="Toggle chat history"
            aria-pressed={isHistoryOpen}
          >
            <span className="lockin-history-toggle-icon" aria-hidden="true">
              <span className="lockin-history-toggle-line" />
              <span className="lockin-history-toggle-line" />
              <span className="lockin-history-toggle-line" />
            </span>
            <span className="lockin-sr-only">Toggle chat history</span>
          </button>
        </div>
        <div className="lockin-chat-toolbar-right">
          <button className="lockin-new-chat-btn" onClick={startBlankChat}>
            + New chat
          </button>
        </div>
      </div>

      <div className="lockin-chat-container" data-history-state={isHistoryOpen ? 'open' : 'closed'}>
        <aside className="lockin-chat-history-panel" data-state={isHistoryOpen ? 'open' : 'closed'}>
          <div className="lockin-history-list">
            {recentChats.length === 0 ? (
              <div className="lockin-history-empty">
                {isLoadingHistory
                  ? 'Loading chats...'
                  : 'No chats yet. Start from a highlight or a question.'}
              </div>
            ) : (
              recentChats.map((item) => (
                <button
                  key={item.id}
                  className={`lockin-history-item ${activeHistoryId === item.id ? 'active' : ''}`}
                  onClick={() => selectChat(item)}
                >
                  <div className="lockin-history-item-content">
                    <div className="lockin-history-title">{item.title}</div>
                    <div className="lockin-history-meta">{relativeTimeLabel(item.updatedAt)}</div>
                  </div>
                </button>
              ))
            )}
            {hasMoreHistory && (
              <button
                className="lockin-history-load-more"
                onClick={() => void loadMoreHistory()}
                disabled={isLoadingMoreHistory}
              >
                {isLoadingMoreHistory ? 'Loading...' : 'Load more'}
              </button>
            )}
          </div>
        </aside>

        <div className="lockin-chat-main">
          <div className="lockin-chat-content">
            <div className="lockin-chat-messages-wrapper">
              <div className="lockin-chat-messages">
                {renderChatMessages()}
                {composerError && <div className="lockin-chat-error">{composerError}</div>}
              </div>
            </div>

            <div className="lockin-chat-bottom-section">
              <AttachmentPreview
                attachments={pendingAttachments}
                onRemove={removeAttachment}
                disabled={isSending || isAttachmentUploading}
              />
              <div className="lockin-chat-input">
                <AttachmentButton
                  onFilesSelected={addAttachmentFiles}
                  disabled={isSending || isAttachmentUploading}
                  currentFileCount={pendingAttachments.length}
                  maxFiles={5}
                />
                <textarea
                  className="lockin-chat-input-field"
                  placeholder="Ask a follow-up question..."
                  value={inputValue}
                  ref={inputRef}
                  onChange={handleInputChange}
                  onKeyDown={handleInputKeyDown}
                  rows={1}
                />
                <button
                  className="lockin-send-btn"
                  disabled={!canSend || isSending || isAttachmentUploading}
                  onClick={handleInputSend}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
