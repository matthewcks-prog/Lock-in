import type { UnknownRecord } from '../../types/echo360Types';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== 'object') return null;
  return value as UnknownRecord;
}

export function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  return undefined;
}

function normalizeLessonId(value: unknown): string | null {
  return readString(value);
}

export function normalizeMediaId(value: unknown): string | null {
  const raw = readString(value);
  if (!raw) return null;
  const trimmed = raw.trim();
  const braceMatch = trimmed.match(/^\{?([0-9a-fA-F-]{36})\}?$/);
  const braceId = braceMatch?.[1];
  if (braceId && UUID_REGEX.test(braceId)) {
    return braceId.toLowerCase();
  }
  if (UUID_REGEX.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return trimmed;
}

export function extractLessonIdFromRecord(record: UnknownRecord | null): string | null {
  if (!record) return null;
  return normalizeLessonId(record['id'] ?? record['lessonId'] ?? record['lesson_id']);
}

export function extractLessonNameFromRecord(record: UnknownRecord | null): string {
  if (!record) return '';
  return (
    readString(record['displayName']) ||
    readString(record['name']) ||
    readString(record['title']) ||
    ''
  );
}

export function extractTimingStart(record: UnknownRecord | null): string | null {
  if (!record) return null;
  const timing = asRecord(record['timing']);
  if (timing) {
    return (
      readString(timing['start']) ||
      readString(timing['startTime']) ||
      readString(timing['startsAt'])
    );
  }
  return null;
}

export function extractMediaIdFromRecord(record: UnknownRecord | null): string | null {
  if (!record) return null;
  return normalizeMediaId(record['mediaId'] ?? record['media_id'] ?? record['id']);
}

export function extractMediaTitle(record: UnknownRecord | null): string | null {
  if (!record) return null;
  return (
    readString(record['title']) || readString(record['name']) || readString(record['displayName'])
  );
}

export function extractMediaTypeRaw(record: UnknownRecord | null): string | null {
  if (!record) return null;
  return readString(
    record['mediaType'] ?? record['media_type'] ?? record['type'] ?? record['kind'],
  );
}

export function normalizeMediaType(value: unknown): string | null {
  const raw = readString(value);
  return raw ? raw.toLowerCase() : null;
}

export function extractMediaType(record: UnknownRecord | null): string | null {
  return normalizeMediaType(extractMediaTypeRaw(record));
}

export function getUniqueKey(mediaId: string | null, lessonId: string | null): string | null {
  if (mediaId) return `media:${mediaId}`;
  if (lessonId) return `lesson:${lessonId}`;
  return null;
}
