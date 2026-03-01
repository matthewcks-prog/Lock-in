import type { ChatMessage, StudyResponse, ApiResponse } from '../../core/domain/types';
import type {
  StreamEvent,
  StreamMetaEvent,
  StreamDeltaEvent,
  StreamFinalEvent,
  StreamErrorEvent,
} from '../fetcher/sseParser';

export interface ProcessTextParams {
  selection?: string;
  chatHistory?: ChatMessage[];
  newUserMessage?: string;
  chatId?: string;
  pageContext?: string;
  pageUrl?: string;
  courseCode?: string;
  language?: string;
  attachments?: string[];
  idempotencyKey?: string;
  regenerate?: boolean;
}

export interface ProcessTextStreamParams extends ProcessTextParams {
  onEvent?: (event: StreamEvent) => void;
  onMeta?: (meta: StreamMetaEvent) => void;
  onDelta?: (delta: StreamDeltaEvent) => void;
  onFinal?: (final: StreamFinalEvent) => void;
  onError?: (error: StreamErrorEvent) => void;
  signal?: AbortSignal;
}

export interface ProcessTextStreamResult {
  success: boolean;
  chatId?: string;
  messageId?: string;
  content?: string;
  usage?: StreamFinalEvent['usage'];
  error?: StreamErrorEvent;
}

export type StreamingConfig = {
  backendUrl: string;
  getAccessToken: () => Promise<string>;
  fetcher?: typeof fetch;
};

export type LockinClient = {
  processText: (params: ProcessTextParams) => Promise<ApiResponse<StudyResponse>>;
  processTextStream: (params: ProcessTextStreamParams) => Promise<ProcessTextStreamResult>;
};
