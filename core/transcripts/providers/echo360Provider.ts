/**
 * Echo360 Transcript Provider
 *
 * Handles detection and transcript extraction for Echo360 videos.
 *
 * Detection:
 * - Direct Echo360 URLs (user on echo360 domain)
 * - Embedded iframes (Echo360 in LMS pages)
 *
 * Extraction:
 * 1. JSON transcript endpoint: /api/ui/echoplayer/lessons/{lessonId}/medias/{mediaId}/transcript
 * 2. VTT transcript file
 * 3. Text transcript file
 */

import type {
  DetectedVideo,
  VideoDetectionContext,
  TranscriptExtractionResult,
  TranscriptResult,
  TranscriptSegment,
} from '../types';
import type { TranscriptProviderV2 } from '../providerRegistry';
import type { AsyncFetcher } from '../fetchers/types';
import { hasRedirectSupport } from '../fetchers/types';
import { parseWebVtt } from '../webvttParser';

// ============================================================================
// Constants
// ============================================================================

const LOG_PREFIX = '[Lock-in Transcript:Echo360]';

const ECHO360_DOMAIN_SUFFIXES = [
  'echo360.org',
  'echo360.org.au',
  'echo360.net.au',
  'echo360.ca',
  'echo360.org.uk',
  'echo360qa.org',
  'echo360qa.dev',
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;
const SYLLABUS_CACHE_TTL_MS = 5 * 60 * 1000;

const syllabusCache = new Map<
  string,
  { data: DetectedVideo[]; timestamp: number }
>();

// ============================================================================
// Types
// ============================================================================

export interface Echo360Info {
  lessonId?: string;
  mediaId?: string;
  baseUrl: string;
}

/**
 * Echo360 syllabus API response types
 */
interface Echo360SyllabusMedia {
  id?: string;
  mediaId?: string;
  media_id?: string;
  mediaType?: string;
  title?: string;
  name?: string;
  isAvailable?: boolean;
  isHiddenDueToCaptions?: boolean;
  isProcessing?: boolean;
  isFailed?: boolean;
  isPreliminary?: boolean;
  isAudioOnly?: boolean;
  lessonId?: string;
  lesson_id?: string;
}

interface Echo360SyllabusLesson {
  id?: string;
  lessonId?: string;
  lesson_id?: string;
  name?: string;
  displayName?: string;
  title?: string;
  timing?: {
    start?: string;
    end?: string;
  };
  isFolderLesson?: boolean;
}

interface Echo360SyllabusEntry {
  lesson?: Echo360SyllabusLesson | { lesson?: Echo360SyllabusLesson; medias?: Echo360SyllabusMedia[] };
  medias?: Echo360SyllabusMedia[];
  media?: Echo360SyllabusMedia | Echo360SyllabusMedia[];
}

interface Echo360SyllabusResponse {
  status?: string;
  message?: string;
  data?: Echo360SyllabusEntry[];
}

type UnknownRecord = Record<string, unknown>;

/**
 * Extract section ID from Echo360 URL
 * URL format: /section/{sectionId}/* or /section/{sectionId}
 */
export function extractSectionId(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Match /section/{uuid}
    const match = parsed.pathname.match(
      /\/section\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
    );
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Check if URL is an Echo360 section/course page (not a single lesson view)
 */
export function isEcho360SectionPage(url: string): boolean {
  // Must be an Echo360 URL first
  if (!isEcho360Url(url)) return false;
  
  const sectionId = extractSectionId(url);
  if (!sectionId) return false;
  
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    // It's a section page if we're not on a specific lesson page
    // Lesson pages have /lesson/{lessonId} in the path
    const isLessonPage = /\/lessons?\/[^/]+/.test(path);
    return !isLessonPage;
  } catch {
    return false;
  }
}

/**
 * Build syllabus API URL
 * Format: /section/{sectionId}/syllabus
 */
function buildSyllabusUrl(baseUrl: string, sectionId: string): string {
  return `${baseUrl}/section/${encodeURIComponent(sectionId)}/syllabus`;
}

/**
 * Build lesson page URL for a specific lesson
 */
function buildLessonPageUrl(baseUrl: string, lessonId: string): string {
  return `${baseUrl}/lesson/${encodeURIComponent(lessonId)}/classroom`;
}

// ----------------------------------------------------------------------------
// Syllabus Parsing Helpers
// ----------------------------------------------------------------------------

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== 'object') return null;
  return value as UnknownRecord;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Normalize boolean flags from unknown values.
 */
function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  return undefined;
}

function normalizeLessonId(value: unknown): string | null {
  return readString(value);
}

function normalizeMediaId(value: unknown): string | null {
  const raw = readString(value);
  if (!raw) return null;
  const trimmed = raw.trim();
  const braceMatch = trimmed.match(/^\{?([0-9a-fA-F-]{36})\}?$/);
  if (braceMatch && UUID_REGEX.test(braceMatch[1])) {
    return braceMatch[1].toLowerCase();
  }
  if (UUID_REGEX.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return trimmed;
}

function extractLessonIdFromRecord(record: UnknownRecord | null): string | null {
  if (!record) return null;
  return normalizeLessonId(record.id ?? record.lessonId ?? record.lesson_id);
}

function extractLessonNameFromRecord(record: UnknownRecord | null): string {
  if (!record) return '';
  return (
    readString(record.displayName) ||
    readString(record.name) ||
    readString(record.title) ||
    ''
  );
}

function extractTimingStart(record: UnknownRecord | null): string | null {
  if (!record) return null;
  const timing = asRecord(record.timing);
  if (timing) {
    return (
      readString(timing.start) ||
      readString(timing.startTime) ||
      readString(timing.startsAt)
    );
  }
  return null;
}

function extractMediaIdFromRecord(record: UnknownRecord | null): string | null {
  if (!record) return null;
  return normalizeMediaId(record.mediaId ?? record.media_id ?? record.id);
}

function extractMediaTitle(record: UnknownRecord | null): string | null {
  if (!record) return null;
  return (
    readString(record.title) ||
    readString(record.name) ||
    readString(record.displayName)
  );
}

/**
 * Extract the raw media type value without normalization.
 */
function extractMediaTypeRaw(record: UnknownRecord | null): string | null {
  if (!record) return null;
  return readString(record.mediaType ?? record.media_type ?? record.type ?? record.kind);
}

function normalizeMediaType(value: unknown): string | null {
  const raw = readString(value);
  return raw ? raw.toLowerCase() : null;
}

function extractMediaType(record: UnknownRecord | null): string | null {
  return normalizeMediaType(extractMediaTypeRaw(record));
}

function extractSyllabusEntries(response: unknown): Echo360SyllabusEntry[] | null {
  const payload = asRecord(response);
  if (!payload) return null;
  if (Array.isArray(payload.data)) {
    return payload.data as Echo360SyllabusEntry[];
  }
  if (Array.isArray(payload.lessons)) {
    return payload.lessons as Echo360SyllabusEntry[];
  }
  const dataRecord = asRecord(payload.data);
  if (dataRecord && Array.isArray(dataRecord.lessons)) {
    return dataRecord.lessons as Echo360SyllabusEntry[];
  }
  return null;
}

function collectMediaRecords(...candidates: unknown[]): UnknownRecord[] {
  const records: UnknownRecord[] = [];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const record = asRecord(item);
        if (record) records.push(record);
      }
      continue;
    }
    const record = asRecord(candidate);
    if (record) records.push(record);
  }
  return records;
}

function formatLessonDateLabel(start: string | null): string {
  if (!start) return '';
  try {
    const date = new Date(start);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function buildSyllabusTitle(baseTitle: string, _dateLabel: string, fallback: string): string {
  // Date label is no longer appended to titles (removed per UI change)
  const title = baseTitle || fallback;
  return title;
}

function appendAudioSuffix(title: string, isAudioContent: boolean): string {
  if (!isAudioContent) return title;
  if (!title) return 'Echo360 audio';
  return `${title} (Audio)`;
}

function getUniqueKey(mediaId: string | null, lessonId: string | null): string | null {
  if (mediaId) return `media:${mediaId}`;
  if (lessonId) return `lesson:${lessonId}`;
  return null;
}

/**
 * Validate Echo360 syllabus response shape.
 */
function validateSyllabusResponse(response: unknown): response is Echo360SyllabusResponse {
  const payload = asRecord(response);
  if (!payload) return false;
  const entries = extractSyllabusEntries(response);
  if (!entries || !Array.isArray(entries)) return false;
  if (entries.length > 0 && !entries.some(entry => asRecord(entry))) {
    return false;
  }
  return true;
}

/**
 * Read known status flags from syllabus media records.
 */
function getMediaStatusSnapshot(media: UnknownRecord): {
  isAvailable?: boolean;
  isProcessing?: boolean;
  isFailed?: boolean;
  isPreliminary?: boolean;
  isHiddenDueToCaptions?: boolean;
  isAudioOnly?: boolean;
} {
  return {
    isAvailable: readBoolean(media.isAvailable),
    isProcessing: readBoolean(media.isProcessing),
    isFailed: readBoolean(media.isFailed),
    isPreliminary: readBoolean(media.isPreliminary),
    isHiddenDueToCaptions: readBoolean(media.isHiddenDueToCaptions),
    isAudioOnly: readBoolean(media.isAudioOnly),
  };
}

/**
 * Determine if a media item is ready for transcript extraction.
 */
function isMediaReadyForTranscript(media: UnknownRecord): boolean {
  return getMediaStatusSkipReason(media) === null;
}

/**
 * Provide a skip reason for media not ready for transcripts.
 */
function getMediaStatusSkipReason(
  media: UnknownRecord
): { code: TranscriptExtractionResult['errorCode']; reason: string } | null {
  const status = getMediaStatusSnapshot(media);
  if (status.isAvailable === false) {
    return { code: 'NOT_AVAILABLE', reason: 'Media is not available' };
  }
  if (status.isProcessing === true) {
    return { code: 'MEDIA_PROCESSING', reason: 'Media is still processing' };
  }
  if (status.isFailed === true) {
    return { code: 'MEDIA_FAILED', reason: 'Media processing failed' };
  }
  if (status.isPreliminary === true) {
    return { code: 'MEDIA_PRELIMINARY', reason: 'Media is preliminary' };
  }
  if (status.isHiddenDueToCaptions === true) {
    return { code: 'MEDIA_HIDDEN', reason: 'Media hidden due to captions' };
  }
  return null;
}

/**
 * Parse syllabus response and extract video information
 */
function parseSyllabusResponse(
  response: unknown,
  baseUrl: string,
  requestId: string
): DetectedVideo[] {
  const videos: DetectedVideo[] = [];
  const seenIds = new Set<string>();

  if (!validateSyllabusResponse(response)) {
    const responseRecord = asRecord(response);
    log('warn', requestId, 'Invalid syllabus response', {
      responseType: typeof response,
      responseKeys: responseRecord ? Object.keys(responseRecord) : null,
    });
    return videos;
  }

  const syllabusData = response as Echo360SyllabusResponse;
  const entries = extractSyllabusEntries(response) ?? [];

  if (syllabusData.status && syllabusData.status !== 'ok') {
    log('warn', requestId, 'Syllabus response status not ok', {
      status: syllabusData.status,
    });
  }

  if (entries.length === 0) {
    log('warn', requestId, 'Syllabus response missing entries', {
      hasEntries: true,
    });
    return videos;
  }

  for (const entry of entries) {
    const entryRecord = asRecord(entry);
    if (!entryRecord) continue;

    const lessonWrapper = asRecord(entryRecord.lesson);
    const nestedLesson = lessonWrapper ? asRecord(lessonWrapper.lesson) : null;
    const lessonRecord = nestedLesson || lessonWrapper || entryRecord;
    const lessonId =
      extractLessonIdFromRecord(nestedLesson) ||
      extractLessonIdFromRecord(lessonWrapper) ||
      extractLessonIdFromRecord(entryRecord);
    const lessonName = extractLessonNameFromRecord(lessonRecord);
    const timingStart =
      extractTimingStart(lessonRecord) || extractTimingStart(lessonWrapper);
    const dateLabel = formatLessonDateLabel(timingStart);
    const isFolderLesson =
      (lessonRecord as Echo360SyllabusLesson | null)?.isFolderLesson === true ||
      (lessonWrapper as Echo360SyllabusLesson | null)?.isFolderLesson === true;

    const mediaRecords = collectMediaRecords(
      entryRecord.medias,
      entryRecord.media,
      lessonWrapper?.medias,
      lessonWrapper?.media,
      (lessonRecord as UnknownRecord | null)?.medias,
      (lessonRecord as UnknownRecord | null)?.media
    );

    let addedMedia = false;
    let hasMediaId = false;

    for (const mediaRecord of mediaRecords) {
      const mediaId = extractMediaIdFromRecord(mediaRecord);
      if (!mediaId) continue;
      hasMediaId = true;

      const mediaTypeRaw = extractMediaTypeRaw(mediaRecord);
      const mediaType = normalizeMediaType(mediaTypeRaw);
      const isAudioOnly = readBoolean(mediaRecord.isAudioOnly) === true;
      const isVideoType =
        mediaTypeRaw === 'Video' ||
        mediaType === 'video' ||
        (mediaType ? mediaType.startsWith('video/') : false);
      const isAudioType =
        mediaTypeRaw === 'Audio' ||
        mediaType === 'audio' ||
        (mediaType ? mediaType.startsWith('audio/') : false);
      const isSupported =
        isVideoType || isAudioType || isAudioOnly || (!mediaTypeRaw && !mediaType);

      if (!isSupported) {
        log('info', requestId, 'Skipping non-video/non-audio media', {
          mediaId,
          mediaType: mediaTypeRaw ?? mediaType,
          mediaTypeNormalized: mediaType,
          isAudioOnly,
        });
        logMediaStatus(requestId, mediaRecord, mediaId, {
          skipReason: 'UNSUPPORTED_MEDIA_TYPE',
        });
        continue;
      }

      if (!isMediaReadyForTranscript(mediaRecord)) {
        const skipReason = getMediaStatusSkipReason(mediaRecord);
        log('info', requestId, 'Skipping media due to status', {
          mediaId,
          reason: skipReason?.reason,
          errorCode: skipReason?.code,
        });
        logMediaStatus(requestId, mediaRecord, mediaId, {
          skipReason: skipReason?.code,
        });
        continue;
      }

      const mediaLessonId =
        lessonId || extractLessonIdFromRecord(mediaRecord);
      if (!mediaLessonId) {
        log('warn', requestId, 'Media entry missing lessonId', { mediaId });
        continue;
      }

      const key = getUniqueKey(mediaId, mediaLessonId);
      if (key && seenIds.has(key)) continue;
      if (key) seenIds.add(key);

      // Prefer lesson's displayName over media title for consistency
      const mediaTitle = lessonName || extractMediaTitle(mediaRecord) || '';
      const titleWithDate = appendAudioSuffix(
        buildSyllabusTitle(
          mediaTitle,
          dateLabel,
          'Echo360 video'
        ),
        isAudioOnly || isAudioType
      );

      videos.push({
        id: mediaId,
        provider: 'echo360',
        title: titleWithDate,
        embedUrl: buildLessonPageUrl(baseUrl, mediaLessonId),
        echoLessonId: mediaLessonId,
        echoMediaId: mediaId,
        echoBaseUrl: baseUrl,
      });

      addedMedia = true;
    }

    if (!addedMedia && !hasMediaId && lessonId && !isFolderLesson) {
      const key = getUniqueKey(null, lessonId);
      if (key && seenIds.has(key)) continue;
      if (key) seenIds.add(key);

      const titleWithDate = buildSyllabusTitle(
        lessonName,
        dateLabel,
        'Echo360 lesson'
      );

      videos.push({
        id: lessonId,
        provider: 'echo360',
        title: titleWithDate,
        embedUrl: buildLessonPageUrl(baseUrl, lessonId),
        echoLessonId: lessonId,
        echoMediaId: undefined, // Will be resolved when extracting transcript
        echoBaseUrl: baseUrl,
      });
    }
  }

  log('info', requestId, 'Parsed syllabus videos', { 
    count: videos.length,
    entriesProcessed: entries.length,
  });

  return videos;
}

/**
 * Fetch videos from Echo360 syllabus API
 */
async function fetchVideosFromSyllabus(
  pageUrl: string,
  fetcher: AsyncFetcher,
  requestId: string
): Promise<DetectedVideo[]> {
  const sectionId = extractSectionId(pageUrl);
  if (!sectionId) {
    log('info', requestId, 'Not a section page, skipping syllabus fetch');
    return [];
  }

  let baseUrl = '';
  try {
    baseUrl = new URL(pageUrl).origin;
  } catch {
    log('warn', requestId, 'Invalid page URL for syllabus fetch', { pageUrl });
    return [];
  }

  const cacheKey = `${baseUrl}|${sectionId}`;
  const cached = syllabusCache.get(cacheKey);
  if (cached) {
    const ageMs = Date.now() - cached.timestamp;
    if (ageMs < SYLLABUS_CACHE_TTL_MS) {
      log('debug', requestId, 'Syllabus cache hit', { sectionId, baseUrl, ageMs });
      return cached.data;
    }
    syllabusCache.delete(cacheKey);
    log('debug', requestId, 'Syllabus cache expired', { sectionId, baseUrl, ageMs });
  } else {
    log('debug', requestId, 'Syllabus cache miss', { sectionId, baseUrl });
  }

  try {
    const syllabusUrl = buildSyllabusUrl(baseUrl, sectionId);
    
    log('info', requestId, 'Fetching syllabus API', { syllabusUrl, sectionId });
    
    const syllabusData = await fetchWithRetry<unknown>(fetcher, syllabusUrl, {
      requestId,
      responseType: 'json',
      context: 'syllabus',
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    const videos = parseSyllabusResponse(syllabusData, baseUrl, requestId);
    if (validateSyllabusResponse(syllabusData)) {
      syllabusCache.set(cacheKey, { data: videos, timestamp: Date.now() });
    }
    return videos;
  } catch (error) {
    log('warn', requestId, 'Failed to fetch syllabus', {
      error: error instanceof Error ? error.message : String(error),
    });
    syllabusCache.delete(cacheKey);
    return [];
  }
}

// ============================================================================
// Logging Utilities
// ============================================================================

function createRequestId(): string {
  return `echo360-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function log(
  level: 'debug' | 'info' | 'warn' | 'error',
  requestId: string,
  message: string,
  meta?: Record<string, unknown>
): void {
  const logFn =
    level === 'error'
      ? console.error
      : level === 'warn'
        ? console.warn
        : level === 'debug'
          ? console.debug
          : console.info;
  const msg = `${LOG_PREFIX} [${requestId}] ${message}`;
  meta ? logFn(msg, meta) : logFn(msg);
}

/**
 * Log media status flags for debugging.
 */
function logMediaStatus(
  requestId: string,
  media: UnknownRecord,
  mediaId: string | null,
  context?: Record<string, unknown>
): void {
  const status = getMediaStatusSnapshot(media);
  const mediaTypeRaw = extractMediaTypeRaw(media);
  const mediaType = extractMediaType(media);
  log('debug', requestId, 'Echo360 media status', {
    mediaId,
    mediaType: mediaTypeRaw ?? mediaType,
    mediaTypeNormalized: mediaType,
    ...status,
    ...context,
  });
}

// ============================================================================
// Domain & URL Helpers
// ============================================================================

export function isEcho360Domain(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return ECHO360_DOMAIN_SUFFIXES.some(
    suffix => normalized === suffix || normalized.endsWith(`.${suffix}`)
  );
}

export function isEcho360Url(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return isEcho360Domain(url.hostname);
  } catch {
    return rawUrl.toLowerCase().includes('echo360');
  }
}

function safeDecodeUri(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

// ============================================================================
// ID Extraction
// ============================================================================

/**
 * Extract lessonId from URL pathname
 * Lesson IDs can be complex: G_{uuid}_{uuid}_{timestamp}_{timestamp}
 */
function extractLessonIdFromPath(pathname: string): string | null {
  // Match /lesson/{complex-lesson-id} or /lessons/{complex-lesson-id}
  const match = pathname.match(/\/lessons?\/([^\/]+)/i);
  if (match?.[1]) {
    return safeDecodeUri(match[1]);
  }
  return null;
}

/**
 * Extract mediaId from URL pathname (standard UUID format)
 */
function extractMediaIdFromPath(pathname: string): string | null {
  // Match /media/{uuid} or /medias/{uuid}
  const match = pathname.match(/\/medias?\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Extract Echo360 info from a URL
 */
export function extractEcho360Info(rawUrl: string): Echo360Info | null {
  try {
    // First check if this URL contains an embedded Echo360 URL (e.g., LTI launch URLs)
    const decoded = safeDecodeUri(rawUrl);
    
    // Look for embedded Echo360 URL in query params
    try {
      const outerUrl = new URL(decoded);
      for (const [, value] of outerUrl.searchParams.entries()) {
        const decodedValue = safeDecodeUri(value);
        if (decodedValue.includes('echo360')) {
          const innerInfo = extractEcho360Info(decodedValue);
          if (innerInfo?.lessonId || innerInfo?.mediaId) {
            return innerInfo;
          }
        }
      }
    } catch {
      // Not a valid URL with params, continue
    }
    
    const url = new URL(decoded);
    
    if (!isEcho360Domain(url.hostname)) {
      return null;
    }

    const lessonId = extractLessonIdFromPath(url.pathname);
    const mediaId = extractMediaIdFromPath(url.pathname);

    // Also check query params
    const paramLessonId = url.searchParams.get('lessonId') || url.searchParams.get('lesson_id');
    const paramMediaId = url.searchParams.get('mediaId') || url.searchParams.get('media_id');

    return {
      lessonId: lessonId || paramLessonId || undefined,
      mediaId: mediaId || (paramMediaId ? paramMediaId.toLowerCase() : undefined),
      baseUrl: url.origin,
    };
  } catch {
    return null;
  }
}

/**
 * Extract mediaId from HTML content using multiple patterns
 */
function extractMediaIdFromHtml(html: string): string | null {
  // Pattern 1: JSON property "mediaId": "uuid" - various forms
  const jsonPatterns = [
    /"mediaId"\s*:\s*"([0-9a-f-]{36})"/i,
    /"media_id"\s*:\s*"([0-9a-f-]{36})"/i,
    /'mediaId'\s*:\s*'([0-9a-f-]{36})'/i,
    // id property inside medias arrays
    /"medias"\s*:\s*\[\s*\{[^}]*"id"\s*:\s*"([0-9a-f-]{36})"/i,
  ];
  
  for (const pattern of jsonPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1].toLowerCase();
    }
  }

  // Pattern 2: URL patterns in HTML
  // /api/ui/echoplayer/lessons/{lessonId}/medias/{mediaId}/transcript
  const urlPatterns = [
    /\/medias\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/transcript/i,
    /\/medias\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    /\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    /\/interactive-media\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    // captions-{mediaId} pattern seen in network requests
    /captions-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  ];

  for (const pattern of urlPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1].toLowerCase();
    }
  }

  // Pattern 3: data attributes
  const dataMatch = html.match(/data-media-id\s*=\s*["']([0-9a-f-]{36})["']/i);
  if (dataMatch?.[1]) {
    return dataMatch[1].toLowerCase();
  }

  return null;
}

/**
 * Build lesson info API URL to get medias
 * Format: /api/ui/echoplayer/lessons/{lessonId}
 */
function buildLessonInfoUrl(baseUrl: string, lessonId: string): string {
  return `${baseUrl}/api/ui/echoplayer/lessons/${encodeURIComponent(lessonId)}`;
}

/**
 * Extract mediaId from lesson API response
 */
function extractMediaIdFromLessonInfo(lessonData: unknown): string | null {
  if (!lessonData || typeof lessonData !== 'object') return null;
  
  const data = lessonData as Record<string, unknown>;
  
  // Check for direct medias array
  if (Array.isArray(data.medias) && data.medias.length > 0) {
    const firstMedia = data.medias[0] as Record<string, unknown>;
    if (typeof firstMedia?.id === 'string') {
      return firstMedia.id.toLowerCase();
    }
    if (typeof firstMedia?.mediaId === 'string') {
      return firstMedia.mediaId.toLowerCase();
    }
  }
  
  // Check for data wrapper
  if (data.data && typeof data.data === 'object') {
    return extractMediaIdFromLessonInfo(data.data);
  }
  
  // Check for lesson wrapper
  if (data.lesson && typeof data.lesson === 'object') {
    return extractMediaIdFromLessonInfo(data.lesson);
  }
  
  // Check for medias in nested structure
  const nestedKeys = ['video', 'media', 'content', 'sections'];
  for (const key of nestedKeys) {
    if (data[key] && typeof data[key] === 'object') {
      const nested = data[key] as Record<string, unknown>;
      if (Array.isArray(nested.medias) && nested.medias.length > 0) {
        const firstMedia = nested.medias[0] as Record<string, unknown>;
        if (typeof firstMedia?.id === 'string') {
          return firstMedia.id.toLowerCase();
        }
      }
    }
  }
  
  return null;
}

/**
 * Parse Echo360 info from HTML page content
 */
function parseEcho360InfoFromHtml(html: string, pageUrl: string): Echo360Info | null {
  const baseInfo = extractEcho360Info(pageUrl);
  const mediaId = extractMediaIdFromHtml(html);

  if (baseInfo) {
    return {
      ...baseInfo,
      mediaId: mediaId || baseInfo.mediaId,
    };
  }

  if (mediaId) {
    try {
      const url = new URL(pageUrl);
      return { mediaId, baseUrl: url.origin };
    } catch {
      return null;
    }
  }

  return null;
}

// ============================================================================
// URL Builders
// ============================================================================

/**
 * Build transcript JSON API URL
 * Format: /api/ui/echoplayer/lessons/{lessonId}/medias/{mediaId}/transcript
 */
function buildTranscriptUrl(baseUrl: string, lessonId: string, mediaId: string): string {
  return `${baseUrl}/api/ui/echoplayer/lessons/${encodeURIComponent(lessonId)}/medias/${encodeURIComponent(mediaId)}/transcript`;
}

/**
 * Build transcript file URL (VTT or text format)
 */
function buildTranscriptFileUrl(baseUrl: string, lessonId: string, mediaId: string, format: 'vtt' | 'text'): string {
  return `${baseUrl}/api/ui/echoplayer/lessons/${encodeURIComponent(lessonId)}/medias/${encodeURIComponent(mediaId)}/transcript-file?format=${format}`;
}

/**
 * Build lesson classroom page URL
 */
function buildClassroomUrl(baseUrl: string, lessonId: string): string {
  return `${baseUrl}/lesson/${encodeURIComponent(lessonId)}/classroom`;
}

// ============================================================================
// Transcript Parsing
// ============================================================================

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeSpeaker(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const trimmed = raw.trim();
  const match = trimmed.match(/^speaker\s*(\d+)$/i);
  if (match) {
    const idx = parseInt(match[1], 10);
    return idx === 0 ? 'Speaker' : `Speaker ${idx}`;
  }
  return trimmed;
}

function normalizeConfidence(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw >= 0 && raw <= 1 ? raw : raw > 1 && raw <= 100 ? raw / 100 : undefined;
  }
  // Handle object with average/avg property
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const value = obj.average ?? obj.avg ?? obj.raw ?? obj.score;
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value >= 0 && value <= 1 ? value : value > 1 && value <= 100 ? value / 100 : undefined;
    }
  }
  return undefined;
}

function buildTranscriptResult(segments: TranscriptSegment[]): TranscriptResult {
  const plainText = segments.map(s => s.text).join(' ').trim();
  const lastSegment = segments[segments.length - 1];
  return {
    plainText,
    segments,
    durationMs: lastSegment?.endMs ?? lastSegment?.startMs,
  };
}

/**
 * Extract transcript cues from Echo360 JSON payloads.
 */
function extractEcho360TranscriptCues(raw: unknown): UnknownRecord[] | null {
  const payload = asRecord(raw);
  if (!payload) return null;

  let cuesValue: unknown = payload.cues;

  if (!Array.isArray(cuesValue) && payload.contentJson) {
    try {
      const contentJson =
        typeof payload.contentJson === 'string'
          ? JSON.parse(payload.contentJson)
          : payload.contentJson;
      cuesValue = (contentJson as Record<string, unknown>)?.cues;
    } catch {
      return null;
    }
  }

  if (!Array.isArray(cuesValue)) return null;
  const cues = cuesValue
    .map(cue => asRecord(cue))
    .filter((cue): cue is UnknownRecord => Boolean(cue));
  if (cues.length === 0 && cuesValue.length > 0) return null;
  return cues;
}

/**
 * Parse Echo360 JSON transcript response
 */
export function normalizeEcho360TranscriptJson(raw: unknown): TranscriptResult | null {
  const cues = extractEcho360TranscriptCues(raw);
  if (!cues || cues.length === 0) return null;

  const segments: TranscriptSegment[] = [];

  for (const record of cues) {
    const startMs = Math.max(0, Math.round(
      typeof record.startMs === 'number' ? record.startMs : 
      typeof record.start === 'number' ? record.start : 0
    ));
    const endMs = Math.max(startMs, Math.round(
      typeof record.endMs === 'number' ? record.endMs :
      typeof record.end === 'number' ? record.end : startMs
    ));
    
    const text = cleanText(String(record.content ?? record.text ?? ''));
    if (!text) continue;

    segments.push({
      startMs,
      endMs,
      text,
      speaker: normalizeSpeaker(record.speaker),
      confidence: normalizeConfidence(record.confidence),
    });
  }

  return segments.length > 0 ? buildTranscriptResult(segments) : null;
}

// ============================================================================
// Fetching Utilities
// ============================================================================

/**
 * Create a timeout error with a standardized code.
 */
function createTimeoutError(message: string): Error {
  const error = new Error(message);
  (error as { code?: string }).code = 'TIMEOUT';
  return error;
}

/**
 * Check if an error represents a timeout.
 */
function isTimeoutError(error: unknown): boolean {
  if (!error) return false;
  const code = (error as { code?: string }).code;
  if (code === 'TIMEOUT') return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes('timeout') || message.includes('AbortError');
}

/**
 * Extract HTTP status from a thrown error or message.
 */
function extractErrorStatus(error: unknown): number | null {
  if (!error) return null;
  const status = (error as { status?: number }).status;
  if (typeof status === 'number') return status;
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/\bHTTP\s+(\d{3})\b/i);
  return match ? Number(match[1]) : null;
}

/**
 * Decide whether an error should be retried.
 */
function isRetryableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'AUTH_REQUIRED') return false;

  const status = extractErrorStatus(error);
  if (typeof status === 'number') {
    if (status >= 400 && status < 500) return false;
  }

  const code = (error as { code?: string }).code;
  if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'EAI_AGAIN') {
    return true;
  }

  if (isTimeoutError(error)) return true;

  return (
    message.includes('NetworkError') ||
    message.includes('Failed to fetch') ||
    message.includes('Network request failed')
  );
}

/**
 * Delay helper for retry backoff.
 */
function sleep(delayMs: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

/**
 * Wrap a promise with a timeout.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(createTimeoutError(errorMessage)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Fetch with retry and exponential backoff for transient failures.
 */
async function fetchWithRetry<T>(
  fetcher: AsyncFetcher,
  url: string,
  options: {
    requestId: string;
    responseType: 'json' | 'text';
    context: string;
    maxRetries?: number;
    retryDelayMs?: number;
    timeoutMs?: number;
  }
): Promise<T> {
  const {
    requestId,
    responseType,
    context,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  let attempt = 0;

  while (true) {
    try {
      const request =
        responseType === 'json'
          ? fetcher.fetchJson<T>(url)
          : (fetcher.fetchWithCredentials(url) as unknown as Promise<T>);
      return await withTimeout(
        request,
        timeoutMs,
        `${context} request timed out after ${timeoutMs}ms`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isTimeoutError(error)) {
        log('warn', requestId, 'Request timed out', { url, context, timeoutMs });
      }

      if (!isRetryableError(error) || attempt >= maxRetries) {
        if (attempt >= maxRetries) {
          log('warn', requestId, 'Retry limit reached', {
            url,
            context,
            maxRetries,
            error: message,
          });
        }
        throw error;
      }

      const delayMs = retryDelayMs * Math.pow(2, attempt);
      log('info', requestId, 'Retrying request', {
        url,
        context,
        attempt: attempt + 1,
        maxRetries,
        delayMs,
        error: message,
      });
      await sleep(delayMs);
      attempt += 1;
    }
  }
}

async function fetchHtmlWithRedirect(
  url: string,
  fetcher: AsyncFetcher
): Promise<{ html: string; finalUrl: string }> {
  if (hasRedirectSupport(fetcher) && fetcher.fetchHtmlWithRedirectInfo) {
    const result = await fetcher.fetchHtmlWithRedirectInfo(url);
    return { html: result.html, finalUrl: result.finalUrl || url };
  }
  const html = await fetcher.fetchWithCredentials(url);
  return { html, finalUrl: url };
}

// ============================================================================
// Main Resolution Logic
// ============================================================================

/**
 * Resolve complete Echo360 info (lessonId + mediaId) from embed URL
 * Uses multiple strategies:
 * 1. Direct URL parsing
 * 2. Fetch classroom page and extract from HTML
 */
async function resolveEcho360Info(
  embedUrl: string,
  fetcher: AsyncFetcher,
  requestId: string
): Promise<Echo360Info | null> {
  log('info', requestId, 'Resolving Echo360 info', { embedUrl });

  // Strategy 1: Extract directly from URL
  const directInfo = extractEcho360Info(embedUrl);
  log('info', requestId, 'Direct URL extraction', {
    lessonId: directInfo?.lessonId,
    mediaId: directInfo?.mediaId,
    baseUrl: directInfo?.baseUrl,
  });

  if (directInfo?.lessonId && directInfo?.mediaId) {
    log('info', requestId, 'Resolved from direct URL');
    return directInfo;
  }

  // Strategy 2: Fetch classroom page to get mediaId from HTML
  if (directInfo?.lessonId && directInfo?.baseUrl) {
    try {
      const classroomUrl = buildClassroomUrl(directInfo.baseUrl, directInfo.lessonId);
      log('info', requestId, 'Fetching classroom page', { classroomUrl });
      
      const { html, finalUrl } = await fetchHtmlWithRedirect(classroomUrl, fetcher);
      log('info', requestId, 'Classroom page fetched', { 
        htmlLength: html.length, 
        finalUrl 
      });

      const htmlInfo = parseEcho360InfoFromHtml(html, finalUrl);
      if (htmlInfo?.mediaId) {
        const resolved: Echo360Info = {
          lessonId: directInfo.lessonId,
          mediaId: htmlInfo.mediaId,
          baseUrl: directInfo.baseUrl,
        };
        log('info', requestId, 'Resolved mediaId from classroom HTML', { 
          mediaId: resolved.mediaId 
        });
        return resolved;
      }
      
      log('warn', requestId, 'No mediaId found in classroom HTML');
    } catch (error) {
      log('warn', requestId, 'Classroom fetch failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Strategy 2b: Fetch lesson info from API to get mediaId
    try {
      const lessonInfoUrl = buildLessonInfoUrl(directInfo.baseUrl, directInfo.lessonId);
      log('info', requestId, 'Fetching lesson info from API', { lessonInfoUrl });
      
      const lessonData = await fetcher.fetchJson<unknown>(lessonInfoUrl);
      log('info', requestId, 'Lesson info fetched', { 
        hasData: !!lessonData,
        dataType: typeof lessonData,
      });
      
      const mediaId = extractMediaIdFromLessonInfo(lessonData);
      if (mediaId) {
        const resolved: Echo360Info = {
          lessonId: directInfo.lessonId,
          mediaId,
          baseUrl: directInfo.baseUrl,
        };
        log('info', requestId, 'Resolved mediaId from lesson API', { 
          mediaId: resolved.mediaId 
        });
        return resolved;
      }
      
      log('warn', requestId, 'No mediaId found in lesson API response');
    } catch (error) {
      log('warn', requestId, 'Lesson info API fetch failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Strategy 3: Fetch the embed URL directly
  try {
    log('info', requestId, 'Fetching embed URL directly', { embedUrl });
    const { html, finalUrl } = await fetchHtmlWithRedirect(embedUrl, fetcher);
    
    const urlInfo = extractEcho360Info(finalUrl);
    const htmlInfo = parseEcho360InfoFromHtml(html, finalUrl);
    
    const lessonId = urlInfo?.lessonId || htmlInfo?.lessonId || directInfo?.lessonId;
    const mediaId = urlInfo?.mediaId || htmlInfo?.mediaId;
    const baseUrl = urlInfo?.baseUrl || htmlInfo?.baseUrl || directInfo?.baseUrl;

    if (lessonId && mediaId && baseUrl) {
      log('info', requestId, 'Resolved from embed URL fetch', { lessonId, mediaId });
      return { lessonId, mediaId, baseUrl };
    }
  } catch (error) {
    log('warn', requestId, 'Embed URL fetch failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  log('warn', requestId, 'Could not resolve complete Echo360 info');
  return directInfo;
}

// ============================================================================
// Detection
// ============================================================================

function generateVideoId(info: Echo360Info | null, embedUrl: string): string {
  if (info?.mediaId) return info.mediaId;
  if (info?.lessonId) return info.lessonId;
  // Hash the URL for fallback ID
  let hash = 0;
  for (let i = 0; i < embedUrl.length; i++) {
    hash = ((hash << 5) - hash) + embedUrl.charCodeAt(i);
    hash |= 0;
  }
  return `echo_${Math.abs(hash).toString(36)}`;
}

function hasEcho360VideoIdentifiers(info: Echo360Info | null): info is Echo360Info {
  return Boolean(info && (info.lessonId || info.mediaId));
}

export function detectEcho360Videos(context: VideoDetectionContext): DetectedVideo[] {
  const videos: DetectedVideo[] = [];
  const seenIds = new Set<string>();

  const addVideo = (url: string, title: string) => {
    const info = extractEcho360Info(url);
    if (!hasEcho360VideoIdentifiers(info)) return;
    
    const id = generateVideoId(info, url);
    if (seenIds.has(id)) return;
    seenIds.add(id);

    videos.push({
      id,
      provider: 'echo360',
      title: title || `Echo360 video ${videos.length + 1}`,
      embedUrl: url,
      echoLessonId: info.lessonId,
      echoMediaId: info.mediaId,
      echoBaseUrl: info.baseUrl,
    });
  };

  // Check page URL
  if (isEcho360Url(context.pageUrl)) {
    addVideo(context.pageUrl, context.document?.title || '');
  }

  // Check iframes
  for (const iframe of context.iframes) {
    if (iframe.src && isEcho360Url(iframe.src)) {
      addVideo(iframe.src, iframe.title || '');
    }
  }

  return videos;
}

/**
 * Merge syllabus-derived metadata into a sync-detected video.
 */
function mergeSyllabusMetadata(
  syncVideo: DetectedVideo,
  syllabusVideo: DetectedVideo
): DetectedVideo {
  return {
    ...syncVideo,
    id: syllabusVideo.id || syncVideo.id,
    title: syllabusVideo.title || syncVideo.title,
    echoLessonId: syllabusVideo.echoLessonId || syncVideo.echoLessonId,
    echoMediaId: syllabusVideo.echoMediaId || syncVideo.echoMediaId,
    echoBaseUrl: syllabusVideo.echoBaseUrl || syncVideo.echoBaseUrl,
  };
}

/**
 * Match a page-detected video with syllabus metadata.
 */
function findMatchingSyllabusVideo(
  syncVideo: DetectedVideo,
  syllabusVideos: DetectedVideo[],
  requestId: string
): DetectedVideo | null {
  if (syllabusVideos.length === 0) return null;

  const info = extractEcho360Info(syncVideo.embedUrl);
  const mediaId = syncVideo.echoMediaId || info?.mediaId;
  const lessonId = syncVideo.echoLessonId || info?.lessonId;

  if (mediaId) {
    const match = syllabusVideos.find(
      video => video.echoMediaId === mediaId || video.id === mediaId
    );
    if (match) {
      log('debug', requestId, 'Matched syllabus video by mediaId', {
        mediaId,
        syncVideoId: syncVideo.id,
        syllabusVideoId: match.id,
      });
      return match;
    }
  }

  if (lessonId) {
    const match = syllabusVideos.find(
      video => video.echoLessonId === lessonId || video.id === lessonId
    );
    if (match) {
      log('debug', requestId, 'Matched syllabus video by lessonId', {
        lessonId,
        syncVideoId: syncVideo.id,
        syllabusVideoId: match.id,
      });
      return match;
    }
  }

  const embedUrl = syncVideo.embedUrl.toLowerCase();
  const urlMatch = syllabusVideos.find(video => {
    const mediaMatch = video.echoMediaId && embedUrl.includes(video.echoMediaId.toLowerCase());
    const lessonMatch = video.echoLessonId && embedUrl.includes(video.echoLessonId.toLowerCase());
    return Boolean(mediaMatch || lessonMatch);
  });

  if (urlMatch) {
    log('debug', requestId, 'Matched syllabus video by URL', {
      syncVideoId: syncVideo.id,
      syllabusVideoId: urlMatch.id,
    });
    return urlMatch;
  }

  log('debug', requestId, 'No syllabus match for video', { syncVideoId: syncVideo.id });
  return null;
}

// ============================================================================
// Provider Class
// ============================================================================

export class Echo360Provider implements TranscriptProviderV2 {
  readonly provider = 'echo360' as const;

  canHandle(url: string): boolean {
    return isEcho360Url(url);
  }

  requiresAsyncDetection(_context: VideoDetectionContext): boolean {
    // We may need async detection to resolve mediaId
    return true;
  }

  detectVideosSync(context: VideoDetectionContext): DetectedVideo[] {
    return detectEcho360Videos(context);
  }

  async detectVideosAsync(
    context: VideoDetectionContext,
    fetcher: AsyncFetcher
  ): Promise<DetectedVideo[]> {
    const requestId = createRequestId();
    log('info', requestId, 'Starting async detection', { pageUrl: context.pageUrl });

    const sectionId = extractSectionId(context.pageUrl);
    let syllabusVideos: DetectedVideo[] = [];

    if (sectionId) {
      log('info', requestId, 'Section ID detected, fetching syllabus', { sectionId });
      syllabusVideos = await fetchVideosFromSyllabus(
        context.pageUrl,
        fetcher,
        requestId
      );
    }

    if (isEcho360SectionPage(context.pageUrl)) {
      if (syllabusVideos.length > 0) {
        log('info', requestId, 'Syllabus detection complete', {
          count: syllabusVideos.length,
          withMediaId: syllabusVideos.filter(v => v.echoMediaId).length,
        });
        return syllabusVideos;
      }

      log('info', requestId, 'No videos from syllabus, falling back to standard detection');
    }

    // Start with sync detection for non-section pages or as fallback
    const syncVideos = detectEcho360Videos(context);
    
    if (syncVideos.length === 0) {
      log('info', requestId, 'No videos found in sync detection');
      return [];
    }

    let matchedCount = 0;
    const mergedVideos = syllabusVideos.length > 0
      ? syncVideos.map(video => {
        const match = findMatchingSyllabusVideo(video, syllabusVideos, requestId);
        if (match) {
          matchedCount += 1;
          return mergeSyllabusMetadata(video, match);
        }
        return video;
      })
      : syncVideos;

    if (syllabusVideos.length > 0) {
      log('info', requestId, 'Merged syllabus metadata', {
        matchedCount,
        totalSyncVideos: syncVideos.length,
      });
    }

    // Try to resolve missing mediaIds
    const enhancedVideos: DetectedVideo[] = [];
    const seenKeys = new Set<string>();
    
    for (const video of mergedVideos) {
      if (video.echoMediaId) {
        const key =
          getUniqueKey(video.echoMediaId ?? null, video.echoLessonId ?? null) || video.id;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        enhancedVideos.push(video);
        continue;
      }

      // Try to resolve mediaId
      const resolved = await resolveEcho360Info(video.embedUrl, fetcher, requestId);
      const updated: DetectedVideo = resolved?.mediaId
        ? {
            ...video,
            echoMediaId: resolved.mediaId,
            echoLessonId: resolved.lessonId || video.echoLessonId,
            echoBaseUrl: resolved.baseUrl || video.echoBaseUrl,
          }
        : video;
      const key =
        getUniqueKey(updated.echoMediaId ?? null, updated.echoLessonId ?? null) ||
        updated.id;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      enhancedVideos.push(updated);
    }

    log('info', requestId, 'Async detection complete', { 
      count: enhancedVideos.length,
      withMediaId: enhancedVideos.filter(v => v.echoMediaId).length,
    });

    return enhancedVideos;
  }

  async extractTranscript(
    video: DetectedVideo,
    fetcher: AsyncFetcher
  ): Promise<TranscriptExtractionResult> {
    const requestId = createRequestId();
    log('info', requestId, 'Starting transcript extraction', {
      videoId: video.id,
      lessonId: video.echoLessonId,
      mediaId: video.echoMediaId,
    });

    try {
      let lessonId = video.echoLessonId;
      let mediaId = video.echoMediaId;
      let baseUrl = video.echoBaseUrl || (() => {
        try { return new URL(video.embedUrl).origin; } 
        catch { return ''; }
      })();

      // Resolve missing IDs if needed
      if (!lessonId || !mediaId) {
        log('info', requestId, 'Resolving missing IDs');
        const resolved = await resolveEcho360Info(video.embedUrl, fetcher, requestId);
        lessonId = lessonId || resolved?.lessonId;
        mediaId = mediaId || resolved?.mediaId;
        baseUrl = baseUrl || resolved?.baseUrl || '';
      }

      // Validate we have required IDs
      if (!lessonId || !mediaId || !baseUrl) {
        log('warn', requestId, 'Missing required IDs', { lessonId, mediaId, baseUrl });
        return {
          success: false,
          error: 'Could not resolve Echo360 video identifiers.',
          errorCode: 'INVALID_VIDEO',
          aiTranscriptionAvailable: true,
        };
      }

      log('info', requestId, 'IDs resolved', { lessonId, mediaId, baseUrl });

      let hadTimeout = false;
      let invalidResponseCount = 0;
      let nonEmptyResponseCount = 0;

      // Try JSON transcript endpoint
      const jsonUrl = buildTranscriptUrl(baseUrl, lessonId, mediaId);
      log('info', requestId, 'Trying JSON endpoint', { url: jsonUrl });

      try {
        const jsonPayload = await fetchWithRetry<unknown>(fetcher, jsonUrl, {
          requestId,
          responseType: 'json',
          context: 'transcript-json',
          timeoutMs: DEFAULT_TIMEOUT_MS,
        });
        const transcript = normalizeEcho360TranscriptJson(jsonPayload);
        if (transcript && transcript.segments.length > 0) {
          log('info', requestId, 'JSON transcript extracted', {
            segments: transcript.segments.length,
          });
          return { success: true, transcript };
        }
        const payloadRecord = asRecord(jsonPayload);
        const hasTranscriptFields =
          payloadRecord &&
          ('cues' in payloadRecord || 'contentJson' in payloadRecord);
        if (hasTranscriptFields) {
          nonEmptyResponseCount += 1;
          invalidResponseCount += 1;
          log('warn', requestId, 'JSON transcript response invalid', { url: jsonUrl });
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log('warn', requestId, 'JSON endpoint failed', { error: msg });
        
        if (msg === 'AUTH_REQUIRED') {
          return {
            success: false,
            error: 'Authentication required. Please log in to Echo360.',
            errorCode: 'AUTH_REQUIRED',
            aiTranscriptionAvailable: true,
          };
        }
        if (isTimeoutError(error)) {
          hadTimeout = true;
        }
      }

      // Try VTT format
      const vttUrl = buildTranscriptFileUrl(baseUrl, lessonId, mediaId, 'vtt');
      log('info', requestId, 'Trying VTT endpoint', { url: vttUrl });

      try {
        const vttContent = await fetchWithRetry<string>(fetcher, vttUrl, {
          requestId,
          responseType: 'text',
          context: 'transcript-vtt',
          timeoutMs: DEFAULT_TIMEOUT_MS,
        });
        const transcript = parseWebVtt(vttContent);
        if (transcript.segments.length > 0) {
          log('info', requestId, 'VTT transcript extracted', {
            segments: transcript.segments.length,
          });
          return { success: true, transcript };
        }
        if (vttContent.trim()) {
          nonEmptyResponseCount += 1;
          invalidResponseCount += 1;
          log('warn', requestId, 'VTT transcript response invalid', { url: vttUrl });
        }
      } catch (error) {
        log('warn', requestId, 'VTT endpoint failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        if (isTimeoutError(error)) {
          hadTimeout = true;
        }
      }

      // Try text format
      const textUrl = buildTranscriptFileUrl(baseUrl, lessonId, mediaId, 'text');
      log('info', requestId, 'Trying text endpoint', { url: textUrl });

      try {
        const textContent = await fetchWithRetry<string>(fetcher, textUrl, {
          requestId,
          responseType: 'text',
          context: 'transcript-text',
          timeoutMs: DEFAULT_TIMEOUT_MS,
        });
        const plainText = cleanText(textContent);
        if (plainText) {
          const transcript = buildTranscriptResult([
            { startMs: 0, endMs: null, text: plainText },
          ]);
          log('info', requestId, 'Text transcript extracted');
          return { success: true, transcript };
        }
        if (textContent.trim()) {
          nonEmptyResponseCount += 1;
          invalidResponseCount += 1;
          log('warn', requestId, 'Text transcript response invalid', { url: textUrl });
        }
      } catch (error) {
        log('warn', requestId, 'Text endpoint failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        if (isTimeoutError(error)) {
          hadTimeout = true;
        }
      }

      log('warn', requestId, 'No transcript available');
      if (hadTimeout) {
        return {
          success: false,
          error: 'Request timeout. The server took too long to respond.',
          errorCode: 'TIMEOUT',
          aiTranscriptionAvailable: true,
        };
      }
      if (nonEmptyResponseCount > 0 && invalidResponseCount === nonEmptyResponseCount) {
        return {
          success: false,
          error: 'Transcript response was invalid or empty.',
          errorCode: 'INVALID_RESPONSE',
          aiTranscriptionAvailable: true,
        };
      }
      return {
        success: false,
        error: 'No captions available for this video.',
        errorCode: 'NO_CAPTIONS',
        aiTranscriptionAvailable: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log('error', requestId, 'Extraction failed', { error: message });

      if (message === 'AUTH_REQUIRED') {
        return {
          success: false,
          error: 'Authentication required. Please log in to Echo360.',
          errorCode: 'AUTH_REQUIRED',
          aiTranscriptionAvailable: true,
        };
      }

      if (isTimeoutError(error)) {
        return {
          success: false,
          error: 'Request timeout. The server took too long to respond.',
          errorCode: 'TIMEOUT',
          aiTranscriptionAvailable: true,
        };
      }

      return {
        success: false,
        error: `Failed to extract transcript: ${message}`,
        errorCode: 'PARSE_ERROR',
        aiTranscriptionAvailable: true,
      };
    }
  }
}

export function createEcho360Provider(): Echo360Provider {
  return new Echo360Provider();
}
