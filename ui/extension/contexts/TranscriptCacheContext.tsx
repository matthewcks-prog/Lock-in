/**
 * Transcript Cache Context
 *
 * Provides access to transcript caching from anywhere in the extension UI.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ApiClient } from '@api/client';
import {
  useTranscriptCache,
  type TranscriptCacheInput,
  type TranscriptCacheState,
} from '../transcripts/hooks/useTranscriptCache';

interface TranscriptCacheContextValue {
  cacheTranscript: (input: TranscriptCacheInput) => Promise<{ fingerprint: string } | null>;
  status: TranscriptCacheState['status'];
  error: string | null;
  lastFingerprint: string | null;
}

const TranscriptCacheContext = createContext<TranscriptCacheContextValue | null>(null);

interface TranscriptCacheProviderProps {
  apiClient: ApiClient | null;
  children: ReactNode;
}

export function TranscriptCacheProvider({ apiClient, children }: TranscriptCacheProviderProps) {
  const cache = useTranscriptCache(apiClient);

  const value = useMemo<TranscriptCacheContextValue>(
    () => ({
      cacheTranscript: cache.cacheTranscript,
      status: cache.status,
      error: cache.error,
      lastFingerprint: cache.lastFingerprint,
    }),
    [cache.cacheTranscript, cache.error, cache.lastFingerprint, cache.status],
  );

  return (
    <TranscriptCacheContext.Provider value={value}>{children}</TranscriptCacheContext.Provider>
  );
}

export function useTranscriptCacheContext(): TranscriptCacheContextValue {
  const context = useContext(TranscriptCacheContext);
  if (!context) {
    throw new Error('useTranscriptCacheContext must be used within a TranscriptCacheProvider');
  }
  return context;
}
