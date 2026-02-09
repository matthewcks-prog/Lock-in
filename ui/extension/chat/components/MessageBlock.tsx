/** MessageBlock - renders a single chat message with edit, copy, regenerate actions. */

import { memo } from 'react';
import type { JSX, ReactNode } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MessageActionBar, type MessageAction } from './MessageActionBar';
import { MessageEditor } from './MessageEditor';
import type { ChatMessage } from '../types';
import {
  ThinkingIndicator,
  StreamingCaret,
  AttachmentThumb,
  useCopyToClipboard,
  deriveFlags,
  buildBlockClass,
  buildUserActions,
  buildAssistantActions,
  renderStatusIndicator,
  type MessageFlags,
  type CopyState,
} from './messageBlockHelpers';

export interface MessageBlockProps {
  message: ChatMessage;
  isEditing?: boolean;
  editDraft?: string;
  isSubmittingEdit?: boolean;
  onStartEdit?: (messageId: string, content: string) => void;
  onCancelEdit?: () => void;
  onSubmitEdit?: () => void;
  onEditDraftChange?: (content: string) => void;
  /** Only passed to the last assistant message; undefined for all others */
  onRegenerate?: () => void;
  onSaveNote?: ((content: string) => void) | undefined;
  isRegenerating?: boolean;
  /** Whether this is the last assistant message (controls regenerate visibility) */
  isLastAssistantMessage?: boolean;
}

export const MessageBlock = memo(function MessageBlock(props: MessageBlockProps): JSX.Element {
  const {
    message,
    isEditing = false,
    isRegenerating = false,
    isLastAssistantMessage = false,
  } = props;
  const { onStartEdit, onSaveNote, onRegenerate } = props;

  const flags = deriveFlags(message, isEditing);
  const copyState = useCopyToClipboard(message.content);
  const hasContent = message.content !== '' && message.content !== 'Thinking...';

  const userActions = buildUserActionsForBlock({
    flags,
    hasContent,
    isEditing,
    message,
    copyState,
    onStartEdit,
  });
  const assistantActions = buildAssistantActionsForBlock({
    flags,
    hasContent,
    message,
    copyState,
    onSaveNote,
    onRegenerate: isLastAssistantMessage ? onRegenerate : undefined,
    isRegenerating,
  });

  return (
    <MessageBlockLayout
      flags={flags}
      userActions={userActions}
      assistantActions={assistantActions}
      statusIndicator={flags.isUser ? renderStatusIndicator(message) : null}
      editedAt={message.editedAt ?? null}
    >
      <MessageBody props={props} flags={flags} hasContent={hasContent} />
      <AttachmentList message={message} isUser={flags.isUser} />
    </MessageBlockLayout>
  );
});

function buildUserActionsForBlock(opts: {
  flags: MessageFlags;
  hasContent: boolean;
  isEditing: boolean;
  message: ChatMessage;
  copyState: CopyState;
  onStartEdit: ((messageId: string, content: string) => void) | undefined;
}): MessageAction[] {
  if (!opts.flags.isUser || opts.flags.isPending || opts.isEditing || !opts.hasContent) return [];
  return buildUserActions(opts.message, opts.copyState, opts.onStartEdit);
}

function buildAssistantActionsForBlock(opts: {
  flags: MessageFlags;
  hasContent: boolean;
  message: ChatMessage;
  copyState: CopyState;
  onSaveNote: ((content: string) => void) | undefined;
  onRegenerate: (() => void) | undefined;
  isRegenerating: boolean;
}): MessageAction[] {
  if (opts.flags.isUser || !opts.hasContent || opts.flags.isStreaming || opts.flags.isPending)
    return [];
  return buildAssistantActions({
    message: opts.message,
    copyState: opts.copyState,
    onSaveNote: opts.onSaveNote,
    onRegenerate: opts.onRegenerate,
    isRegenerating: opts.isRegenerating,
  });
}

function MessageBlockLayout({
  flags,
  userActions,
  assistantActions,
  statusIndicator,
  editedAt,
  children,
}: {
  flags: MessageFlags;
  userActions: MessageAction[];
  assistantActions: MessageAction[];
  statusIndicator: JSX.Element | null;
  editedAt: string | null;
  children: ReactNode;
}): JSX.Element {
  const editedLabel = editedAt !== null ? formatEditedLabel(editedAt) : null;

  return (
    <article
      className={buildBlockClass(flags)}
      role="article"
      aria-label={`${flags.isUser ? 'Your' : 'Assistant'} message`}
    >
      <span className="lockin-sr-only">{flags.isUser ? 'You' : 'Lock-in'}</span>

      {children}

      {editedLabel !== null && editedAt !== null && (
        <span className="lockin-msg-edited-badge" title={`Edited ${editedAt}`}>
          {editedLabel}
        </span>
      )}

      {statusIndicator}

      {flags.isUser && userActions.length > 0 && (
        <MessageActionBar
          actions={userActions}
          className="lockin-msg-action-bar--below lockin-msg-action-bar--user"
        />
      )}

      {!flags.isUser && assistantActions.length > 0 && (
        <MessageActionBar actions={assistantActions} className="lockin-msg-action-bar--below" />
      )}
    </article>
  );
}

const MS_PER_MINUTE = 60000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/** Format a human-readable "(edited)" label */
function formatEditedLabel(editedAt: string): string {
  const date = new Date(editedAt);
  if (Number.isNaN(date.getTime())) return '(edited)';
  const now = Date.now();
  const delta = now - date.getTime();
  const minutes = Math.round(delta / MS_PER_MINUTE);
  if (minutes < 1) return '(edited just now)';
  if (minutes < MINUTES_PER_HOUR) return `(edited ${minutes}m ago)`;
  const hours = Math.round(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return `(edited ${hours}h ago)`;
  return '(edited)';
}

function MessageBody({
  props,
  flags,
  hasContent,
}: {
  props: MessageBlockProps;
  flags: MessageFlags;
  hasContent: boolean;
}): JSX.Element {
  const showThinking = flags.isPending && !hasContent;

  return (
    <div className="lockin-msg-body">
      {showThinking && <ThinkingIndicator />}
      <MessageContent props={props} flags={flags} hasContent={hasContent} />
      {flags.isError && !hasContent && (
        <p className="lockin-msg-error-text">
          {props.message.content !== '' ? props.message.content : 'Something went wrong.'}
        </p>
      )}
    </div>
  );
}

function MessageContent({
  props,
  flags,
  hasContent,
}: {
  props: MessageBlockProps;
  flags: MessageFlags;
  hasContent: boolean;
}): JSX.Element | null {
  const {
    message,
    isEditing = false,
    editDraft = '',
    isSubmittingEdit = false,
    onCancelEdit,
    onSubmitEdit,
    onEditDraftChange,
  } = props;

  const showCaret = flags.isStreaming && hasContent;
  const hasEditCallbacks =
    onCancelEdit !== undefined && onSubmitEdit !== undefined && onEditDraftChange !== undefined;

  if (isEditing && hasEditCallbacks) {
    return (
      <MessageEditor
        draft={editDraft}
        onDraftChange={onEditDraftChange}
        onSubmit={onSubmitEdit}
        onCancel={onCancelEdit}
        isSubmitting={isSubmittingEdit}
      />
    );
  }

  if (!hasContent) return null;

  return (
    <>
      {flags.isUser ? (
        <p className="lockin-msg-user-text">{message.content}</p>
      ) : (
        <MarkdownRenderer content={message.content} />
      )}
      {showCaret && <StreamingCaret />}
    </>
  );
}

function AttachmentList({
  message,
  isUser,
}: {
  message: ChatMessage;
  isUser: boolean;
}): JSX.Element | null {
  const attachments = message.attachments?.filter(Boolean) ?? [];
  if (!isUser || attachments.length === 0) return null;

  return (
    <div className="lockin-msg-attachments" aria-label="Message attachments">
      {attachments.map((attachment, index) => (
        <div className="lockin-msg-attachment" key={`${message.id}-attach-${index}`}>
          <AttachmentThumb attachment={attachment} />
        </div>
      ))}
    </div>
  );
}
