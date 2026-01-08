import type { ApiRequest, ApiRequestOptions } from '../fetcher';

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
  ): Promise<any> {
    return apiRequest<any>('/api/notes', {
      method: 'POST',
      body: JSON.stringify(note),
      ...options,
    });
  }

  async function updateNote(
    noteId: string,
    note: NotePayload,
    options?: ApiRequestOptions,
  ): Promise<any> {
    if (!noteId) {
      throw new Error('noteId is required to update a note');
    }
    return apiRequest<any>(`/api/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify(note),
      ...options,
    });
  }

  async function deleteNote(noteId: string): Promise<void> {
    if (!noteId) {
      throw new Error('noteId is required to delete a note');
    }
    return apiRequest<void>(`/api/notes/${noteId}`, {
      method: 'DELETE',
    });
  }

  async function toggleNoteStar(noteId: string): Promise<any> {
    if (!noteId) {
      throw new Error('noteId is required to toggle star');
    }
    return apiRequest<any>(`/api/notes/${noteId}/star`, {
      method: 'PATCH',
    });
  }

  async function setNoteStar(noteId: string, isStarred: boolean): Promise<any> {
    if (!noteId) {
      throw new Error('noteId is required to set star');
    }
    return apiRequest<any>(`/api/notes/${noteId}/star`, {
      method: 'PUT',
      body: JSON.stringify({ isStarred }),
    });
  }

  async function listNotes(params: ListNotesParams = {}): Promise<any[]> {
    const { sourceUrl, courseCode, limit = 50 } = params;
    const queryParams = new URLSearchParams();
    if (sourceUrl) queryParams.set('sourceUrl', sourceUrl);
    if (courseCode) queryParams.set('courseCode', courseCode);
    if (limit) queryParams.set('limit', String(limit));

    const endpoint = `/api/notes${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiRequest<any[]>(endpoint, {
      method: 'GET',
    });
  }

  async function searchNotes(params: SearchNotesParams): Promise<any[]> {
    const { query, courseCode, k = 10 } = params;
    const queryParams = new URLSearchParams({ q: query, k: String(k) });
    if (courseCode) queryParams.set('courseCode', courseCode);

    return apiRequest<any[]>(`/api/notes/search?${queryParams.toString()}`, {
      method: 'GET',
    });
  }

  async function chatWithNotes(
    params: ChatWithNotesParams,
  ): Promise<{ answer: string; usedNotes: any[] }> {
    return apiRequest<{ answer: string; usedNotes: any[] }>('/api/notes/chat', {
      method: 'POST',
      body: JSON.stringify({ query: params.query, courseCode: params.courseCode, k: params.k }),
    });
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
