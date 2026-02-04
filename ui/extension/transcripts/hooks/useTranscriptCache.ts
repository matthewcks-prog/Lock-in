import { useCallback, useRef, useState } from 'react';
import type { ApiClient, TranscriptCacheMeta } from '@api/client';
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

const INITIAL_STATE: TranscriptCacheState = {
  status: 'idle',
  error: null,
  lastFingerprint: null,
};

function coerceNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function hashStringFallback(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

async function hashStringSha256(value: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle || typeof TextEncoder === 'undefined') {
    return hashStringFallback(value);
  }

  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function sanitizeMediaUrl(mediaUrl: string): string {
  if (!mediaUrl) return '';
  try {
    const url = new URL(mediaUrl);
    url.hash = '';
    url.search = '';
    const segments = url.pathname.split('/').map((segment) => {
      if (!segment) return segment;
      if (segment.length > 32) return '[redacted]';
      return segment;
    });
    url.pathname = segments.join('/');
    return url.toString();
  } catch {
    return '';
  }
}

function normalizeMediaUrlForCache(mediaUrl: string): string {
  return sanitizeMediaUrl(mediaUrl);
}

function isBlobUrl(value: string): boolean {
  return value.startsWith('blob:');
}

function resolveMediaUrl(video: DetectedVideo, meta?: TranscriptCacheMeta): string {
  const metaUrl = typeof meta?.mediaUrl === 'string' ? meta.mediaUrl : '';
  if (metaUrl && !isBlobUrl(metaUrl)) {
    return metaUrl;
  }

  if (video.mediaUrl && !isBlobUrl(video.mediaUrl)) {
    return video.mediaUrl;
  }

  if (video.embedUrl && !isBlobUrl(video.embedUrl)) {
    return video.embedUrl;
  }

  return '';
}

async function buildFingerprint({
  provider,
  videoId,
  mediaUrlNormalized,
  durationMs,
}: {
  provider: string;
  videoId: string;
  mediaUrlNormalized: string;
  durationMs: number | null;
}): Promise<string> {
  const source = [provider, videoId, mediaUrlNormalized, durationMs ?? ''].join('|');
  return hashStringSha256(source);
}

function setCacheError(
  setState: React.Dispatch<React.SetStateAction<TranscriptCacheState>>,
  message: string,
) {
  setState((prev) => ({
    ...prev,
    status: 'error',
    error: message,
  }));
}

function ensureCacheReady(
  apiClient: ApiClient | null,
  input: TranscriptCacheInput,
  setState: React.Dispatch<React.SetStateAction<TranscriptCacheState>>,
): boolean {
  if (!apiClient?.cacheTranscript) {
    setCacheError(setState, 'Transcript caching is unavailable.');
    return false;
  }
  if (!input?.transcript || !input?.video) {
    setCacheError(setState, 'Transcript context is missing.');
    return false;
  }
  return true;
}

async function resolveCachePayload(input: TranscriptCacheInput) {
  const provider = input.video.provider || 'unknown';
  const videoId = input.video.id || '';
  const mediaUrl = resolveMediaUrl(input.video, input.meta);
  const mediaUrlNormalized =
    typeof input.meta?.mediaUrlNormalized === 'string'
      ? normalizeMediaUrlForCache(input.meta.mediaUrlNormalized)
      : normalizeMediaUrlForCache(mediaUrl);
  const durationMs =
    coerceNumber(input.meta?.durationMs) ??
    coerceNumber(input.transcript.durationMs) ??
    coerceNumber(input.video.durationMs);

  const fingerprint =
    input.fingerprint ||
    (await buildFingerprint({
      provider,
      videoId,
      mediaUrlNormalized,
      durationMs,
    }));

  return {
    provider,
    videoId,
    mediaUrl,
    mediaUrlNormalized,
    durationMs,
    fingerprint,
  };
}

export function useTranscriptCache(apiClient: ApiClient | null) {
  const [state, setState] = useState<TranscriptCacheState>(INITIAL_STATE);
  const cachedFingerprintsRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef<Set<string>>(new Set());

  const cacheTranscript = useCallback(
    async (input: TranscriptCacheInput): Promise<{ fingerprint: string } | null> => {
      const client = apiClient;
      if (!ensureCacheReady(client, input, setState)) {
        return null;
      }
      if (!client?.cacheTranscript) {
        return null;
      }

      const { provider, mediaUrl, mediaUrlNormalized, durationMs, fingerprint } =
        await resolveCachePayload(input);

      if (cachedFingerprintsRef.current.has(fingerprint)) {
        setState((prev) => ({
          ...prev,
          status: 'cached',
          lastFingerprint: fingerprint,
        }));
        return { fingerprint };
      }

      if (inFlightRef.current.has(fingerprint)) {
        return { fingerprint };
      }

      inFlightRef.current.add(fingerprint);
      setState((prev) => ({
        ...prev,
        status: 'caching',
        error: null,
      }));

      try {
        const meta: TranscriptCacheMeta = {
          mediaUrl: mediaUrl || undefined,
          mediaUrlNormalized: mediaUrlNormalized || undefined,
          etag: input.meta?.etag,
          lastModified: input.meta?.lastModified,
          durationMs,
        };

        await client.cacheTranscript({
          fingerprint,
          provider,
          transcript: input.transcript,
          meta,
        });

        cachedFingerprintsRef.current.add(fingerprint);
        setState({
          status: 'cached',
          error: null,
          lastFingerprint: fingerprint,
        });

        return { fingerprint };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to cache transcript.';
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: message,
        }));
        return null;
      } finally {
        inFlightRef.current.delete(fingerprint);
      }
    },
    [apiClient],
  );

  return {
    cacheTranscript,
    status: state.status,
    error: state.error,
    lastFingerprint: state.lastFingerprint,
  };
}
