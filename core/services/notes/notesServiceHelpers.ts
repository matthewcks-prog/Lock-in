import type { Note } from '../../domain/Note.ts';
import { sanitizeUrl } from '../../utils/urlSanitizer';
import {
  legacyHtmlToNoteContent,
  toBackendPayload,
  toDomainNote,
  type NotePayload,
  type NoteRecord,
} from './noteContent';
import type {
  CreateNoteInput,
  NoteRequestOptions,
  NotesApiClient,
  UpdateNoteInput,
} from './notesServiceTypes';

const DEFAULT_LIST_LIMIT = 50;

export const isRecord = (value: unknown): value is NoteRecord =>
  typeof value === 'object' && value !== null;

export const isNonEmptyString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.length > 0;

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

export const hasContentJson = (record: NoteRecord): boolean =>
  record['content_json'] !== undefined && record['content_json'] !== null;

export async function migrateLegacyNote(
  raw: NoteRecord | null | undefined,
  apiClient: NotesApiClient,
): Promise<Note> {
  const record = raw ?? null;
  if (record === null) {
    return toDomainNote(raw);
  }

  const noteId = readString(record['id']);
  if (noteId === undefined || hasContentJson(record)) {
    return toDomainNote(raw);
  }

  const legacyContent = record['content'];
  if (typeof legacyContent !== 'string' || legacyContent.length === 0) {
    return toDomainNote(raw);
  }

  const legacyNote = legacyHtmlToNoteContent(legacyContent);
  const titleValue = readString(record['title']);
  const title =
    titleValue !== undefined && titleValue.trim().length > 0 ? titleValue : 'Untitled note';
  const payload: NotePayload & { title: string } = {
    title,
    ...toBackendPayload(legacyNote),
  };

  try {
    const updated = await apiClient.updateNote(noteId, payload, undefined);
    return toDomainNote(updated);
  } catch {
    const augmentedRaw: NoteRecord = {
      ...record,
      content_json: payload.content_json,
      editor_version: payload.editor_version,
    };
    return toDomainNote(augmentedRaw);
  }
}

function normalizeSourceUrl(value: string | null | undefined): string | null {
  return isNonEmptyString(value) ? sanitizeUrl(value) : null;
}

export function buildListParams(params?: {
  courseCode?: string | null;
  sourceUrl?: string | null;
  limit?: number;
}): { courseCode?: string; sourceUrl?: string; limit?: number } {
  const listParams: { courseCode?: string; sourceUrl?: string; limit?: number } = {
    limit: params?.limit ?? DEFAULT_LIST_LIMIT,
  };
  if (isNonEmptyString(params?.courseCode)) {
    listParams.courseCode = params.courseCode;
  }
  if (isNonEmptyString(params?.sourceUrl)) {
    listParams.sourceUrl = params.sourceUrl;
  }
  return listParams;
}

export function buildCreatePayload(initial: CreateNoteInput): NotePayload & { title: string } {
  const cleanSourceUrl = normalizeSourceUrl(initial.sourceUrl);
  const payload: NotePayload & { title: string } = {
    title: initial.title,
    sourceUrl: cleanSourceUrl,
    source_url: cleanSourceUrl,
    sourceSelection: initial.sourceSelection ?? null,
    source_selection: initial.sourceSelection ?? null,
    courseCode: initial.courseCode ?? null,
    course_code: initial.courseCode ?? null,
    noteType: initial.noteType ?? 'manual',
    note_type: initial.noteType ?? 'manual',
    tags: initial.tags ?? [],
    ...toBackendPayload(initial.content),
  };
  if (isNonEmptyString(initial.clientNoteId)) {
    payload.clientNoteId = initial.clientNoteId;
  }
  return payload;
}

function applySourceUrl(payload: NotePayload, sourceUrl: string | null | undefined): void {
  if (sourceUrl === undefined) return;
  const cleanSourceUrl = normalizeSourceUrl(sourceUrl);
  payload.sourceUrl = cleanSourceUrl;
  payload.source_url = cleanSourceUrl;
}

function applySourceSelection(
  payload: NotePayload,
  sourceSelection: string | null | undefined,
): void {
  if (sourceSelection === undefined) return;
  payload.sourceSelection = sourceSelection ?? null;
  payload.source_selection = sourceSelection ?? null;
}

function applyCourseCode(payload: NotePayload, courseCode: string | null | undefined): void {
  if (courseCode === undefined) return;
  payload.courseCode = courseCode ?? null;
  payload.course_code = courseCode ?? null;
}

function applyNoteType(payload: NotePayload, noteType: string | null | undefined): void {
  if (noteType === undefined) return;
  payload.noteType = noteType ?? null;
  payload.note_type = noteType ?? null;
}

function applyTags(payload: NotePayload, tags: string[] | undefined): void {
  if (tags === undefined) return;
  payload.tags = tags;
}

export function buildUpdatePayload(changes: UpdateNoteInput): NotePayload {
  const payload: NotePayload = {
    ...toBackendPayload(changes.content),
  };

  if (isNonEmptyString(changes.title)) {
    payload.title = changes.title;
  }

  applySourceUrl(payload, changes.sourceUrl);
  applySourceSelection(payload, changes.sourceSelection);
  applyCourseCode(payload, changes.courseCode);
  applyNoteType(payload, changes.noteType);
  applyTags(payload, changes.tags);

  return payload;
}

export function buildUpdateRequestOptions(
  options?: NoteRequestOptions,
): { signal?: AbortSignal; ifUnmodifiedSince?: string } | undefined {
  const requestOptions: { signal?: AbortSignal; ifUnmodifiedSince?: string } = {};
  if (options?.signal !== undefined) {
    requestOptions.signal = options.signal;
  }
  if (typeof options?.expectedUpdatedAt === 'string') {
    requestOptions.ifUnmodifiedSince = options.expectedUpdatedAt;
  }
  return Object.keys(requestOptions).length > 0 ? requestOptions : undefined;
}
