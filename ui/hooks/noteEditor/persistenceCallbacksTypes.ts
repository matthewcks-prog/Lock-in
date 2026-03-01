import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Note, NoteContent, NoteStatus } from '@core/domain/Note';
import type { NotesService } from '@core/services/notesService';
import type { PersistenceDefaults } from './noteEditorPersistenceHelpers';

export interface UsePersistenceCallbacksOptions {
  notesService: NotesService | null | undefined;
  noteRef: MutableRefObject<Note | null>;
  clientNoteIdRef: MutableRefObject<string>;
  lastSavedFingerprintRef: MutableRefObject<string | null>;
  saveSequenceRef: MutableRefObject<number>;
  debounceRef: MutableRefObject<number | null>;
  savedResetRef: MutableRefObject<number | null>;
  abortControllerRef: MutableRefObject<AbortController | null>;
  defaults: PersistenceDefaults;
  setPendingSaveCount: Dispatch<SetStateAction<number>>;
  setNote: Dispatch<SetStateAction<Note | null>>;
  setStatus: Dispatch<SetStateAction<NoteStatus>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setActiveNoteId: (noteId: string | null) => void;
}

export interface UsePersistenceCallbacksResult {
  handleContentChange: (content: NoteContent) => void;
  handleTitleChange: (title: string) => void;
  saveNow: () => Promise<void>;
  resetToNew: () => void;
  syncOfflineQueue: () => Promise<void>;
}
