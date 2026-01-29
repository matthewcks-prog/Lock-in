import type { ChatMessage, StudyResponse, ApiResponse } from '../../core/domain/types';
import type { ApiRequest } from '../fetcher';
import { sanitizeUrl } from '../../core/utils/urlSanitizer';

export interface ProcessTextParams {
  selection?: string;
  mode: 'explain' | 'general';
  chatHistory?: ChatMessage[];
  newUserMessage?: string;
  chatId?: string;
  pageContext?: string;
  pageUrl?: string;
  courseCode?: string;
  language?: string;
  /** Array of asset IDs to include as attachments */
  attachments?: string[];
  /** Optional idempotency key for request de-duplication */
  idempotencyKey?: string;
}

type LockinRequestBody = {
  selection: string;
  mode: 'explain' | 'general';
  chatHistory: Array<{ role: string; content: string }>;
  newUserMessage?: string;
  chatId?: string;
  pageContext?: string;
  pageUrl?: string;
  courseCode?: string;
  language?: string;
  attachments?: string[];
  idempotencyKey?: string;
};

export function createLockinClient(apiRequest: ApiRequest) {
  async function processText(params: ProcessTextParams): Promise<ApiResponse<StudyResponse>> {
    const {
      selection,
      mode,
      chatHistory = [],
      newUserMessage,
      chatId,
      pageContext,
      pageUrl,
      courseCode,
      language = 'en',
      attachments = [],
      idempotencyKey,
    } = params;

    const normalizedHistory = (Array.isArray(chatHistory) ? chatHistory : [])
      .filter(
        (message) =>
          message && typeof message.role === 'string' && typeof message.content === 'string',
      )
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    const body: LockinRequestBody = {
      selection: selection || '',
      mode,
      chatHistory: normalizedHistory,
    };

    if (newUserMessage) body.newUserMessage = newUserMessage;
    if (chatId) body.chatId = chatId;
    if (pageContext) body.pageContext = pageContext;
    // Sanitize URL to remove sensitive query parameters (sesskey, tokens, etc.)
    if (pageUrl) body.pageUrl = sanitizeUrl(pageUrl);
    if (courseCode) body.courseCode = courseCode;
    if (language) body.language = language;
    if (attachments && attachments.length > 0) body.attachments = attachments;
    if (idempotencyKey) body.idempotencyKey = idempotencyKey;

    return apiRequest<ApiResponse<StudyResponse>>('/api/lockin', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      retryConfig: {
        maxRetries: 2,
        retryableStatuses: [502, 503, 504],
      },
    });
  }

  return {
    processText,
  };
}
