import { useCallback } from 'react';
import type { Note, NoteContent, NoteType } from '@core/domain/Note';
import type { NotesService } from '@core/services/notesService';
import { createNoteContentFromPlainText } from '../notes/content';
import type { SidebarTabId } from '../sidebar/types';

const AUTO_TITLE_MAX_LENGTH = 50;

/**
 * Options for saving a note
 */
export interface SaveNoteOptions {
  /** Note content - plain text string or structured NoteContent */
  content: string | NoteContent;
  /** Optional title - defaults to first line or "Untitled note" */
  title?: string;
  /** Note type - defaults to 'manual' */
  noteType?: NoteType;
  /** Optional source selection text */
  sourceSelection?: string | null;
  /** Optional source URL - defaults to pageUrl */
  sourceUrl?: string | null;
  /** Optional course code - defaults to current course */
  courseCode?: string | null;
  /** Optional tags */
  tags?: string[];
  /** Success callback */
  onSuccess?: (note: Note) => void;
  /** Error callback */
  onError?: (error: Error) => void;
}

/**
 * Dependencies required for note saving
 */
export interface UseNoteSaveOptions {
  notesService: NotesService | null;
  pageUrl: string | null;
  courseCode: string | null;
  upsertNote: (note: Note) => void;
  setSelectedNoteId: (id: string | null) => void;
  setActiveTab: (tab: SidebarTabId) => void;
}

interface UseNoteSaveReturn {
  saveNote: (options: SaveNoteOptions) => Promise<Note | null>;
}

function resolveNoteContent(content: SaveNoteOptions['content']): NoteContent {
  return typeof content === 'string' ? createNoteContentFromPlainText(content.trim()) : content;
}

function resolveSourceText(content: SaveNoteOptions['content']): string {
  return typeof content === 'string' ? content : (content.plainText ?? '');
}

function resolveNoteTitle(options: SaveNoteOptions): string {
  if (options.title !== undefined && options.title.length > 0) {
    return options.title;
  }
  const firstLine = resolveSourceText(options.content).split('\n')[0]?.trim() ?? '';
  const titleFromContent = firstLine.slice(0, AUTO_TITLE_MAX_LENGTH);
  return titleFromContent.length > 0 ? titleFromContent : 'Untitled note';
}

function buildCreateNoteInput({
  options,
  noteContent,
  noteTitle,
  pageUrl,
  courseCode,
}: {
  options: SaveNoteOptions;
  noteContent: NoteContent;
  noteTitle: string;
  pageUrl: string | null;
  courseCode: string | null;
}): Parameters<NotesService['createNote']>[0] {
  return {
    title: noteTitle,
    content: noteContent,
    sourceUrl: options.sourceUrl ?? pageUrl,
    sourceSelection: options.sourceSelection ?? null,
    courseCode: options.courseCode ?? courseCode ?? null,
    noteType: options.noteType ?? 'manual',
    tags: options.tags ?? [],
  };
}

function handleCreatedNote({
  note,
  upsertNote,
  setSelectedNoteId,
  setActiveTab,
  onSuccess,
}: {
  note: Note;
  upsertNote: (note: Note) => void;
  setSelectedNoteId: (id: string | null) => void;
  setActiveTab: (tab: SidebarTabId) => void;
  onSuccess: ((note: Note) => void) | undefined;
}): void {
  upsertNote(note);
  setSelectedNoteId(note.id);
  setActiveTab('notes');
  onSuccess?.(note);
}

function normalizeSaveError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Failed to save note');
}

function handleSaveError(
  error: Error,
  setActiveTab: (tab: SidebarTabId) => void,
  onError: ((error: Error) => void) | undefined,
): void {
  console.error('Failed to save note:', error);
  onError?.(error);
  setActiveTab('notes');
}

/**
 * Custom hook for note saving logic
 *
 * Encapsulates all note saving functionality in a reusable hook.
 * Used internally by NoteSaveContext.
 */
export function useNoteSave({
  notesService,
  pageUrl,
  courseCode,
  upsertNote,
  setSelectedNoteId,
  setActiveTab,
}: UseNoteSaveOptions): UseNoteSaveReturn {
  const saveNote = useCallback(
    async (options: SaveNoteOptions): Promise<Note | null> => {
      if (notesService === null) {
        console.warn('NotesService not available, switching to Notes tab');
        setActiveTab('notes');
        return null;
      }

      try {
        const noteContent = resolveNoteContent(options.content);
        const noteTitle = resolveNoteTitle(options);
        const createdNote = await notesService.createNote(
          buildCreateNoteInput({ options, noteContent, noteTitle, pageUrl, courseCode }),
        );
        handleCreatedNote({
          note: createdNote,
          upsertNote,
          setSelectedNoteId,
          setActiveTab,
          onSuccess: options.onSuccess,
        });
        return createdNote;
      } catch (error: unknown) {
        handleSaveError(normalizeSaveError(error), setActiveTab, options.onError);
        return null;
      }
    },
    [notesService, pageUrl, courseCode, upsertNote, setSelectedNoteId, setActiveTab],
  );

  return { saveNote };
}
