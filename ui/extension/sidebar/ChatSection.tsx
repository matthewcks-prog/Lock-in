import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ApiClient } from '@api/client';
import { AttachmentButton, AttachmentPreview, MessageBlock } from '../chat/components';
import {
  useChat,
  useChatAttachments,
  useChatInput,
  relativeTimeLabel,
  type ChatAttachment,
  type ChatMessage,
} from '../chat';
import { useNoteSaveContext } from '../contexts/NoteSaveContext';
import { scanContent } from '../../../core/services/contentSafetyFilter';
import type { StorageAdapter } from './types';

interface ChatSectionProps {
  apiClient: ApiClient | null;
  storage?: StorageAdapter;
  pageUrl: string;
  courseCode: string | null;
  pendingPrefill?: string;
  onClearPrefill?: () => void;
  isOpen: boolean;
  isActive: boolean;
}

export function ChatSection({
  apiClient,
  storage,
  pageUrl,
  courseCode,
  pendingPrefill,
  onClearPrefill,
  isOpen,
  isActive,
}: ChatSectionProps) {
  const {
    messages,
    recentChats,
    activeHistoryId,
    isSending,
    streaming,
    cancelStream,
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
    messageEdit,
    regeneration,
  } = (() => {
    const chatOptions: {
      apiClient: ApiClient | null;
      pageUrl: string;
      courseCode: string | null;
      storage?: StorageAdapter;
      enableStreaming?: boolean;
    } = {
      apiClient,
      pageUrl,
      courseCode,
      enableStreaming: true,
    };
    if (storage) {
      chatOptions.storage = storage;
    }
    return useChat(chatOptions);
  })();

  const {
    attachments: pendingAttachments,
    addFiles: addAttachmentFiles,
    removeAttachment,
    clearAttachments,
    setAttachmentStatus,
    isUploading: isAttachmentUploading,
  } = useChatAttachments({ maxAttachments: 5 });

  const [composerError, setComposerError] = useState<string | null>(null);
  const [safetyWarning, setSafetyWarning] = useState<string | null>(null);
  const [safetyBypass, setSafetyBypass] = useState(false);
  const prefillSourceRef = useRef(false);
  const hasPendingAttachments = pendingAttachments.length > 0;

  const uploadAttachments = useCallback(
    async (chatId: string) => {
      if (!apiClient?.uploadChatAsset) {
        throw new Error('Attachment uploads are not available.');
      }

      const attachmentIds: string[] = [];
      const processingAttachments: Array<{ assetId: string; attachmentId: string }> = [];
      const messageAttachments: ChatAttachment[] = [];

      for (const attachment of pendingAttachments) {
        setAttachmentStatus(attachment.id, 'uploading');
        try {
          const asset = await apiClient.uploadChatAsset({
            chatId,
            file: attachment.file,
          });
          attachmentIds.push(asset.id);
          if (asset.processingStatus && asset.processingStatus !== 'ready') {
            setAttachmentStatus(attachment.id, 'processing', asset.id);
            processingAttachments.push({ assetId: asset.id, attachmentId: attachment.id });
          } else {
            setAttachmentStatus(attachment.id, 'uploaded', asset.id);
          }

          const attachmentUrl = asset.url || attachment.previewUrl;
          const messageAttachment: ChatAttachment = {
            kind: asset.type || 'other',
            mime: asset.mimeType,
            name: asset.fileName || attachment.file.name,
          };
          if (attachmentUrl) {
            messageAttachment.url = attachmentUrl;
          }
          messageAttachments.push(messageAttachment);
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Upload failed';
          setAttachmentStatus(attachment.id, 'error', undefined, message);
          throw error;
        }
      }

      return { attachmentIds, messageAttachments, processingAttachments };
    },
    [apiClient, pendingAttachments, setAttachmentStatus],
  );

  const waitForAttachmentsReady = useCallback(
    async (processingAttachments: Array<{ assetId: string; attachmentId: string }>) => {
      if (!apiClient?.getChatAssetStatus) {
        throw new Error('Attachment status checks are not available.');
      }

      const timeoutMs = 60000;
      const pollIntervalMs = 1000;
      const startedAt = Date.now();
      const remaining = new Map(
        processingAttachments.map(({ assetId, attachmentId }) => [assetId, attachmentId]),
      );

      while (remaining.size > 0) {
        if (Date.now() - startedAt > timeoutMs) {
          throw new Error('Attachment processing timed out.');
        }

        const checkIds = Array.from(remaining.keys());
        const results = await Promise.all(
          checkIds.map(async (assetId) => {
            const status = await apiClient.getChatAssetStatus({ assetId });
            return { assetId, status };
          }),
        );

        for (const { assetId, status } of results) {
          if (status.processingStatus === 'ready') {
            const attachmentId = remaining.get(assetId);
            if (attachmentId) {
              setAttachmentStatus(attachmentId, 'uploaded', assetId);
            }
            remaining.delete(assetId);
          } else if (status.processingStatus === 'error') {
            const attachmentId = remaining.get(assetId);
            if (attachmentId) {
              setAttachmentStatus(
                attachmentId,
                'error',
                assetId,
                status.processingError || 'Attachment processing failed.',
              );
            }
            remaining.delete(assetId);
            throw new Error(status.processingError || 'Attachment processing failed.');
          }
        }

        if (remaining.size > 0) {
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
      }
    },
    [apiClient, setAttachmentStatus],
  );

  const handleSendMessage = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      const hasText = trimmed.length > 0;
      const hasAttachments = hasPendingAttachments;
      if (!hasText && !hasAttachments) return false;
      if (isSending || isAttachmentUploading) return false;

      setComposerError(null);

      // Content safety pre-flight check
      if (hasText && !safetyBypass) {
        const safetyResult = scanContent(trimmed);
        if (safetyResult.hasSensitiveContent) {
          setSafetyWarning(safetyResult.summary);
          return false; // Block send — user must dismiss or edit
        }
      }
      setSafetyWarning(null);
      setSafetyBypass(false);

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

          if (uploadResult.processingAttachments.length > 0) {
            await waitForAttachmentsReady(uploadResult.processingAttachments);
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Failed to upload attachments.';
          setComposerError(message);
          return false;
        }
      }

      const displayMessage = hasText ? trimmed : 'Sent attachments';
      const source = prefillSourceRef.current && hasText ? 'selection' : 'followup';
      prefillSourceRef.current = false;

      const sendOptions = {
        source,
        attachments: messageAttachments,
        attachmentIds,
      } as const;
      const sendOverrides: {
        selectionOverride?: string;
        userMessageOverride?: string;
      } = {};
      if (!hasText) {
        sendOverrides.selectionOverride = '';
      } else {
        sendOverrides.userMessageOverride = trimmed;
      }
      sendMessage(displayMessage, { ...sendOptions, ...sendOverrides });

      clearAttachments();
      return true;
    },
    [
      hasPendingAttachments,
      isSending,
      isAttachmentUploading,
      ensureChatId,
      uploadAttachments,
      waitForAttachmentsReady,
      sendMessage,
      clearAttachments,
      safetyBypass,
    ],
  );

  const {
    value: inputValue,
    inputRef,
    handleChange: handleInputChange,
    handleKeyDown: handleInputKeyDown,
    handleSend: handleInputSend,
    syncHeight: syncTextareaHeight,
    setValue,
  } = useChatInput({
    onSend: handleSendMessage,
    isSending: isSending || isAttachmentUploading,
    shouldFocus: isOpen && isActive,
    canSend: hasPendingAttachments,
  });
  const canSend = Boolean(inputValue.trim()) || hasPendingAttachments;
  const isStreaming = Boolean(streaming?.isStreaming);
  const streamError = streaming?.error;

  useEffect(() => {
    if (!pendingPrefill || !pendingPrefill.trim()) return;
    prefillSourceRef.current = true;
    setValue(pendingPrefill);
    if (isOpen && isActive) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
    onClearPrefill?.();
  }, [pendingPrefill, setValue, onClearPrefill, isOpen, isActive, inputRef]);

  useLayoutEffect(() => {
    if (!isOpen || !isActive) return;
    syncTextareaHeight();
  }, [isOpen, isActive, inputValue, syncTextareaHeight]);

  const { saveNote } = useNoteSaveContext();

  const handleSaveNote = useCallback(
    (content: string): void => {
      // Fire-and-forget: useNoteSave already handles errors internally via try/catch.
      void saveNote({ content, noteType: 'manual' });
    },
    [saveNote],
  );

  const renderChatMessages = () => {
    if (!messages.length) {
      return (
        <div className="lockin-chat-empty">Ask anything about this page to start a new chat.</div>
      );
    }

    // Find the index of the last assistant message for scoping regenerate
    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg !== undefined && msg.role === 'assistant' && !msg.isPending && !msg.isStreaming) {
        lastAssistantIdx = i;
        break;
      }
    }

    return messages.map((message: ChatMessage, index: number) => (
      <MessageBlock
        key={message.id}
        message={message}
        isEditing={messageEdit.editingMessageId === message.id}
        editDraft={messageEdit.editDraft}
        isSubmittingEdit={messageEdit.isSubmittingEdit}
        onStartEdit={messageEdit.startEdit}
        onCancelEdit={messageEdit.cancelEdit}
        onSubmitEdit={messageEdit.submitEdit}
        onEditDraftChange={messageEdit.setEditDraft}
        onRegenerate={regeneration.regenerate}
        isRegenerating={regeneration.isRegenerating}
        isLastAssistantMessage={index === lastAssistantIdx}
        onSaveNote={
          message.role === 'assistant' &&
          !message.isPending &&
          !message.isStreaming &&
          !message.isError
            ? handleSaveNote
            : undefined
        }
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
                  onClick={async () => selectChat(item)}
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
              {isStreaming && (
                <div className="lockin-chat-streaming">
                  <div className="lockin-chat-streaming-indicator">
                    <span className="lockin-chat-streaming-dot" aria-hidden="true" />
                    <span>Generating...</span>
                  </div>
                  {cancelStream && (
                    <button
                      className="lockin-chat-stop-btn"
                      type="button"
                      onClick={() => cancelStream()}
                    >
                      Stop
                    </button>
                  )}
                </div>
              )}
              {!isStreaming && streamError && (
                <div className="lockin-chat-error">{streamError.message}</div>
              )}
              {/* Content safety warning */}
              {safetyWarning && (
                <div className="lockin-safety-warning" role="alert">
                  <span className="lockin-safety-warning-icon" aria-hidden="true">
                    ⚠️
                  </span>
                  <span className="lockin-safety-warning-text">
                    <strong>Sensitive content detected.</strong> {safetyWarning}. Edit your message
                    or send anyway.
                  </span>
                  <button
                    type="button"
                    className="lockin-safety-dismiss-btn"
                    onClick={() => {
                      setSafetyBypass(true);
                      setSafetyWarning(null);
                    }}
                  >
                    Send anyway
                  </button>
                </div>
              )}
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
                  aria-label="Chat message"
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
                {isStreaming && cancelStream && (
                  <button
                    className="lockin-cancel-btn"
                    type="button"
                    onClick={() => cancelStream()}
                    aria-label="Cancel generation"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
