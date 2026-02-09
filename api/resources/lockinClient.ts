import type { StudyResponse, ApiResponse } from '../../core/domain/types';
import type { ApiRequest, ApiRequestOptions } from '../fetcher';
import { sanitizeUrl } from '../../core/utils/urlSanitizer';
import { validateLockinResponse } from '../validation';
import { HTTP_STATUS } from '../fetcher/constants';
import type {
  LockinClient,
  ProcessTextParams,
  ProcessTextStreamParams,
  ProcessTextStreamResult,
  StreamingConfig,
} from './lockinTypes';
import {
  parseSSEStream,
  type StreamEvent,
  type StreamMetaEvent,
  type StreamDeltaEvent,
  type StreamFinalEvent,
  type StreamErrorEvent,
} from '../fetcher/sseParser';

// Re-export stream event types for consumers
export type { StreamEvent, StreamMetaEvent, StreamDeltaEvent, StreamFinalEvent, StreamErrorEvent };
export type {
  LockinClient,
  ProcessTextParams,
  ProcessTextStreamParams,
  ProcessTextStreamResult,
  StreamingConfig,
} from './lockinTypes';

type LockinRequestBody = {
  selection: string;
  chatHistory: Array<{ role: string; content: string }>;
  newUserMessage?: string;
  chatId?: string;
  pageContext?: string;
  pageUrl?: string;
  courseCode?: string;
  language?: string;
  attachments?: string[];
  idempotencyKey?: string;
  regenerate?: boolean;
};

const RETRYABLE_STATUSES = [
  HTTP_STATUS.BAD_GATEWAY,
  HTTP_STATUS.SERVICE_UNAVAILABLE,
  HTTP_STATUS.GATEWAY_TIMEOUT,
];
const STREAM_ENDPOINT = '/api/lockin/stream';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function normalizeChatHistory(
  chatHistory?: ProcessTextParams['chatHistory'],
): Array<{ role: string; content: string }> {
  return (Array.isArray(chatHistory) ? chatHistory : [])
    .filter((message) => typeof message.role === 'string' && typeof message.content === 'string')
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

function buildLockinRequestBody(params: ProcessTextParams): LockinRequestBody {
  const body: LockinRequestBody = {
    selection: isNonEmptyString(params.selection) ? params.selection : '',
    chatHistory: normalizeChatHistory(params.chatHistory),
  };

  if (isNonEmptyString(params.newUserMessage)) body.newUserMessage = params.newUserMessage;
  if (isNonEmptyString(params.chatId)) body.chatId = params.chatId;
  if (isNonEmptyString(params.pageContext)) body.pageContext = params.pageContext;
  if (isNonEmptyString(params.pageUrl)) body.pageUrl = sanitizeUrl(params.pageUrl);
  if (isNonEmptyString(params.courseCode)) body.courseCode = params.courseCode;
  if (isNonEmptyString(params.language)) body.language = params.language;
  if (Array.isArray(params.attachments) && params.attachments.length > 0)
    body.attachments = params.attachments;
  if (isNonEmptyString(params.idempotencyKey)) body.idempotencyKey = params.idempotencyKey;
  if (params.regenerate === true) body.regenerate = true;

  return body;
}

type StreamCallbacks = {
  onEvent?: (event: StreamEvent) => void;
  onMeta?: (meta: StreamMetaEvent) => void;
  onDelta?: (delta: StreamDeltaEvent) => void;
  onFinal?: (final: StreamFinalEvent) => void;
  onError?: (error: StreamErrorEvent) => void;
};

type StreamCallbacksInput = {
  onEvent: StreamCallbacks['onEvent'] | undefined;
  onMeta: StreamCallbacks['onMeta'] | undefined;
  onDelta: StreamCallbacks['onDelta'] | undefined;
  onFinal: StreamCallbacks['onFinal'] | undefined;
  onError: StreamCallbacks['onError'] | undefined;
};

function buildStreamCallbacks(callbacks: StreamCallbacksInput): StreamCallbacks {
  const resolved: StreamCallbacks = {};
  if (callbacks.onEvent !== undefined) resolved.onEvent = callbacks.onEvent;
  if (callbacks.onMeta !== undefined) resolved.onMeta = callbacks.onMeta;
  if (callbacks.onDelta !== undefined) resolved.onDelta = callbacks.onDelta;
  if (callbacks.onFinal !== undefined) resolved.onFinal = callbacks.onFinal;
  if (callbacks.onError !== undefined) resolved.onError = callbacks.onError;
  return resolved;
}

function buildStreamHeaders(accessToken: string, idempotencyKey?: string): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    Accept: 'text/event-stream',
  };
  if (isNonEmptyString(idempotencyKey)) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  return headers;
}

function buildStreamRequestInit(
  body: LockinRequestBody,
  headers: HeadersInit,
  signal?: AbortSignal,
): RequestInit {
  const fetchInit: RequestInit = {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  };
  if (signal !== undefined) {
    fetchInit.signal = signal;
  }
  return fetchInit;
}

async function parseStreamError(response: Response): Promise<StreamErrorEvent> {
  const errorText = await response.text();
  try {
    const parsed = JSON.parse(errorText);
    return {
      code: parsed.error?.code || `HTTP_${response.status}`,
      message: parsed.error?.message || response.statusText,
      retryable:
        response.status === HTTP_STATUS.SERVICE_UNAVAILABLE ||
        response.status === HTTP_STATUS.TOO_MANY_REQUESTS,
    };
  } catch {
    return {
      code: `HTTP_${response.status}`,
      message: response.statusText,
      retryable: false,
    };
  }
}

function applyStreamEvent(
  event: StreamEvent,
  result: ProcessTextStreamResult,
  callbacks: StreamCallbacks,
): void {
  callbacks.onEvent?.(event);

  switch (event.type) {
    case 'meta': {
      handleMetaEvent(event.data as StreamMetaEvent, result, callbacks);
      return;
    }
    case 'delta': {
      handleDeltaEvent(event.data as StreamDeltaEvent, result, callbacks);
      return;
    }
    case 'final': {
      handleFinalEvent(event.data as StreamFinalEvent, result, callbacks);
      return;
    }
    case 'error': {
      handleErrorEvent(event.data as StreamErrorEvent, result, callbacks);
      return;
    }
    case 'done':
      return;
  }
}

function handleMetaEvent(
  meta: StreamMetaEvent,
  result: ProcessTextStreamResult,
  callbacks: StreamCallbacks,
): void {
  result.chatId = meta.chatId;
  result.messageId = meta.messageId;
  callbacks.onMeta?.(meta);
}

function handleDeltaEvent(
  delta: StreamDeltaEvent,
  result: ProcessTextStreamResult,
  callbacks: StreamCallbacks,
): void {
  result.content = `${result.content ?? ''}${delta.content}`;
  callbacks.onDelta?.(delta);
}

function handleFinalEvent(
  finalData: StreamFinalEvent,
  result: ProcessTextStreamResult,
  callbacks: StreamCallbacks,
): void {
  if (isNonEmptyString(finalData.content)) {
    result.content = finalData.content;
  }
  result.usage = finalData.usage;
  callbacks.onFinal?.(finalData);
}

function handleErrorEvent(
  errorData: StreamErrorEvent,
  result: ProcessTextStreamResult,
  callbacks: StreamCallbacks,
): void {
  result.success = false;
  result.error = errorData;
  callbacks.onError?.(errorData);
}

function handleStreamFailure(
  error: unknown,
  signal: AbortSignal | undefined,
  callbacks: StreamCallbacks,
): ProcessTextStreamResult {
  if (signal?.aborted === true) {
    return {
      success: false,
      error: { code: 'ABORTED', message: 'Request cancelled', retryable: false },
    };
  }
  const streamError: StreamErrorEvent = {
    code: 'STREAM_PARSE_ERROR',
    message: error instanceof Error ? error.message : 'Failed to parse stream',
    retryable: false,
  };
  callbacks.onError?.(streamError);
  return { success: false, error: streamError };
}

async function processTextRequest(
  apiRequest: ApiRequest,
  params: ProcessTextParams,
): Promise<ApiResponse<StudyResponse>> {
  const body = buildLockinRequestBody(params);
  const requestOptions: ApiRequestOptions = {
    method: 'POST',
    body: JSON.stringify(body),
    retryConfig: {
      maxRetries: 2,
      retryableStatuses: RETRYABLE_STATUSES,
    },
  };

  if (isNonEmptyString(body.idempotencyKey)) {
    requestOptions.headers = { 'Idempotency-Key': body.idempotencyKey };
  }

  const raw = await apiRequest<unknown>('/api/lockin', requestOptions);
  return validateLockinResponse(raw, 'processText') as ApiResponse<StudyResponse>;
}

/**
 * Process text with streaming response
 */
async function processTextStreamRequest(
  streamingConfig: StreamingConfig,
  params: ProcessTextStreamParams,
): Promise<ProcessTextStreamResult> {
  const { onEvent, onMeta, onDelta, onFinal, onError, signal, ...processParams } = params;
  const callbacks = buildStreamCallbacks({ onEvent, onMeta, onDelta, onFinal, onError });
  const body = buildLockinRequestBody(processParams);
  const fetcher = streamingConfig.fetcher ?? fetch;

  // Get access token
  const accessToken = await streamingConfig.getAccessToken();

  const url = `${streamingConfig.backendUrl}${STREAM_ENDPOINT}`;
  const headers = buildStreamHeaders(accessToken, body.idempotencyKey);
  const response = await fetcher(url, buildStreamRequestInit(body, headers, signal));

  // Check for HTTP errors
  if (!response.ok) {
    const errorData = await parseStreamError(response);
    callbacks.onError?.(errorData);
    return { success: false, error: errorData };
  }

  // Parse SSE stream
  const result: ProcessTextStreamResult = { success: true };

  try {
    for await (const event of parseSSEStream(response)) {
      applyStreamEvent(event, result, callbacks);
    }
  } catch (error) {
    // Handle stream parsing errors
    return handleStreamFailure(error, signal, callbacks);
  }

  return result;
}

export function createLockinClient(
  apiRequest: ApiRequest,
  streamingConfig?: StreamingConfig,
): LockinClient {
  return {
    processText: async (params) => processTextRequest(apiRequest, params),
    processTextStream: async (params) => {
      if (!streamingConfig) {
        throw new Error(
          'Streaming not configured. Please provide streamingConfig to createLockinClient.',
        );
      }
      return processTextStreamRequest(streamingConfig, params);
    },
  };
}
