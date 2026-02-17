import type { ApiClient, TranscriptCacheMeta } from '@api/client';
import type { DetectedVideo } from '@core/transcripts/types';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { TranscriptCacheInput, TranscriptCacheState } from './transcriptCacheTypes';

const HASH_SHIFT_BITS = 5;
const HASH_RADIX = 36;
const HEX_RADIX = 16;
const HEX_PAD_LENGTH = 2;
const MAX_PATH_SEGMENT_LENGTH = 32;

type TranscriptCacheSetter = Dispatch<SetStateAction<TranscriptCacheState>>;
type FingerprintSetRef = MutableRefObject<Set<string>>;
type CacheResult = { fingerprint: string } | null;

interface ResolvedCachePayload {
  provider: string;
  mediaUrl: string;
  mediaUrlNormalized: string;
  durationMs: number | null;
  fingerprint: string;
}

interface ExecuteCacheParams {
  client: ApiClient;
  input: TranscriptCacheInput;
  payload: ResolvedCachePayload;
  setState: TranscriptCacheSetter;
  cachedFingerprintsRef: FingerprintSetRef;
  inFlightRef: FingerprintSetRef;
}

export interface CacheTaskParams {
  apiClient: ApiClient | null;
  input: TranscriptCacheInput;
  setState: TranscriptCacheSetter;
  cachedFingerprintsRef: FingerprintSetRef;
  inFlightRef: FingerprintSetRef;
}

function coerceNumber(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function hashStringFallback(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << HASH_SHIFT_BITS) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(HASH_RADIX);
}

async function hashStringSha256(value: string): Promise<string> {
  if (
    typeof crypto === 'undefined' ||
    crypto.subtle === undefined ||
    typeof TextEncoder === 'undefined'
  ) {
    return hashStringFallback(value);
  }

  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(HEX_RADIX).padStart(HEX_PAD_LENGTH, '0'))
    .join('');
}

function sanitizeMediaUrl(mediaUrl: string): string {
  if (mediaUrl.length === 0) return '';
  try {
    const url = new URL(mediaUrl);
    url.hash = '';
    url.search = '';
    const segments = url.pathname.split('/').map((segment) => {
      if (segment.length === 0) return segment;
      if (segment.length > MAX_PATH_SEGMENT_LENGTH) return '[redacted]';
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
  if (metaUrl.length > 0 && !isBlobUrl(metaUrl)) {
    return metaUrl;
  }

  if (
    video.mediaUrl !== null &&
    video.mediaUrl !== undefined &&
    video.mediaUrl.length > 0 &&
    !isBlobUrl(video.mediaUrl)
  ) {
    return video.mediaUrl;
  }

  if (
    video.embedUrl !== null &&
    video.embedUrl !== undefined &&
    video.embedUrl.length > 0 &&
    !isBlobUrl(video.embedUrl)
  ) {
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

function setCacheError(setState: TranscriptCacheSetter, message: string): void {
  setState((prev) => ({
    ...prev,
    status: 'error',
    error: message,
  }));
}

function ensureCacheReady(
  apiClient: ApiClient | null,
  input: TranscriptCacheInput,
  setState: TranscriptCacheSetter,
): boolean {
  if (apiClient === null || apiClient.cacheTranscript === undefined) {
    setCacheError(setState, 'Transcript caching is unavailable.');
    return false;
  }
  if (input.transcript === null || input.video === null) {
    setCacheError(setState, 'Transcript context is missing.');
    return false;
  }
  return true;
}

async function resolveCachePayload(input: TranscriptCacheInput): Promise<ResolvedCachePayload> {
  const provider = input.video.provider.length > 0 ? input.video.provider : 'unknown';
  const videoId = input.video.id.length > 0 ? input.video.id : '';
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
    input.fingerprint !== undefined && input.fingerprint.length > 0
      ? input.fingerprint
      : await buildFingerprint({
          provider,
          videoId,
          mediaUrlNormalized,
          durationMs,
        });

  return {
    provider,
    mediaUrl,
    mediaUrlNormalized,
    durationMs,
    fingerprint,
  };
}

function markCachedState(setState: TranscriptCacheSetter, fingerprint: string): void {
  setState((prev) => ({
    ...prev,
    status: 'cached',
    lastFingerprint: fingerprint,
  }));
}

function markCachingState(setState: TranscriptCacheSetter): void {
  setState((prev) => ({
    ...prev,
    status: 'caching',
    error: null,
  }));
}

function markCacheSuccess(setState: TranscriptCacheSetter, fingerprint: string): void {
  setState({
    status: 'cached',
    error: null,
    lastFingerprint: fingerprint,
  });
}

function markCacheFailure(setState: TranscriptCacheSetter, error: unknown): void {
  const message = error instanceof Error ? error.message : 'Failed to cache transcript.';
  setState((prev) => ({
    ...prev,
    status: 'error',
    error: message,
  }));
}

function getCachedResult({
  fingerprint,
  setState,
  cachedFingerprintsRef,
}: {
  fingerprint: string;
  setState: TranscriptCacheSetter;
  cachedFingerprintsRef: FingerprintSetRef;
}): CacheResult {
  if (!cachedFingerprintsRef.current.has(fingerprint)) {
    return null;
  }
  markCachedState(setState, fingerprint);
  return { fingerprint };
}

function buildCacheMeta(
  input: TranscriptCacheInput,
  payload: ResolvedCachePayload,
): TranscriptCacheMeta {
  const meta: TranscriptCacheMeta = { durationMs: payload.durationMs };
  if (payload.mediaUrl.length > 0) {
    meta.mediaUrl = payload.mediaUrl;
  }
  if (payload.mediaUrlNormalized.length > 0) {
    meta.mediaUrlNormalized = payload.mediaUrlNormalized;
  }
  if (input.meta?.etag !== undefined && input.meta.etag.length > 0) {
    meta.etag = input.meta.etag;
  }
  if (input.meta?.lastModified !== undefined && input.meta.lastModified.length > 0) {
    meta.lastModified = input.meta.lastModified;
  }
  return meta;
}

async function executeCacheRequest({
  client,
  input,
  payload,
  setState,
  cachedFingerprintsRef,
  inFlightRef,
}: ExecuteCacheParams): Promise<CacheResult> {
  inFlightRef.current.add(payload.fingerprint);
  markCachingState(setState);

  try {
    await client.cacheTranscript({
      fingerprint: payload.fingerprint,
      provider: payload.provider,
      transcript: input.transcript,
      meta: buildCacheMeta(input, payload),
    });
    cachedFingerprintsRef.current.add(payload.fingerprint);
    markCacheSuccess(setState, payload.fingerprint);
    return { fingerprint: payload.fingerprint };
  } catch (error) {
    markCacheFailure(setState, error);
    return null;
  } finally {
    inFlightRef.current.delete(payload.fingerprint);
  }
}

export async function runCacheTranscriptTask({
  apiClient,
  input,
  setState,
  cachedFingerprintsRef,
  inFlightRef,
}: CacheTaskParams): Promise<CacheResult> {
  if (!ensureCacheReady(apiClient, input, setState)) {
    return null;
  }
  if (apiClient === null || apiClient.cacheTranscript === undefined) {
    return null;
  }

  const payload = await resolveCachePayload(input);
  const cachedResult = getCachedResult({
    fingerprint: payload.fingerprint,
    setState,
    cachedFingerprintsRef,
  });
  if (cachedResult !== null) {
    return cachedResult;
  }
  if (inFlightRef.current.has(payload.fingerprint)) {
    return { fingerprint: payload.fingerprint };
  }

  return executeCacheRequest({
    client: apiClient,
    input,
    payload,
    setState,
    cachedFingerprintsRef,
    inFlightRef,
  });
}
