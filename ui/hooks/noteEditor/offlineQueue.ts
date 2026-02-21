import type { NoteContent, NoteType } from '@core/domain/Note';
import { OFFLINE_QUEUE_KEY } from './constants';
import { createClientNoteId } from './noteUtils';

export interface PendingSave {
  noteId: string | null;
  clientNoteId: string;
  title: string;
  content: NoteContent;
  courseCode: string | null;
  sourceUrl: string | null;
  sourceSelection: string | null;
  noteType: NoteType;
  tags: string[];
  week?: number | null;
  expectedUpdatedAt: string | null;
  timestamp: number;
  retryCount: number;
}

const NOTE_TYPES: readonly NoteType[] = [
  'manual',
  'definition',
  'formula',
  'concept',
  'general',
  'ai-generated',
  'transcript',
  'quiz',
  'key_takeaways',
];
const MAX_OFFLINE_QUEUE_SIZE = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((tag) => typeof tag === 'string');
}

function hasPendingSaveIdentityFields(value: Record<string, unknown>): boolean {
  const noteId = value['noteId'];
  const clientNoteId = value['clientNoteId'];
  const title = value['title'];

  return isNullableString(noteId) && typeof clientNoteId === 'string' && typeof title === 'string';
}

function hasPendingSaveContentFields(value: Record<string, unknown>): boolean {
  const content = value['content'];
  const courseCode = value['courseCode'];
  const sourceUrl = value['sourceUrl'];
  const sourceSelection = value['sourceSelection'];
  const noteType = value['noteType'];
  const tags = value['tags'];

  return (
    isRecord(content) &&
    isNullableString(courseCode) &&
    isNullableString(sourceUrl) &&
    isNullableString(sourceSelection) &&
    typeof noteType === 'string' &&
    isStringArray(tags)
  );
}

function hasPendingSaveMetaFields(value: Record<string, unknown>): boolean {
  const expectedUpdatedAt = value['expectedUpdatedAt'];
  const timestamp = value['timestamp'];
  const retryCount = value['retryCount'];

  return (
    (expectedUpdatedAt === undefined || isNullableString(expectedUpdatedAt)) &&
    typeof timestamp === 'number' &&
    typeof retryCount === 'number'
  );
}

function isPendingSave(value: unknown): value is PendingSave {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasPendingSaveIdentityFields(value) &&
    hasPendingSaveContentFields(value) &&
    hasPendingSaveMetaFields(value)
  );
}

export function getQueueKey(save: PendingSave): string {
  return save.noteId !== null && save.noteId.length > 0 ? save.noteId : save.clientNoteId;
}

function normalizeOfflineQueue(queue: PendingSave[]): PendingSave[] {
  const latestByKey = new Map<string, PendingSave>();

  queue.forEach((item) => {
    const noteType = NOTE_TYPES.includes(item.noteType) ? item.noteType : 'manual';
    const clientNoteId =
      item.clientNoteId.length > 0
        ? item.clientNoteId
        : item.noteId !== null && item.noteId.length > 0
          ? item.noteId
          : createClientNoteId();

    const normalized: PendingSave = {
      ...item,
      noteType,
      clientNoteId,
      expectedUpdatedAt: item.expectedUpdatedAt ?? null,
      retryCount: item.retryCount ?? 0,
    };
    const key = getQueueKey(normalized);
    const existing = latestByKey.get(key);
    if (existing === undefined || normalized.timestamp >= existing.timestamp) {
      latestByKey.set(key, normalized);
    }
  });

  return Array.from(latestByKey.values()).sort((a, b) => a.timestamp - b.timestamp);
}

export function loadOfflineQueue(): PendingSave[] {
  try {
    const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (stored === null || stored.length === 0) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return normalizeOfflineQueue(parsed.filter(isPendingSave));
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: PendingSave[]): void {
  try {
    const normalized = normalizeOfflineQueue(queue);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(normalized));
  } catch {
    console.error('[NoteEditor] Failed to save offline queue');
  }
}

export function addToOfflineQueue(save: PendingSave): void {
  const queue = loadOfflineQueue();
  // Remove any existing entry for the same note (we only need the latest)
  const key = getQueueKey(save);
  const filtered = queue.filter((s) => getQueueKey(s) !== key);
  // Keep only the most recent for this note
  filtered.push(save);
  // Limit queue size to prevent storage bloat
  const trimmed = filtered.slice(-MAX_OFFLINE_QUEUE_SIZE);
  saveOfflineQueue(trimmed);
}

export function removeFromOfflineQueue(queueKey: string): void {
  const queue = loadOfflineQueue();
  const filtered = queue.filter((s) => getQueueKey(s) !== queueKey);
  saveOfflineQueue(filtered);
}
