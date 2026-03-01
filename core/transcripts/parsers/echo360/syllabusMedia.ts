import type { DetectedVideo } from '../../types';
import type { Echo360SyllabusLesson, UnknownRecord } from '../../types/echo360Types';
import { log } from '../../utils/echo360Logger';
import {
  asRecord,
  extractLessonIdFromRecord,
  extractLessonNameFromRecord,
  extractMediaIdFromRecord,
  extractTimingStart,
  getUniqueKey,
} from './recordUtils';
import {
  buildSyllabusTitle,
  buildVideoEntry,
  firstNonEmptyString,
  formatLessonDateLabel,
  getMediaStatusSkipReason,
  getMediaTypeInfo,
  logMediaStatus,
} from './syllabusMediaUtils';
import { buildLessonPageUrl } from './urlUtils';

type MediaTypeInfo = ReturnType<typeof getMediaTypeInfo>;

export type LessonContext = {
  lessonRecord: UnknownRecord | null;
  lessonWrapper: UnknownRecord | null;
  lessonId: string | null;
  lessonName: string;
  dateLabel: string;
  isFolderLesson: boolean;
};

export function extractLessonContext(entryRecord: UnknownRecord): LessonContext {
  const lessonWrapper = asRecord(entryRecord['lesson']);
  const nestedLesson = lessonWrapper !== null ? asRecord(lessonWrapper['lesson']) : null;
  const lessonRecord = nestedLesson ?? lessonWrapper ?? entryRecord;
  const lessonId = firstNonEmptyString([
    extractLessonIdFromRecord(nestedLesson),
    extractLessonIdFromRecord(lessonWrapper),
    extractLessonIdFromRecord(entryRecord),
  ]);
  const lessonName = extractLessonNameFromRecord(lessonRecord);
  const timingStart = firstNonEmptyString([
    extractTimingStart(lessonRecord),
    extractTimingStart(lessonWrapper),
  ]);
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

function logUnsupportedMedia(
  requestId: string,
  mediaRecord: UnknownRecord,
  mediaId: string,
  typeInfo: MediaTypeInfo,
): void {
  log('info', requestId, 'Skipping non-video/non-audio media', {
    mediaId,
    mediaType: typeInfo.mediaTypeRaw ?? typeInfo.mediaType,
    mediaTypeNormalized: typeInfo.mediaType,
    isAudioOnly: typeInfo.isAudioOnly,
  });
  logMediaStatus(requestId, mediaRecord, mediaId, {
    skipReason: 'UNSUPPORTED_MEDIA_TYPE',
  });
}

function logStatusSkip(
  requestId: string,
  mediaRecord: UnknownRecord,
  mediaId: string,
  skipReason: { code: string; reason: string },
): void {
  log('info', requestId, 'Skipping media due to status', {
    mediaId,
    reason: skipReason.reason,
    errorCode: skipReason.code,
  });
  logMediaStatus(requestId, mediaRecord, mediaId, {
    skipReason: skipReason.code,
  });
}

function checkMediaEligibility(
  mediaRecord: UnknownRecord,
  requestId: string,
  mediaId: string,
): { typeInfo: MediaTypeInfo } | null {
  const typeInfo = getMediaTypeInfo(mediaRecord);
  if (!typeInfo.isSupported) {
    logUnsupportedMedia(requestId, mediaRecord, mediaId, typeInfo);
    return null;
  }

  const skipReason = getMediaStatusSkipReason(mediaRecord);
  if (skipReason !== null) {
    logStatusSkip(requestId, mediaRecord, mediaId, skipReason);
    return null;
  }

  return { typeInfo };
}

function resolveMediaLessonId(
  lessonContext: LessonContext,
  mediaRecord: UnknownRecord,
  requestId: string,
  mediaId: string,
): string | null {
  const mediaLessonId = lessonContext.lessonId ?? extractLessonIdFromRecord(mediaRecord);
  if (mediaLessonId === null) {
    log('warn', requestId, 'Media entry missing lessonId', { mediaId });
    return null;
  }
  return mediaLessonId;
}

function shouldSkipDuplicate(
  mediaId: string,
  mediaLessonId: string,
  seenIds: Set<string>,
): boolean {
  const key = getUniqueKey(mediaId, mediaLessonId);
  if (key !== null && seenIds.has(key)) {
    return true;
  }
  if (key !== null) seenIds.add(key);
  return false;
}

function handleMediaRecord(params: {
  mediaRecord: UnknownRecord;
  lessonContext: LessonContext;
  baseUrl: string;
  requestId: string;
  seenIds: Set<string>;
  videos: DetectedVideo[];
}): { added: boolean; hasMediaId: boolean } {
  const { mediaRecord, lessonContext, baseUrl, requestId, seenIds, videos } = params;
  const mediaId = extractMediaIdFromRecord(mediaRecord);
  if (mediaId === null) return { added: false, hasMediaId: false };

  const eligibility = checkMediaEligibility(mediaRecord, requestId, mediaId);
  if (eligibility === null) {
    return { added: false, hasMediaId: true };
  }

  const mediaLessonId = resolveMediaLessonId(lessonContext, mediaRecord, requestId, mediaId);
  if (mediaLessonId === null) {
    return { added: false, hasMediaId: true };
  }

  if (shouldSkipDuplicate(mediaId, mediaLessonId, seenIds)) {
    return { added: false, hasMediaId: true };
  }

  videos.push(
    buildVideoEntry({
      mediaId,
      mediaLessonId,
      baseUrl,
      lessonName: lessonContext.lessonName,
      dateLabel: lessonContext.dateLabel,
      mediaRecord,
      isAudioContent: eligibility.typeInfo.isAudioOnly || eligibility.typeInfo.isAudioType,
    }),
  );

  return { added: true, hasMediaId: true };
}

export function processMediaRecords(params: {
  mediaRecords: UnknownRecord[];
  lessonContext: LessonContext;
  baseUrl: string;
  requestId: string;
  seenIds: Set<string>;
  videos: DetectedVideo[];
}): { addedMedia: boolean; hasMediaId: boolean } {
  let addedMedia = false;
  let hasMediaId = false;

  for (const mediaRecord of params.mediaRecords) {
    const result = handleMediaRecord({
      mediaRecord,
      lessonContext: params.lessonContext,
      baseUrl: params.baseUrl,
      requestId: params.requestId,
      seenIds: params.seenIds,
      videos: params.videos,
    });
    if (result.hasMediaId) {
      hasMediaId = true;
    }
    if (result.added) {
      addedMedia = true;
    }
  }

  return { addedMedia, hasMediaId };
}

export function maybeAddLessonFallback(params: {
  lessonContext: LessonContext;
  baseUrl: string;
  seenIds: Set<string>;
  videos: DetectedVideo[];
}): void {
  const { lessonContext, baseUrl, seenIds, videos } = params;
  if (lessonContext.lessonId === null || lessonContext.isFolderLesson) {
    return;
  }
  const key = getUniqueKey(null, lessonContext.lessonId);
  if (key !== null && seenIds.has(key)) return;
  if (key !== null) seenIds.add(key);

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
