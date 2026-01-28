/**
 * Chat Domain Types
 *
 * Shared type definitions for the chat feature.
 * Used by hooks, components, and API layer.
 */

import type { StudyMode } from '@core/domain/types';
import type { ApiClient } from '@api/client';

// =============================================================================
// Message Types
// =============================================================================

export type ChatMessageRole = 'user' | 'assistant';

export type ChatAttachmentKind = 'image' | 'document' | 'code' | 'other';

export interface ChatAttachment {
  kind: ChatAttachmentKind;
  mime: string;
  name: string;
  dataUrl?: string;
  url?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
  timestamp: string;
  mode?: StudyMode;
  source?: 'selection' | 'followup';
  isPending?: boolean;
  isError?: boolean;
  attachments?: ChatAttachment[];
}

// =============================================================================
// Chat Session Types
// =============================================================================

export interface ChatHistoryItem {
  id: string;
  title: string;
  updatedAt: string;
  lastMessage?: string;
}

export type HistoryTitleSource = 'local' | 'server';

// =============================================================================
// API Parameter Types
// =============================================================================

export interface SendMessageParams {
  /** The message content to send */
  message: string;
  /** Current study mode */
  mode: StudyMode;
  /** Source of the message */
  source: 'selection' | 'followup';
  /** Current page URL for context */
  pageUrl?: string;
  /** Course code if available */
  courseCode?: string;
  /** Existing chat ID if continuing conversation */
  chatId?: string | null;
  /** Chat history for context */
  chatHistory?: Array<{ role: ChatMessageRole; content: string }>;
}

export interface ChatApiResponse {
  explanation: string;
  chatId?: string;
  chatTitle?: string;
}

// =============================================================================
// Hook Option Types
// =============================================================================

export interface UseChatOptions {
  /** API client for backend calls */
  apiClient: ApiClient | null;
  /** Storage adapter for persistence */
  storage?: {
    get: <T = unknown>(key: string) => Promise<T | null>;
    set: (key: string, value: unknown) => Promise<void>;
  };
  /** Current study mode */
  mode: StudyMode;
  /** Current page URL */
  pageUrl: string;
  /** Course code if available */
  courseCode: string | null;
}

export interface UseChatMessagesOptions {
  apiClient: ApiClient | null;
  chatId: string | null;
  mode: StudyMode;
}

export interface UseChatHistoryOptions {
  apiClient: ApiClient | null;
  limit?: number;
}

export interface UseSendMessageOptions {
  apiClient: ApiClient | null;
  mode: StudyMode;
  pageUrl: string;
  courseCode: string | null;
  onSuccess?: (response: ChatApiResponse, chatId: string) => void;
  onError?: (error: Error) => void;
}

// =============================================================================
// Constants
// =============================================================================

export const CHAT_TITLE_MAX_WORDS = 6;
export const CHAT_TITLE_MAX_LENGTH = 80;
export const FALLBACK_CHAT_TITLE = 'New chat';
export const ACTIVE_CHAT_ID_KEY = 'lockin_sidebar_activeChatId';

// =============================================================================
// Utility Functions
// =============================================================================

export function isValidUUID(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function clampChatTitle(text = ''): string {
  const normalized = normalizeSpaces(text);
  if (!normalized) return '';

  const limitedWords = normalized.split(' ').slice(0, CHAT_TITLE_MAX_WORDS).join(' ').trim();

  if (limitedWords.length <= CHAT_TITLE_MAX_LENGTH) {
    return limitedWords;
  }

  return limitedWords.slice(0, CHAT_TITLE_MAX_LENGTH).trim();
}

export function coerceChatTitle(candidate?: string | null, fallback?: string): string {
  const normalizedCandidate = clampChatTitle(candidate || '');
  if (normalizedCandidate) return normalizedCandidate;

  const normalizedFallback = clampChatTitle(fallback || '');
  return normalizedFallback || FALLBACK_CHAT_TITLE;
}

export function buildInitialChatTitle(text: string): string {
  return coerceChatTitle(text, FALLBACK_CHAT_TITLE);
}

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function relativeTimeLabel(iso: string | null | undefined): string {
  if (!iso) return 'just now';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'just now';
  const delta = Date.now() - date.getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes <= 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function normalizeChatAttachment(raw: unknown): ChatAttachment | null {
  if (!isRecord(raw)) return null;

  const kindValue = getString(raw.kind) || getString(raw.type) || 'other';
  const kind = (
    ['image', 'document', 'code', 'other'].includes(kindValue) ? kindValue : 'other'
  ) as ChatAttachmentKind;
  const mime = getString(raw.mime) || getString(raw.mimeType) || getString(raw.mime_type) || '';
  const name =
    getString(raw.name) || getString(raw.fileName) || getString(raw.file_name) || 'Attachment';
  const dataUrl = getString(raw.dataUrl);
  const url = getString(raw.url);

  return {
    kind,
    mime,
    name,
    dataUrl,
    url,
  };
}

export function normalizeChatMessage(raw: unknown, mode: StudyMode): ChatMessage {
  const record = isRecord(raw) ? raw : {};
  const attachments = Array.isArray(record.attachments)
    ? record.attachments
        .map(normalizeChatAttachment)
        .filter((attachment: ChatAttachment | null): attachment is ChatAttachment =>
          Boolean(attachment),
        )
    : undefined;

  const modeValue =
    record.mode === 'explain' || record.mode === 'general' ? record.mode : undefined;

  return {
    id: getString(record.id) || `msg-${Math.random().toString(16).slice(2)}`,
    role: record.role === 'assistant' ? 'assistant' : 'user',
    content:
      getString(record.content) ||
      getString(record.output_text) ||
      getString(record.input_text) ||
      'Message',
    timestamp: getString(record.created_at) || new Date().toISOString(),
    mode: modeValue || mode,
    attachments,
  };
}
