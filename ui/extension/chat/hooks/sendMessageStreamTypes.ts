import type {
  StreamMetaEvent,
  StreamDeltaEvent,
  StreamFinalEvent,
  StreamErrorEvent,
} from '@api/client';
import type { UseSendMessageOptions } from '../types';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { TranscriptCacheInput } from '../../transcripts/hooks/useTranscriptCache';

export interface StreamingState {
  isStreaming: boolean;
  streamedContent: string;
  meta: StreamMetaEvent | null;
  error: StreamErrorEvent | null;
  isComplete: boolean;
}

export interface UseSendMessageStreamOptions extends UseSendMessageOptions {
  onStreamStart?: (meta: StreamMetaEvent) => void;
  onStreamDelta?: (delta: StreamDeltaEvent, accumulated: string) => void;
  onStreamComplete?: (final: StreamFinalEvent) => void;
  onStreamError?: (error: StreamErrorEvent) => void;
}

export interface StreamingSendResult {
  success: boolean;
  chatId?: string;
  chatTitle?: string;
  content?: string;
  error?: StreamErrorEvent;
}

export interface StreamCallbacks {
  onSuccess?: UseSendMessageOptions['onSuccess'];
  onError?: UseSendMessageOptions['onError'];
  onStreamStart?: UseSendMessageStreamOptions['onStreamStart'];
  onStreamDelta?: UseSendMessageStreamOptions['onStreamDelta'];
  onStreamComplete?: UseSendMessageStreamOptions['onStreamComplete'];
  onStreamError?: UseSendMessageStreamOptions['onStreamError'];
}

export interface StreamRefs {
  abortControllerRef: MutableRefObject<AbortController | null>;
  pendingSendKeyRef: MutableRefObject<string | null>;
  activeRequestIdRef: MutableRefObject<string | null>;
}

export interface StreamTracker {
  accumulated: string;
  meta: StreamMetaEvent | null;
  finalContent: string | undefined;
}

export type SetStreamingState = Dispatch<SetStateAction<StreamingState>>;

export type CacheTranscript = (
  input: TranscriptCacheInput,
) => Promise<{ fingerprint: string } | null>;
