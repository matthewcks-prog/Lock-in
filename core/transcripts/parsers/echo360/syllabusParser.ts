import type { DetectedVideo, TranscriptExtractionResult } from '../../types';
import type {
  Echo360SyllabusEntry,
  Echo360SyllabusLesson,
  Echo360SyllabusResponse,
  UnknownRecord,
} from '../../types/echo360Types';
import { log } from '../../utils/echo360Logger';
import {
  asRecord,
  extractLessonIdFromRecord,
  extractLessonNameFromRecord,
  extractMediaIdFromRecord,
  extractMediaTitle,
  extractMediaType,
  extractMediaTypeRaw,
  extractTimingStart,
  getUniqueKey,
  normalizeMediaType,
  readBoolean,
} from './recordUtils';
import { buildLessonPageUrl } from './urlUtils';

function extractSyllabusEntries(response: unknown): Echo360SyllabusEntry[] | null {
  const payload = asRecord(response);
  if (!payload) return null;
  if (Array.isArray(payload['data'])) {
    return payload['data'] as Echo360SyllabusEntry[];
  }
  if (Array.isArray(payload['lessons'])) {
    return payload['lessons'] as Echo360SyllabusEntry[];
  }
  const dataRecord = asRecord(payload['data']);
  if (dataRecord && Array.isArray(dataRecord['lessons'])) {
    return dataRecord['lessons'] as Echo360SyllabusEntry[];
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
  const title = baseTitle || fallback;
  return title;
}

function appendAudioSuffix(title: string, isAudioContent: boolean): string {
  if (!isAudioContent) return title;
  if (!title) return 'Echo360 audio';
  return `${title} (Audio)`;
}

/**
 * Validate Echo360 syllabus response shape.
 */
export function validateSyllabusResponse(response: unknown): response is Echo360SyllabusResponse {
  const payload = asRecord(response);
  if (!payload) return false;
  const entries = extractSyllabusEntries(response);
  if (!entries || !Array.isArray(entries)) return false;
  if (entries.length > 0 && !entries.some((entry) => asRecord(entry))) {
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
  const snapshot: {
    isAvailable?: boolean;
    isProcessing?: boolean;
    isFailed?: boolean;
    isPreliminary?: boolean;
    isHiddenDueToCaptions?: boolean;
    isAudioOnly?: boolean;
  } = {};
  const isAvailable = readBoolean(media['isAvailable']);
  const isProcessing = readBoolean(media['isProcessing']);
  const isFailed = readBoolean(media['isFailed']);
  const isPreliminary = readBoolean(media['isPreliminary']);
  const isHiddenDueToCaptions = readBoolean(media['isHiddenDueToCaptions']);
  const isAudioOnly = readBoolean(media['isAudioOnly']);

  if (isAvailable !== undefined) snapshot.isAvailable = isAvailable;
  if (isProcessing !== undefined) snapshot.isProcessing = isProcessing;
  if (isFailed !== undefined) snapshot.isFailed = isFailed;
  if (isPreliminary !== undefined) snapshot.isPreliminary = isPreliminary;
  if (isHiddenDueToCaptions !== undefined) snapshot.isHiddenDueToCaptions = isHiddenDueToCaptions;
  if (isAudioOnly !== undefined) snapshot.isAudioOnly = isAudioOnly;

  return snapshot;
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
  media: UnknownRecord,
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
  context?: Record<string, unknown>,
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

type LessonContext = {
  lessonRecord: UnknownRecord | null;
  lessonWrapper: UnknownRecord | null;
  lessonId: string | null;
  lessonName: string;
  dateLabel: string;
  isFolderLesson: boolean;
};

function extractLessonContext(entryRecord: UnknownRecord): LessonContext {
  const lessonWrapper = asRecord(entryRecord['lesson']);
  const nestedLesson = lessonWrapper ? asRecord(lessonWrapper['lesson']) : null;
  const lessonRecord = nestedLesson || lessonWrapper || entryRecord;
  const lessonId =
    extractLessonIdFromRecord(nestedLesson) ||
    extractLessonIdFromRecord(lessonWrapper) ||
    extractLessonIdFromRecord(entryRecord);
  const lessonName = extractLessonNameFromRecord(lessonRecord);
  const timingStart = extractTimingStart(lessonRecord) || extractTimingStart(lessonWrapper);
  const dateLabel = formatLessonDateLabel(timingStart);
  const isFolderLesson =
    (lessonRecord as Echo360SyllabusLesson | null)?.isFolderLesson === true ||
    (lessonWrapper as Echo360SyllabusLesson | null)?.isFolderLesson === true;

  return {
    lessonRecord,
    lessonWrapper,
    lessonId,
    lessonName,
    dateLabel,
    isFolderLesson,
  };
}

function getMediaTypeInfo(mediaRecord: UnknownRecord) {
  const mediaTypeRaw = extractMediaTypeRaw(mediaRecord);
  const mediaType = normalizeMediaType(mediaTypeRaw);
  const isAudioOnly = readBoolean(mediaRecord['isAudioOnly']) === true;
  const isVideoType =
    mediaTypeRaw === 'Video' ||
    mediaType === 'video' ||
    (mediaType ? mediaType.startsWith('video/') : false);
  const isAudioType =
    mediaTypeRaw === 'Audio' ||
    mediaType === 'audio' ||
    (mediaType ? mediaType.startsWith('audio/') : false);
  const isSupported = isVideoType || isAudioType || isAudioOnly || (!mediaTypeRaw && !mediaType);

  return { mediaTypeRaw, mediaType, isAudioOnly, isAudioType, isSupported };
}

function buildVideoEntry({
  mediaId,
  mediaLessonId,
  baseUrl,
  lessonName,
  dateLabel,
  mediaRecord,
  isAudioContent,
}: {
  mediaId: string;
  mediaLessonId: string;
  baseUrl: string;
  lessonName: string;
  dateLabel: string;
  mediaRecord: UnknownRecord;
  isAudioContent: boolean;
}): DetectedVideo {
  const mediaTitle = lessonName || extractMediaTitle(mediaRecord) || '';
  const titleWithDate = appendAudioSuffix(
    buildSyllabusTitle(mediaTitle, dateLabel, 'Echo360 video'),
    isAudioContent,
  );

  return {
    id: mediaId,
    provider: 'echo360',
    title: titleWithDate,
    embedUrl: buildLessonPageUrl(baseUrl, mediaLessonId),
    echoLessonId: mediaLessonId,
    echoMediaId: mediaId,
    echoBaseUrl: baseUrl,
  };
}

function processMediaRecords({
  mediaRecords,
  lessonContext,
  baseUrl,
  requestId,
  seenIds,
  videos,
}: {
  mediaRecords: UnknownRecord[];
  lessonContext: LessonContext;
  baseUrl: string;
  requestId: string;
  seenIds: Set<string>;
  videos: DetectedVideo[];
}): { addedMedia: boolean; hasMediaId: boolean } {
  let addedMedia = false;
  let hasMediaId = false;

  for (const mediaRecord of mediaRecords) {
    const mediaId = extractMediaIdFromRecord(mediaRecord);
    if (!mediaId) continue;
    hasMediaId = true;

    const typeInfo = getMediaTypeInfo(mediaRecord);
    if (!typeInfo.isSupported) {
      log('info', requestId, 'Skipping non-video/non-audio media', {
        mediaId,
        mediaType: typeInfo.mediaTypeRaw ?? typeInfo.mediaType,
        mediaTypeNormalized: typeInfo.mediaType,
        isAudioOnly: typeInfo.isAudioOnly,
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

    const mediaLessonId = lessonContext.lessonId || extractLessonIdFromRecord(mediaRecord);
    if (!mediaLessonId) {
      log('warn', requestId, 'Media entry missing lessonId', { mediaId });
      continue;
    }

    const key = getUniqueKey(mediaId, mediaLessonId);
    if (key && seenIds.has(key)) continue;
    if (key) seenIds.add(key);

    videos.push(
      buildVideoEntry({
        mediaId,
        mediaLessonId,
        baseUrl,
        lessonName: lessonContext.lessonName,
        dateLabel: lessonContext.dateLabel,
        mediaRecord,
        isAudioContent: typeInfo.isAudioOnly || typeInfo.isAudioType,
      }),
    );
    addedMedia = true;
  }

  return { addedMedia, hasMediaId };
}

function maybeAddLessonFallback({
  lessonContext,
  baseUrl,
  seenIds,
  videos,
}: {
  lessonContext: LessonContext;
  baseUrl: string;
  seenIds: Set<string>;
  videos: DetectedVideo[];
}): void {
  if (!lessonContext.lessonId || lessonContext.isFolderLesson) {
    return;
  }
  const key = getUniqueKey(null, lessonContext.lessonId);
  if (key && seenIds.has(key)) return;
  if (key) seenIds.add(key);

  const titleWithDate = buildSyllabusTitle(
    lessonContext.lessonName,
    lessonContext.dateLabel,
    'Echo360 lesson',
  );

  videos.push({
    id: lessonContext.lessonId,
    provider: 'echo360',
    title: titleWithDate,
    embedUrl: buildLessonPageUrl(baseUrl, lessonContext.lessonId),
    echoLessonId: lessonContext.lessonId,
    echoBaseUrl: baseUrl,
  });
}

/**
 * Parse syllabus response and extract video information
 */
export function parseSyllabusResponse(
  response: unknown,
  baseUrl: string,
  requestId: string,
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

    const lessonContext = extractLessonContext(entryRecord);
    const lessonRecord = lessonContext.lessonRecord as UnknownRecord | null;
    const mediaRecords = collectMediaRecords(
      entryRecord['medias'],
      entryRecord['media'],
      lessonContext.lessonWrapper?.['medias'],
      lessonContext.lessonWrapper?.['media'],
      lessonRecord?.['medias'],
      lessonRecord?.['media'],
    );

    const { addedMedia, hasMediaId } = processMediaRecords({
      mediaRecords,
      lessonContext,
      baseUrl,
      requestId,
      seenIds,
      videos,
    });

    if (!addedMedia && !hasMediaId) {
      maybeAddLessonFallback({ lessonContext, baseUrl, seenIds, videos });
    }
  }

  log('info', requestId, 'Parsed syllabus videos', {
    count: videos.length,
    entriesProcessed: entries.length,
  });

  return videos;
}
