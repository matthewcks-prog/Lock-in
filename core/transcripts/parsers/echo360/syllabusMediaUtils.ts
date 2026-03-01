import type { DetectedVideo, TranscriptExtractionResult } from '../../types';
import type { UnknownRecord } from '../../types/echo360Types';
import { log } from '../../utils/echo360Logger';
import {
  extractMediaTitle,
  extractMediaType,
  extractMediaTypeRaw,
  normalizeMediaType,
  readBoolean,
} from './recordUtils';
import { buildLessonPageUrl } from './urlUtils';

export const firstNonEmptyString = (values: Array<string | null | undefined>): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
};

export function formatLessonDateLabel(start: string | null): string {
  if (start === null || start.length === 0) return '';
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

export function buildSyllabusTitle(
  baseTitle: string,
  _dateLabel: string,
  fallback: string,
): string {
  const title = baseTitle.length > 0 ? baseTitle : fallback;
  return title;
}

export function appendAudioSuffix(title: string, isAudioContent: boolean): string {
  if (!isAudioContent) return title;
  if (title.length === 0) return 'Echo360 audio';
  return `${title} (Audio)`;
}

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

export function getMediaStatusSkipReason(
  media: UnknownRecord,
): { code: NonNullable<TranscriptExtractionResult['errorCode']>; reason: string } | null {
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

export function logMediaStatus(
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

export function getMediaTypeInfo(mediaRecord: UnknownRecord): {
  mediaTypeRaw: string | null;
  mediaType: string | null;
  isAudioOnly: boolean;
  isAudioType: boolean;
  isSupported: boolean;
} {
  const mediaTypeRaw = extractMediaTypeRaw(mediaRecord);
  const mediaType = normalizeMediaType(mediaTypeRaw);
  const isAudioOnly = readBoolean(mediaRecord['isAudioOnly']) === true;
  const isVideoType =
    mediaTypeRaw === 'Video' ||
    mediaType === 'video' ||
    (typeof mediaType === 'string' && mediaType.startsWith('video/'));
  const isAudioType =
    mediaTypeRaw === 'Audio' ||
    mediaType === 'audio' ||
    (typeof mediaType === 'string' && mediaType.startsWith('audio/'));
  const isSupported =
    isVideoType || isAudioType || isAudioOnly || (mediaTypeRaw === null && mediaType === null);

  return { mediaTypeRaw, mediaType, isAudioOnly, isAudioType, isSupported };
}

export function buildVideoEntry({
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
  const mediaTitle = firstNonEmptyString([lessonName, extractMediaTitle(mediaRecord)]) ?? '';
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
