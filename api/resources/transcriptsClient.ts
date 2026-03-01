import type { TranscriptResult } from '@core/transcripts/types';
import type { ApiRequest, ApiRequestOptions } from '../fetcher';
import { validateTranscriptCacheResponse } from '../validation';

export interface TranscriptCacheMeta {
  mediaUrl?: string;
  mediaUrlNormalized?: string;
  etag?: string;
  lastModified?: string;
  durationMs?: number | null;
}

export interface CacheTranscriptParams {
  fingerprint: string;
  provider: string;
  transcript: TranscriptResult;
  meta?: TranscriptCacheMeta;
}

export interface TranscriptCacheResponse {
  success: boolean;
  fingerprint?: string;
  cachedAt?: string;
}

export type TranscriptsClient = {
  cacheTranscript: (
    params: CacheTranscriptParams,
    options?: ApiRequestOptions,
  ) => Promise<TranscriptCacheResponse>;
};

export function createTranscriptsClient(apiRequest: ApiRequest): TranscriptsClient {
  async function cacheTranscript(
    params: CacheTranscriptParams,
    options?: ApiRequestOptions,
  ): Promise<TranscriptCacheResponse> {
    if (typeof params?.fingerprint !== 'string' || params.fingerprint.length === 0) {
      throw new Error('fingerprint is required');
    }
    if (typeof params?.provider !== 'string' || params.provider.length === 0) {
      throw new Error('provider is required');
    }
    if (params?.transcript === null || params?.transcript === undefined) {
      throw new Error('transcript is required');
    }

    const raw = await apiRequest<unknown>('/api/transcripts/cache', {
      method: 'POST',
      body: JSON.stringify(params),
      ...options,
    });
    return validateTranscriptCacheResponse(raw, 'cacheTranscript');
  }

  return {
    cacheTranscript,
  };
}
