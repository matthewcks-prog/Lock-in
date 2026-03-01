import type { TranscriptCacheMeta } from '@api/client';
import type { DetectedVideo, TranscriptResult } from '@core/transcripts/types';

export interface TranscriptCacheInput {
  transcript: TranscriptResult;
  video: DetectedVideo;
  fingerprint?: string;
  meta?: TranscriptCacheMeta;
}

export interface TranscriptCacheState {
  status: 'idle' | 'caching' | 'cached' | 'error';
  error: string | null;
  lastFingerprint: string | null;
}

export const INITIAL_TRANSCRIPT_CACHE_STATE: TranscriptCacheState = {
  status: 'idle',
  error: null,
  lastFingerprint: null,
};
