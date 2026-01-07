import type { AsyncFetcher } from '../fetchers/types';
import type { DetectedVideo, TranscriptExtractionResult } from '../types';
import type {
  Echo360SyllabusEntry,
  Echo360SyllabusLesson,
  Echo360SyllabusResponse,
  UnknownRecord,
} from '../types/echo360Types';
import { log } from '../utils/echo360Logger';
import { DEFAULT_TIMEOUT_MS, fetchWithRetry } from '../utils/echo360Network';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SYLLABUS_CACHE_TTL_MS = 5 * 60 * 1000;

const syllabusCache = new Map<
  string,
  { data: DetectedVideo[]; timestamp: number }
>();

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

export function asRecord(value: unknown): UnknownRecord | null {
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

export function getUniqueKey(mediaId: string | null, lessonId: string | null): string | null {
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

/**
 * Parse syllabus response and extract video information
 */
export function parseSyllabusResponse(
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
export async function fetchVideosFromSyllabus(
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
