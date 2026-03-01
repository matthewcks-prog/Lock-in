import type { Note } from '@core/domain/Note';
import type { ApiClient } from '@api/client';
import type { NotesService } from '@core/services/notesService';
import type { TasksService } from '@core/services/tasksService';
import type { StorageAdapter } from './types';
import type { useResize } from './useResize';
import type { useSidebarState } from './useSidebarState';
import type { useNotesList } from '../../hooks/useNotesList';

export interface SidebarModel {
  activeTab: ReturnType<typeof useSidebarState>['activeTab'];
  activeToolId: string | null;
  activeToolTitle: string | null;
  closeTool: () => void;
  courseCode: string | null;
  currentWeek: number | null;
  deleteNoteFromList: (noteId: string) => Promise<void>;
  handleResizeStart: ReturnType<typeof useResize>['handleResizeStart'];
  handleTabChange: ReturnType<typeof useSidebarState>['handleTabChange'];
  isFeedbackOpen: boolean;
  notes: ReturnType<typeof useNotesList>['notes'];
  notesLoading: boolean;
  notesService: NotesService | null;
  onClearPrefill?: (() => void) | undefined;
  onToggle: () => void;
  pageUrl: string;
  pendingPrefill?: string | undefined;
  refreshNotes: ReturnType<typeof useNotesList>['refresh'];
  selectedNoteId: string | null;
  setActiveTab: ReturnType<typeof useSidebarState>['setActiveTab'];
  setIsFeedbackOpen: (isOpen: boolean) => void;
  setIsNoteEditing: ReturnType<typeof useSidebarState>['setIsNoteEditing'];
  setSelectedNoteId: ReturnType<typeof useSidebarState>['setSelectedNoteId'];
  storage?: StorageAdapter | undefined;
  tasksService: TasksService | null;
  toggleNoteStar: ReturnType<typeof useNotesList>['toggleStar'];
  upsertNote: ReturnType<typeof useNotesList>['upsertNote'];
  isOpen: boolean;
  apiClient: ApiClient | null;
}

export interface NotesPanelHandlers {
  onDeleteNote: (noteId: string) => Promise<void>;
  onNoteSaved: (note: Note) => void;
  onRefreshNotes: () => void;
}
