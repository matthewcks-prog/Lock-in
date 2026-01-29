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

export function createTranscriptsClient(apiRequest: ApiRequest) {
  async function cacheTranscript(
    params: CacheTranscriptParams,
    options?: ApiRequestOptions,
  ): Promise<TranscriptCacheResponse> {
    if (!params?.fingerprint) {
      throw new Error('fingerprint is required');
    }
    if (!params?.provider) {
      throw new Error('provider is required');
    }
    if (!params?.transcript) {
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
