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

export function createNotesClient(apiRequest: ApiRequest) {
  async function createNote(
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

  async function updateNote(
    noteId: string,
    note: NotePayload,
    options?: ApiRequestOptions,
  ): Promise<Record<string, unknown>> {
    if (!noteId) {
      throw new Error('noteId is required to update a note');
    }
    const raw = await apiRequest<unknown>(`/api/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify(note),
      ...options,
    });
    return validateNoteRecord(raw, 'updateNote');
  }

  async function deleteNote(noteId: string): Promise<void> {
    if (!noteId) {
      throw new Error('noteId is required to delete a note');
    }
    return apiRequest<void>(`/api/notes/${noteId}`, {
      method: 'DELETE',
    });
  }

  async function toggleNoteStar(noteId: string): Promise<Record<string, unknown>> {
    if (!noteId) {
      throw new Error('noteId is required to toggle star');
    }
    const raw = await apiRequest<unknown>(`/api/notes/${noteId}/star`, {
      method: 'PATCH',
    });
    return validateNoteRecord(raw, 'toggleNoteStar');
  }

  async function setNoteStar(noteId: string, isStarred: boolean): Promise<Record<string, unknown>> {
    if (!noteId) {
      throw new Error('noteId is required to set star');
    }
    const raw = await apiRequest<unknown>(`/api/notes/${noteId}/star`, {
      method: 'PUT',
      body: JSON.stringify({ isStarred }),
    });
    return validateNoteRecord(raw, 'setNoteStar');
  }

  async function listNotes(params: ListNotesParams = {}): Promise<Record<string, unknown>[]> {
    const { sourceUrl, courseCode, limit = 50 } = params;
    const queryParams = new URLSearchParams();
    if (sourceUrl) queryParams.set('sourceUrl', sourceUrl);
    if (courseCode) queryParams.set('courseCode', courseCode);
    if (limit) queryParams.set('limit', String(limit));

    const endpoint = `/api/notes${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const raw = await apiRequest<unknown>(endpoint, {
      method: 'GET',
    });
    return validateNoteRecords(raw, 'listNotes');
  }

  async function searchNotes(params: SearchNotesParams): Promise<Record<string, unknown>[]> {
    const { query, courseCode, k = 10 } = params;
    const queryParams = new URLSearchParams({ q: query, k: String(k) });
    if (courseCode) queryParams.set('courseCode', courseCode);

    const raw = await apiRequest<unknown>(`/api/notes/search?${queryParams.toString()}`, {
      method: 'GET',
    });
    return validateNoteRecords(raw, 'searchNotes');
  }

  async function chatWithNotes(params: ChatWithNotesParams): Promise<{
    answer: string;
    usedNotes: Record<string, unknown>[];
  }> {
    const raw = await apiRequest<unknown>('/api/notes/chat', {
      method: 'POST',
      body: JSON.stringify({ query: params.query, courseCode: params.courseCode, k: params.k }),
    });
    return validateNotesChatResponse(raw, 'chatWithNotes');
  }

  return {
    createNote,
    updateNote,
    deleteNote,
    toggleNoteStar,
    setNoteStar,
    listNotes,
    searchNotes,
    chatWithNotes,
  };
}
