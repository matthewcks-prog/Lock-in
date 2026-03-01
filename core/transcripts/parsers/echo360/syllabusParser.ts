import type { DetectedVideo } from '../../types';
import type {
  Echo360SyllabusEntry,
  Echo360SyllabusResponse,
  UnknownRecord,
} from '../../types/echo360Types';
import { log } from '../../utils/echo360Logger';
import { asRecord } from './recordUtils';
import { extractLessonContext, maybeAddLessonFallback, processMediaRecords } from './syllabusMedia';

function extractSyllabusEntries(response: unknown): Echo360SyllabusEntry[] | null {
  const payload = asRecord(response);
  if (payload === null) return null;
  if (Array.isArray(payload['data'])) {
    return payload['data'] as Echo360SyllabusEntry[];
  }
  if (Array.isArray(payload['lessons'])) {
    return payload['lessons'] as Echo360SyllabusEntry[];
  }
  const dataRecord = asRecord(payload['data']);
  if (dataRecord !== null && Array.isArray(dataRecord['lessons'])) {
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
        if (record !== null) records.push(record);
      }
      continue;
    }
    const record = asRecord(candidate);
    if (record !== null) records.push(record);
  }
  return records;
}

function logInvalidResponse(response: unknown, requestId: string): void {
  const responseRecord = asRecord(response);
  log('warn', requestId, 'Invalid syllabus response', {
    responseType: typeof response,
    responseKeys: responseRecord !== null ? Object.keys(responseRecord) : null,
  });
}

function logNonOkStatus(status: string, requestId: string): void {
  log('warn', requestId, 'Syllabus response status not ok', { status });
}

function logMissingEntries(requestId: string): void {
  log('warn', requestId, 'Syllabus response missing entries', { hasEntries: true });
}

function handleSyllabusEntry(params: {
  entry: Echo360SyllabusEntry;
  baseUrl: string;
  requestId: string;
  seenIds: Set<string>;
  videos: DetectedVideo[];
}): void {
  const entryRecord = asRecord(params.entry);
  if (entryRecord === null) return;

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
    baseUrl: params.baseUrl,
    requestId: params.requestId,
    seenIds: params.seenIds,
    videos: params.videos,
  });

  if (!addedMedia && !hasMediaId) {
    maybeAddLessonFallback({
      lessonContext,
      baseUrl: params.baseUrl,
      seenIds: params.seenIds,
      videos: params.videos,
    });
  }
}

/**
 * Validate Echo360 syllabus response shape.
 */
export function validateSyllabusResponse(response: unknown): response is Echo360SyllabusResponse {
  const payload = asRecord(response);
  if (payload === null) return false;
  const entries = extractSyllabusEntries(response);
  if (entries === null || !Array.isArray(entries)) return false;
  if (entries.length > 0 && !entries.some((entry) => asRecord(entry) !== null)) {
    return false;
  }
  return true;
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
    logInvalidResponse(response, requestId);
    return videos;
  }

  const syllabusData = response as Echo360SyllabusResponse;
  const entries = extractSyllabusEntries(response) ?? [];

  if (typeof syllabusData.status === 'string' && syllabusData.status !== 'ok') {
    logNonOkStatus(syllabusData.status, requestId);
  }

  if (entries.length === 0) {
    logMissingEntries(requestId);
    return videos;
  }

  for (const entry of entries) {
    handleSyllabusEntry({
      entry,
      baseUrl,
      requestId,
      seenIds,
      videos,
    });
  }

  log('info', requestId, 'Parsed syllabus videos', {
    count: videos.length,
    entriesProcessed: entries.length,
  });

  return videos;
}
