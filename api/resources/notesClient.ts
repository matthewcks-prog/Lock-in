import type { ApiRequest, ApiRequestOptions } from '../fetcher';
import { validateNoteRecord, validateNoteRecords, validateNotesChatResponse } from '../validation';

export interface ListNotesParams {
  sourceUrl?: string;
  courseCode?: string;
  limit?: number;
}

export interface SearchNotesParams {
  query: string;
  courseCode?: string;
  k?: number;
}

export interface ChatWithNotesParams {
  query: string;
  courseCode?: string;
  k?: number;
}

type NotePayload = {
  title?: string;
  content?: string;
  content_text?: string | null;
  content_json?: unknown;
  contentJson?: unknown;
  editor_version?: string;
  clientNoteId?: string;
  sourceSelection?: string | null;
  source_selection?: string | null;
  sourceUrl?: string | null;
  source_url?: string | null;
  courseCode?: string | null;
  course_code?: string | null;
  noteType?: string | null;
  note_type?: string | null;
  tags?: string[];
};

export type NotesClient = {
  createNote: (
    note: NotePayload & { title: string },
    options?: ApiRequestOptions,
  ) => Promise<Record<string, unknown>>;
  updateNote: (
    noteId: string,
    note: NotePayload,
    options?: ApiRequestOptions,
  ) => Promise<Record<string, unknown>>;
  deleteNote: (noteId: string) => Promise<void>;
  toggleNoteStar: (noteId: string) => Promise<Record<string, unknown>>;
  setNoteStar: (noteId: string, isStarred: boolean) => Promise<Record<string, unknown>>;
  listNotes: (params?: ListNotesParams) => Promise<Record<string, unknown>[]>;
  searchNotes: (params: SearchNotesParams) => Promise<Record<string, unknown>[]>;
  chatWithNotes: (params: ChatWithNotesParams) => Promise<{
    answer: string;
    usedNotes: Record<string, unknown>[];
  }>;
};

const DEFAULT_LIST_LIMIT = 50;
const DEFAULT_SEARCH_K = 10;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

async function createNoteRequest(
  apiRequest: ApiRequest,
  note: NotePayload & { title: string },
  options?: ApiRequestOptions,
): Promise<Record<string, unknown>> {
  const raw = await apiRequest<unknown>('/api/notes', {
    method: 'POST',
    body: JSON.stringify(note),
    ...options,
  });
  return validateNoteRecord(raw, 'createNote');
}

async function updateNoteRequest(
  apiRequest: ApiRequest,
  noteId: string,
  note: NotePayload,
  options?: ApiRequestOptions,
): Promise<Record<string, unknown>> {
  if (!isNonEmptyString(noteId)) {
    throw new Error('noteId is required to update a note');
  }
  const raw = await apiRequest<unknown>(`/api/notes/${noteId}`, {
    method: 'PUT',
    body: JSON.stringify(note),
    ...options,
  });
  return validateNoteRecord(raw, 'updateNote');
}

async function deleteNoteRequest(apiRequest: ApiRequest, noteId: string): Promise<void> {
  if (!isNonEmptyString(noteId)) {
    throw new Error('noteId is required to delete a note');
  }
  return apiRequest<void>(`/api/notes/${noteId}`, {
    method: 'DELETE',
  });
}

async function toggleNoteStarRequest(
  apiRequest: ApiRequest,
  noteId: string,
): Promise<Record<string, unknown>> {
  if (!isNonEmptyString(noteId)) {
    throw new Error('noteId is required to toggle star');
  }
  const raw = await apiRequest<unknown>(`/api/notes/${noteId}/star`, {
    method: 'PATCH',
  });
  return validateNoteRecord(raw, 'toggleNoteStar');
}

async function setNoteStarRequest(
  apiRequest: ApiRequest,
  noteId: string,
  isStarred: boolean,
): Promise<Record<string, unknown>> {
  if (!isNonEmptyString(noteId)) {
    throw new Error('noteId is required to set star');
  }
  const raw = await apiRequest<unknown>(`/api/notes/${noteId}/star`, {
    method: 'PUT',
    body: JSON.stringify({ isStarred }),
  });
  return validateNoteRecord(raw, 'setNoteStar');
}

async function listNotesRequest(
  apiRequest: ApiRequest,
  params: ListNotesParams = {},
): Promise<Record<string, unknown>[]> {
  const queryParams = new URLSearchParams();
  if (isNonEmptyString(params.sourceUrl)) queryParams.set('sourceUrl', params.sourceUrl);
  if (isNonEmptyString(params.courseCode)) queryParams.set('courseCode', params.courseCode);

  const limit =
    typeof params.limit === 'number' && Number.isFinite(params.limit)
      ? params.limit
      : DEFAULT_LIST_LIMIT;
  if (Number.isFinite(limit)) queryParams.set('limit', String(limit));

  const query = queryParams.toString();
  const endpoint = `/api/notes${query.length > 0 ? `?${query}` : ''}`;
  const raw = await apiRequest<unknown>(endpoint, {
    method: 'GET',
  });
  return validateNoteRecords(raw, 'listNotes');
}

async function searchNotesRequest(
  apiRequest: ApiRequest,
  params: SearchNotesParams,
): Promise<Record<string, unknown>[]> {
  const queryParams = new URLSearchParams({
    q: params.query,
    k: String(
      typeof params.k === 'number' && Number.isFinite(params.k) ? params.k : DEFAULT_SEARCH_K,
    ),
  });
  if (isNonEmptyString(params.courseCode)) queryParams.set('courseCode', params.courseCode);

  const raw = await apiRequest<unknown>(`/api/notes/search?${queryParams.toString()}`, {
    method: 'GET',
  });
  return validateNoteRecords(raw, 'searchNotes');
}

async function chatWithNotesRequest(
  apiRequest: ApiRequest,
  params: ChatWithNotesParams,
): Promise<{ answer: string; usedNotes: Record<string, unknown>[] }> {
  const raw = await apiRequest<unknown>('/api/notes/chat', {
    method: 'POST',
    body: JSON.stringify({ query: params.query, courseCode: params.courseCode, k: params.k }),
  });
  return validateNotesChatResponse(raw, 'chatWithNotes');
}

export function createNotesClient(apiRequest: ApiRequest): NotesClient {
  return {
    createNote: async (note, options) => createNoteRequest(apiRequest, note, options),
    updateNote: async (noteId, note, options) =>
      updateNoteRequest(apiRequest, noteId, note, options),
    deleteNote: async (noteId) => deleteNoteRequest(apiRequest, noteId),
    toggleNoteStar: async (noteId) => toggleNoteStarRequest(apiRequest, noteId),
    setNoteStar: async (noteId, isStarred) => setNoteStarRequest(apiRequest, noteId, isStarred),
    listNotes: async (params) => listNotesRequest(apiRequest, params),
    searchNotes: async (params) => searchNotesRequest(apiRequest, params),
    chatWithNotes: async (params) => chatWithNotesRequest(apiRequest, params),
  };
}
