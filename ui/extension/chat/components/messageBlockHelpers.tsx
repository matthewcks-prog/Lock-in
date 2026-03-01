/** Shared sub-components and helpers for MessageBlock. */

import { useCallback, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import type { MessageAction } from './MessageActionBar';
import type { ChatAttachment, ChatMessage } from '../types';

const COPY_FEEDBACK_MS = 1500;

// --- SVG Icons (inline, no external deps) --------------------------------

function SvgIcon({ children, label }: { children: ReactNode; label: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" role="img" aria-label={label}>
      {children}
    </svg>
  );
}

export function IconEdit(): JSX.Element {
  return (
    <SvgIcon label="Edit">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </SvgIcon>
  );
}

export function IconCopy(): JSX.Element {
  return (
    <SvgIcon label="Copy">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </SvgIcon>
  );
}

export function IconCheck(): JSX.Element {
  return (
    <SvgIcon label="Check">
      <polyline points="20 6 9 17 4 12" />
    </SvgIcon>
  );
}

export function IconSave(): JSX.Element {
  return (
    <SvgIcon label="Save">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </SvgIcon>
  );
}

export function IconRefresh(): JSX.Element {
  return (
    <SvgIcon label="Refresh">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </SvgIcon>
  );
}

// --- Sub-components --------------------------------------------------

export function ThinkingIndicator(): JSX.Element {
  return (
    <div className="lockin-msg-thinking" role="status" aria-label="Generating response">
      <span className="lockin-msg-thinking-text">Thinking</span>
      <span className="lockin-msg-thinking-dots" aria-hidden="true">
        <span className="lockin-msg-thinking-dot" style={{ animationDelay: '0ms' }} />
        <span className="lockin-msg-thinking-dot" style={{ animationDelay: '150ms' }} />
        <span className="lockin-msg-thinking-dot" style={{ animationDelay: '300ms' }} />
      </span>
    </div>
  );
}

export function StreamingCaret(): JSX.Element {
  return <span className="lockin-msg-caret" aria-hidden="true" />;
}

export function MessageStatus({ status }: { status: 'sending' | 'failed' }): JSX.Element {
  if (status === 'sending') {
    return (
      <span className="lockin-msg-status lockin-msg-status--sending" aria-label="Sending">
        <span className="lockin-msg-status-dot" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="lockin-msg-status lockin-msg-status--failed" aria-label="Failed to send">
      {'!'}
    </span>
  );
}

export function AttachmentThumb({ attachment }: { attachment: ChatAttachment }): JSX.Element {
  const src = attachment.url ?? attachment.dataUrl ?? '';
  if (attachment.kind === 'image' && src !== '') {
    return (
      <div className="lockin-msg-attachment-thumb">
        <img src={src} alt={attachment.name} className="lockin-msg-attachment-img" loading="lazy" />
      </div>
    );
  }

  return (
    <div className="lockin-msg-attachment-file">
      <span className="lockin-msg-attachment-icon" aria-hidden="true">
        📎
      </span>
      <span className="lockin-msg-attachment-name" title={attachment.name}>
        {attachment.name}
      </span>
    </div>
  );
}

// --- Copy hook -------------------------------------------------------

export interface CopyState {
  copied: boolean;
  handleCopy: () => void;
}

function resetCopied(setter: (v: boolean) => void): void {
  setter(false);
}

export function useCopyToClipboard(text: string): CopyState {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback((): void => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(resetCopied, COPY_FEEDBACK_MS, setCopied);
    });
  }, [text]);

  return { copied, handleCopy };
}

// --- Flags -----------------------------------------------------------

export interface MessageFlags {
  isUser: boolean;
  isPending: boolean;
  isStreaming: boolean;
  isError: boolean;
  isEditing: boolean;
}

export function deriveFlags(message: ChatMessage, isEditing: boolean): MessageFlags {
  return {
    isUser: message.role === 'user',
    isPending: Boolean(message.isPending),
    isStreaming: Boolean(message.isStreaming),
    isError: Boolean(message.isError),
    isEditing,
  };
}

export function buildBlockClass(flags: MessageFlags): string {
  const parts = ['lockin-msg-block'];
  parts.push(flags.isUser ? 'lockin-msg-block--user' : 'lockin-msg-block--assistant');
  if (flags.isPending) parts.push('lockin-msg-block--pending');
  if (flags.isStreaming) parts.push('lockin-msg-block--streaming');
  if (flags.isError) parts.push('lockin-msg-block--error');
  if (flags.isEditing) parts.push('lockin-msg-block--editing');
  return parts.join(' ');
}

// --- Action builders -------------------------------------------------

export function buildUserActions(
  message: ChatMessage,
  copyState: CopyState,
  onStartEdit: ((messageId: string, content: string) => void) | undefined,
): MessageAction[] {
  const actions: MessageAction[] = [];
  if (onStartEdit !== undefined) {
    const startEdit = onStartEdit;
    actions.push({
      key: 'edit',
      icon: <IconEdit />,
      label: 'Edit message',
      onClick: () => startEdit(message.id, message.content),
    });
  }
  actions.push({
    key: 'copy',
    icon: copyState.copied ? <IconCheck /> : <IconCopy />,
    label: copyState.copied ? 'Copied!' : 'Copy message',
    onClick: copyState.handleCopy,
  });
  return actions;
}

interface AssistantActionParams {
  message: ChatMessage;
  copyState: CopyState;
  onSaveNote: ((content: string) => void) | undefined;
  onRegenerate: (() => void) | undefined;
  isRegenerating: boolean;
}

export function buildAssistantActions(params: AssistantActionParams): MessageAction[] {
  const { message, copyState, onSaveNote, onRegenerate, isRegenerating } = params;
  const actions: MessageAction[] = [];
  actions.push({
    key: 'copy',
    icon: copyState.copied ? <IconCheck /> : <IconCopy />,
    label: copyState.copied ? 'Copied!' : 'Copy message',
    onClick: copyState.handleCopy,
  });
  if (onSaveNote !== undefined) {
    const save = onSaveNote;
    actions.push({
      key: 'save-note',
      icon: <IconSave />,
      label: 'Save note',
      onClick: () => save(message.content),
    });
  }
  if (onRegenerate !== undefined) {
    actions.push({
      key: 'regenerate',
      icon: <IconRefresh />,
      label: 'Regenerate response',
      onClick: onRegenerate,
      loading: isRegenerating,
      disabled: isRegenerating,
    });
  }
  return actions;
}

export function renderStatusIndicator(message: ChatMessage): JSX.Element | null {
  if (message.status === 'sending') return <MessageStatus status="sending" />;
  if (message.status === 'failed') return <MessageStatus status="failed" />;
  return null;
}
