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
  expectedUpdatedAt: string | null;
  timestamp: number;
  retryCount: number;
}

export function getQueueKey(save: PendingSave): string {
  return save.noteId || save.clientNoteId;
}

function normalizeOfflineQueue(queue: PendingSave[]): PendingSave[] {
  const latestByKey = new Map<string, PendingSave>();

  queue.forEach((item) => {
    const noteType =
      typeof item.noteType === 'string' && item.noteType.length > 0
        ? (item.noteType as NoteType)
        : 'manual';
    const normalized: PendingSave = {
      ...item,
      noteType,
      clientNoteId: item.clientNoteId || item.noteId || createClientNoteId(),
      expectedUpdatedAt: item.expectedUpdatedAt ?? null,
      retryCount: item.retryCount ?? 0,
    };
    const key = getQueueKey(normalized);
    const existing = latestByKey.get(key);
    if (!existing || normalized.timestamp >= existing.timestamp) {
      latestByKey.set(key, normalized);
    }
  });

  return Array.from(latestByKey.values()).sort((a, b) => a.timestamp - b.timestamp);
}

export function loadOfflineQueue(): PendingSave[] {
  try {
    const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return normalizeOfflineQueue(Array.isArray(parsed) ? parsed : []);
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
  const trimmed = filtered.slice(-50);
  saveOfflineQueue(trimmed);
}

export function removeFromOfflineQueue(queueKey: string): void {
  const queue = loadOfflineQueue();
  const filtered = queue.filter((s) => getQueueKey(s) !== queueKey);
  saveOfflineQueue(filtered);
}
