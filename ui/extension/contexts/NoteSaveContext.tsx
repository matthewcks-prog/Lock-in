/**
 * Note Save Context
 *
 * Provides universal access to note saving functionality across the extension.
 * Follows the ToolContext.tsx pattern for consistency.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Note } from '@core/domain/Note';
import type { NotesService } from '@core/services/notesService';
import { useNoteSave, type SaveNoteOptions } from '../../hooks/useNoteSave';
import type { SidebarTabId } from '../sidebar/types';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface NoteSaveContextValue {
  /** Save content as a note with optional configuration */
  saveNote: (options: SaveNoteOptions) => Promise<Note | null>;
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const NoteSaveContext = createContext<NoteSaveContextValue | null>(null);

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

interface NoteSaveProviderProps {
  notesService: NotesService | null;
  pageUrl: string | null;
  courseCode: string | null;
  upsertNote: (note: Note) => void;
  setSelectedNoteId: (id: string | null) => void;
  setActiveTab: (tab: SidebarTabId) => void;
  children: ReactNode;
}

export function NoteSaveProvider({
  notesService,
  pageUrl,
  courseCode,
  upsertNote,
  setSelectedNoteId,
  setActiveTab,
  children,
}: NoteSaveProviderProps) {
  // Use the hook internally
  const { saveNote } = useNoteSave({
    notesService,
    pageUrl,
    courseCode,
    upsertNote,
    setSelectedNoteId,
    setActiveTab,
  });

  // Memoize context value to avoid unnecessary rerenders
  const value = useMemo<NoteSaveContextValue>(
    () => ({
      saveNote,
    }),
    [saveNote],
  );

  return <NoteSaveContext.Provider value={value}>{children}</NoteSaveContext.Provider>;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useNoteSaveContext(): NoteSaveContextValue {
  const context = useContext(NoteSaveContext);
  if (!context) {
    throw new Error('useNoteSaveContext must be used within a NoteSaveProvider');
  }
  return context;
}
