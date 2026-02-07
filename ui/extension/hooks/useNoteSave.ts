import { useCallback } from 'react';
import type { Note, NoteContent, NoteType } from '@core/domain/Note';
import type { NotesService } from '@core/services/notesService';
import { createNoteContentFromPlainText } from '../notes/content';
import type { SidebarTabId } from '../sidebar/types';

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
}: UseNoteSaveOptions) {
  const saveNote = useCallback(
    async (options: SaveNoteOptions): Promise<Note | null> => {
      // Early return if notes service is not available
      if (!notesService) {
        console.warn('NotesService not available, switching to Notes tab');
        setActiveTab('notes');
        return null;
      }

      try {
        // Convert content to NoteContent if it's a string
        const noteContent: NoteContent =
          typeof options.content === 'string'
            ? createNoteContentFromPlainText(options.content.trim())
            : options.content;

        // Generate title from content if not provided
        let noteTitle = options.title;
        if (!noteTitle) {
          const contentText =
            typeof options.content === 'string' ? options.content : options.content.plainText || '';
          const firstLine = contentText.split('\n')[0]?.trim() ?? '';
          noteTitle = firstLine.slice(0, 50) || 'Untitled note';
        }

        // Create the note
        const createdNote = await notesService.createNote({
          title: noteTitle,
          content: noteContent,
          sourceUrl: options.sourceUrl ?? pageUrl,
          sourceSelection: options.sourceSelection ?? null,
          courseCode: options.courseCode ?? courseCode ?? null,
          noteType: options.noteType ?? 'manual',
          tags: options.tags ?? [],
        });

        // Update note list and select the new note
        upsertNote(createdNote);
        setSelectedNoteId(createdNote.id);

        // Navigate to Notes tab
        setActiveTab('notes');

        // Call success callback if provided
        if (options.onSuccess) {
          options.onSuccess(createdNote);
        }

        return createdNote;
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error('Failed to save note');
        console.error('Failed to save note:', err);

        // Call error callback if provided
        if (options.onError) {
          options.onError(err);
        }

        // Still navigate to Notes tab on error
        setActiveTab('notes');

        return null;
      }
    },
    [notesService, pageUrl, courseCode, upsertNote, setSelectedNoteId, setActiveTab],
  );

  return { saveNote };
}
