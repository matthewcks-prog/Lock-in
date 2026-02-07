import type { Note, NoteAsset, NoteContent, NoteType } from '../../domain/Note.ts';
import type { Logger } from '../../utils/logger';

export type CreateNoteInput = {
  title: string;
  content: NoteContent;
  sourceUrl?: string | null;
  sourceSelection?: string | null;
  courseCode?: string | null;
  noteType?: NoteType;
  tags?: string[];
  clientNoteId?: string;
};

export type UpdateNoteInput = {
  title?: string;
  content?: NoteContent;
  sourceUrl?: string | null;
  sourceSelection?: string | null;
  courseCode?: string | null;
  noteType?: NoteType;
  tags?: string[];
};

export type NoteRequestOptions = {
  signal?: AbortSignal;
  expectedUpdatedAt?: string | null;
};

export type NotesService = {
  listNotes(params?: {
    courseCode?: string | null;
    sourceUrl?: string | null;
    limit?: number;
  }): Promise<Note[]>;
  getNote(noteId: string): Promise<Note>;
  createNote(initial: CreateNoteInput, options?: NoteRequestOptions): Promise<Note>;
  updateNote(noteId: string, changes: UpdateNoteInput, options?: NoteRequestOptions): Promise<Note>;
  deleteNote(noteId: string): Promise<void>;
  toggleStar(noteId: string): Promise<Note>;
  setStar(noteId: string, isStarred: boolean): Promise<Note>;
  listAssets(noteId: string): Promise<NoteAsset[]>;
  uploadAsset(noteId: string, file: File | Blob): Promise<NoteAsset>;
  deleteAsset(assetId: string): Promise<void>;
};

export type NotesServiceDependencies = {
  logger?: Logger;
};

export type NotesApiClient = {
  apiRequest<T = unknown>(
    path: string,
    options?: { method?: string; signal?: AbortSignal; ifUnmodifiedSince?: string },
  ): Promise<T>;
  listNotes(params?: {
    courseCode?: string | null;
    sourceUrl?: string | null;
    limit?: number;
  }): Promise<Array<Record<string, unknown>>>;
  createNote(
    payload: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ): Promise<Record<string, unknown>>;
  updateNote(
    noteId: string,
    payload: Record<string, unknown>,
    options?: { signal?: AbortSignal; ifUnmodifiedSince?: string },
  ): Promise<Record<string, unknown>>;
  deleteNote(noteId: string): Promise<void>;
  toggleNoteStar: (noteId: string) => Promise<Record<string, unknown>>;
  setNoteStar(noteId: string, isStarred: boolean): Promise<Record<string, unknown>>;
  listNoteAssets(params: { noteId: string }): Promise<NoteAsset[]>;
  uploadNoteAsset(params: { noteId: string; file: File | Blob }): Promise<NoteAsset>;
  deleteNoteAsset(params: { assetId: string }): Promise<void>;
};
