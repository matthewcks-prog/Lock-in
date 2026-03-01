import { useCallback, useRef, useState } from 'react';
import type { ApiClient } from '@api/client';
import {
  INITIAL_TRANSCRIPT_CACHE_STATE,
  type TranscriptCacheInput,
  type TranscriptCacheState,
} from './transcriptCacheTypes';
import { runCacheTranscriptTask } from './transcriptCacheRuntime';

export type { TranscriptCacheInput, TranscriptCacheState } from './transcriptCacheTypes';

export function useTranscriptCache(apiClient: ApiClient | null): {
  cacheTranscript: (input: TranscriptCacheInput) => Promise<{ fingerprint: string } | null>;
  status: TranscriptCacheState['status'];
  error: string | null;
  lastFingerprint: string | null;
} {
  const [state, setState] = useState<TranscriptCacheState>(INITIAL_TRANSCRIPT_CACHE_STATE);
  const cachedFingerprintsRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef<Set<string>>(new Set());

  const cacheTranscript = useCallback(
    async (input: TranscriptCacheInput): Promise<{ fingerprint: string } | null> =>
      runCacheTranscriptTask({
        apiClient,
        input,
        setState,
        cachedFingerprintsRef,
        inFlightRef,
      }),
    [apiClient],
  );

  return {
    cacheTranscript,
    status: state.status,
    error: state.error,
    lastFingerprint: state.lastFingerprint,
  };
}
