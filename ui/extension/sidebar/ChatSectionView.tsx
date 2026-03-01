import { AttachmentButton, AttachmentPreview, MessageBlock } from '../chat/components';
import { relativeTimeLabel, type ChatMessage } from '../chat';
import type { ChatSectionViewModel } from './useChatSectionModel';

function findLastAssistantMessageIndex(messages: ChatMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      message !== undefined &&
      message.role === 'assistant' &&
      message.isPending !== true &&
      message.isStreaming !== true
    ) {
      return index;
    }
  }
  return -1;
}

function resolveSaveHandler({
  message,
  handleSaveNote,
}: {
  message: ChatMessage;
  handleSaveNote: (content: string) => void;
}): ((content: string) => void) | undefined {
  if (
    message.role === 'assistant' &&
    message.isPending !== true &&
    message.isStreaming !== true &&
    message.isError !== true
  ) {
    return handleSaveNote;
  }
  return undefined;
}

function ChatToolbar({ model }: { model: ChatSectionViewModel }): JSX.Element {
  return (
    <div className="lockin-tab-toolbar">
      <div className="lockin-tab-toolbar-start">
        <button
          className="lockin-history-toggle-btn"
          onClick={() => model.chat.setIsHistoryOpen((prev) => !prev)}
          aria-label="Toggle chat history"
          aria-pressed={model.chat.isHistoryOpen}
        >
          <span className="lockin-history-toggle-icon" aria-hidden="true">
            <span className="lockin-history-toggle-line" />
            <span className="lockin-history-toggle-line" />
            <span className="lockin-history-toggle-line" />
          </span>
          <span className="lockin-sr-only">Toggle chat history</span>
        </button>
      </div>
      <div className="lockin-tab-toolbar-center" />
      <div className="lockin-tab-toolbar-end">
        <button className="lockin-btn-new lockin-new-chat-btn" onClick={model.chat.startBlankChat}>
          + New chat
        </button>
      </div>
    </div>
  );
}

function HistoryPanel({ model }: { model: ChatSectionViewModel }): JSX.Element {
  const chats = model.chat.recentChats;
  return (
    <aside
      className="lockin-chat-history-panel"
      data-state={model.chat.isHistoryOpen ? 'open' : 'closed'}
    >
      <div className="lockin-history-list">
        {chats.length === 0 ? (
          <div className="lockin-history-empty">
            {model.chat.isLoadingHistory
              ? 'Loading chats...'
              : 'No chats yet. Start from a highlight or a question.'}
          </div>
        ) : (
          chats.map((item) => (
            <button
              key={item.id}
              className={`lockin-history-item ${model.chat.activeHistoryId === item.id ? 'active' : ''}`}
              onClick={() => void model.chat.selectChat(item)}
            >
              <div className="lockin-history-item-content">
                <div className="lockin-history-title">{item.title}</div>
                <div className="lockin-history-meta">{relativeTimeLabel(item.updatedAt)}</div>
              </div>
            </button>
          ))
        )}
        {model.chat.hasMoreHistory && (
          <button
            className="lockin-history-load-more"
            onClick={() => void model.chat.loadMoreHistory()}
            disabled={model.chat.isLoadingMoreHistory}
          >
            {model.chat.isLoadingMoreHistory ? 'Loading...' : 'Load more'}
          </button>
        )}
      </div>
    </aside>
  );
}

function ChatMessages({ model }: { model: ChatSectionViewModel }): JSX.Element | JSX.Element[] {
  const messages = model.chat.messages;
  if (messages.length === 0) {
    return (
      <div className="lockin-chat-empty">Ask anything about this page to start a new chat.</div>
    );
  }
  const lastAssistantIndex = findLastAssistantMessageIndex(messages);
  return messages.map((message, index) => (
    <MessageBlock
      key={message.id}
      message={message}
      isEditing={model.chat.messageEdit.editingMessageId === message.id}
      editDraft={model.chat.messageEdit.editDraft}
      isSubmittingEdit={model.chat.messageEdit.isSubmittingEdit}
      onStartEdit={model.chat.messageEdit.startEdit}
      onCancelEdit={model.chat.messageEdit.cancelEdit}
      onSubmitEdit={() => void model.chat.messageEdit.submitEdit()}
      onEditDraftChange={model.chat.messageEdit.setEditDraft}
      onRegenerate={() => void model.chat.regeneration.regenerate()}
      isRegenerating={model.chat.regeneration.isRegenerating}
      isLastAssistantMessage={index === lastAssistantIndex}
      onSaveNote={resolveSaveHandler({ message, handleSaveNote: model.handleSaveNote })}
    />
  ));
}

function StreamingStatus({ model }: { model: ChatSectionViewModel }): JSX.Element | null {
  if (!model.isStreaming) return null;
  return (
    <div className="lockin-chat-streaming">
      <div className="lockin-chat-streaming-indicator">
        <span className="lockin-chat-streaming-dot" aria-hidden="true" />
        <span>Generating...</span>
      </div>
      {model.chat.cancelStream !== undefined && model.chat.cancelStream !== null && (
        <button
          className="lockin-chat-stop-btn"
          type="button"
          onClick={() => model.chat.cancelStream?.()}
        >
          Stop
        </button>
      )}
    </div>
  );
}

function StreamError({ model }: { model: ChatSectionViewModel }): JSX.Element | null {
  if (model.isStreaming || model.streamError === undefined || model.streamError === null)
    return null;
  return <div className="lockin-chat-error">{model.streamError.message}</div>;
}

function SafetyWarningBanner({ model }: { model: ChatSectionViewModel }): JSX.Element | null {
  if (model.safetyWarning === null || model.safetyWarning.length === 0) return null;
  return (
    <div className="lockin-safety-warning" role="alert">
      <span className="lockin-safety-warning-icon" aria-hidden="true">
        !
      </span>
      <span className="lockin-safety-warning-text">
        <strong>Sensitive content detected.</strong> {model.safetyWarning}. Edit your message or
        send anyway.
      </span>
      <button
        type="button"
        className="lockin-safety-dismiss-btn"
        onClick={model.dismissSafetyWarning}
      >
        Send anyway
      </button>
    </div>
  );
}

function ComposerRow({ model }: { model: ChatSectionViewModel }): JSX.Element {
  return (
    <div className="lockin-chat-input">
      <AttachmentButton
        onFilesSelected={model.attachmentState.addFiles}
        disabled={model.chat.isSending || model.attachmentState.isUploading}
        currentFileCount={model.attachmentState.attachments.length}
        maxFiles={model.maxAttachments}
      />
      <textarea
        className="lockin-chat-input-field"
        placeholder="Ask a follow-up question..."
        aria-label="Chat message"
        value={model.inputState.value}
        ref={model.inputState.inputRef}
        onChange={model.inputState.handleChange}
        onKeyDown={model.inputState.handleKeyDown}
        rows={1}
      />
      <button
        className="lockin-send-btn"
        disabled={!model.canSend || model.chat.isSending || model.attachmentState.isUploading}
        onClick={model.inputState.handleSend}
      >
        Send
      </button>
      {model.isStreaming &&
        model.chat.cancelStream !== undefined &&
        model.chat.cancelStream !== null && (
          <button
            className="lockin-cancel-btn"
            type="button"
            onClick={() => model.chat.cancelStream?.()}
            aria-label="Cancel generation"
          >
            Cancel
          </button>
        )}
    </div>
  );
}

function BottomSection({ model }: { model: ChatSectionViewModel }): JSX.Element {
  return (
    <div className="lockin-chat-bottom-section">
      <StreamingStatus model={model} />
      <StreamError model={model} />
      <SafetyWarningBanner model={model} />
      <AttachmentPreview
        attachments={model.attachmentState.attachments}
        onRemove={model.attachmentState.removeAttachment}
        disabled={model.chat.isSending || model.attachmentState.isUploading}
      />
      <ComposerRow model={model} />
    </div>
  );
}

function ChatMainContent({ model }: { model: ChatSectionViewModel }): JSX.Element {
  return (
    <div className="lockin-chat-main">
      <div className="lockin-chat-content">
        <div className="lockin-chat-messages-wrapper">
          <div className="lockin-chat-messages">
            <ChatMessages model={model} />
            {model.composerError !== null && (
              <div className="lockin-chat-error">{model.composerError}</div>
            )}
          </div>
        </div>
        <BottomSection model={model} />
      </div>
    </div>
  );
}

interface ChatSectionViewProps {
  model: ChatSectionViewModel;
}

export function ChatSectionView({ model }: ChatSectionViewProps): JSX.Element {
  return (
    <>
      <ChatToolbar model={model} />
      <div
        className="lockin-chat-container"
        data-history-state={model.chat.isHistoryOpen ? 'open' : 'closed'}
      >
        <HistoryPanel model={model} />
        <ChatMainContent model={model} />
      </div>
    </>
  );
}
