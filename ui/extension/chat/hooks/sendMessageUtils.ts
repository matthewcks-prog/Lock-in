import { RateLimitError } from '@core/errors';
import type { ChatMessage, SendMessageParams } from '../types';
import { isValidUUID } from '../types';
import type { TranscriptCacheInput } from '../../transcripts/hooks/useTranscriptCache';

const IDEMPOTENCY_BUCKET_MS = 5000;

/** Extended params that include attachments */
export interface SendMessageWithAttachmentsParams extends SendMessageParams {
  /** Array of uploaded asset IDs to include */
  attachmentIds?: string[];
  /** Override selection payload sent to the API */
  selectionOverride?: string;
  /** Override user message payload sent to the API */
  userMessageOverride?: string;
  /** Idempotency key for de-duplication */
  idempotencyKey?: string;
  /** Optional transcript context to cache before sending */
  transcriptContext?: TranscriptCacheInput;
  /** Whether this is a regeneration of a previous assistant response */
  isRegeneration?: boolean;
}

export type SendMessageMutationParams = SendMessageWithAttachmentsParams & {
  currentMessages: ChatMessage[];
  activeChatId: string | null;
};

export type ChatHistoryEntry = { role: ChatMessage['role']; content: string };

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function buildIdempotencyKey(params: SendMessageWithAttachmentsParams): string {
  const bucket = Math.floor(Date.now() / IDEMPOTENCY_BUCKET_MS);
  const attachmentKey = (params.attachmentIds || []).join(',');
  const chatKey = params.chatId || '';
  const payloadKey = params.selectionOverride ?? params.message;
  const seed = `${chatKey}|${payloadKey}|${attachmentKey}|${bucket}`;
  return `lockin-${hashString(seed)}`;
}

export function formatSendError(error: Error): string {
  if (error instanceof RateLimitError) {
    const retryAfterMs = error.retryAfterMs;
    if (retryAfterMs && retryAfterMs > 0) {
      const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      return `You're sending too fast - try again in ${seconds}s.`;
    }
    return "You're sending too fast - try again in a moment.";
  }
  return error?.message || 'We could not process this request. Try again in a moment.';
}

export function buildChatHistory(params: SendMessageMutationParams): ChatHistoryEntry[] {
  const baseHistorySource = params.chatHistory ?? params.currentMessages;
  return baseHistorySource.map((msg) => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content,
  }));
}

export function resolveApiChatId(params: SendMessageMutationParams): string | undefined {
  // Prefer the chatId field, fallback to activeChatId — both must be valid UUIDs
  if (typeof params.chatId === 'string' && isValidUUID(params.chatId)) {
    return params.chatId;
  }
  if (typeof params.activeChatId === 'string' && isValidUUID(params.activeChatId)) {
    return params.activeChatId;
  }
  return undefined;
}

export function resolveSelectionPayload(params: SendMessageMutationParams): string {
  return params.selectionOverride !== undefined ? params.selectionOverride : params.message;
}

export function resolveUserMessagePayload(params: SendMessageMutationParams): string | undefined {
  return params.source === 'followup' ? (params.userMessageOverride ?? params.message) : undefined;
}

export function resolveIdempotencyKey(params: SendMessageMutationParams): string {
  return params.idempotencyKey || buildIdempotencyKey(params);
}

export async function cacheTranscriptIfNeeded(
  cacheTranscript: (input: TranscriptCacheInput) => Promise<{ fingerprint: string } | null>,
  transcriptContext?: TranscriptCacheInput,
) {
  if (!transcriptContext) return;
  cacheTranscript(transcriptContext).catch((error) => {
    console.warn('[Lock-in] Failed to cache transcript for chat:', error);
  });
}
