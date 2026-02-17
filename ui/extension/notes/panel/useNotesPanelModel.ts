import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Note } from '@core/domain/Note';
import type { NotesService } from '@core/services/notesService';
import { useToast } from '@shared/ui/components';
import { useNoteAssets } from '../../../hooks/useNoteAssets';
import { useNoteEditor } from '../../../hooks/useNoteEditor';
import { filterNotes } from './noteFilters';
import { useNotesPanelActions } from './useNotesPanelActions';

const EDITING_STATUS_SETTLE_DELAY_MS = 3000;

export interface NotesPanelProps {
  notesService: NotesService | null | undefined;
  notes: Note[];
  notesLoading: boolean;
  onRefreshNotes: () => void;
  onNoteSaved: (note: Note) => void;
  onDeleteNote: (noteId: string) => Promise<void>;
  onToggleStar: (noteId: string) => Promise<Note | undefined>;
  activeNoteId: string | null;
  onSelectNote: (noteId: string | null) => void;
  courseCode: string | null;
  pageUrl: string;
  currentWeek?: number | null;
  onNoteEditingChange?: (editing: boolean) => void;
}

export interface NotesPanelViewModel {
  notes: Note[];
  notesLoading: boolean;
  onRefreshNotes: () => void;
  courseCode: string | null;
  pageUrl: string;
  currentWeek: number | null;
  viewState: {
    view: 'current' | 'all';
    setView: (value: 'current' | 'all') => void;
    filter: 'course' | 'all' | 'starred';
    setFilter: (value: 'course' | 'all' | 'starred') => void;
    search: string;
    setSearch: (value: string) => void;
  };
  toastState: ReturnType<typeof useToast>;
  editor: ReturnType<typeof useNoteEditor>;
  assets: ReturnType<typeof useNoteAssets>;
  actions: ReturnType<typeof useNotesPanelActions>;
  filteredNotes: Note[];
  weekLabel: string | null;
  linkedTarget: string | null;
  showActions: boolean;
  isCurrentNoteStarred: boolean;
}

function formatLinkedLabel(week: number | null | undefined): string | null {
  return week !== null && week !== undefined && week > 0 ? `Week ${week}` : null;
}

function hasValidWeek(currentWeek: number | null | undefined): boolean {
  return currentWeek !== null && currentWeek !== undefined && currentWeek > 0;
}

function resolveLinkedTarget({
  weekLabel,
  noteSourceUrl,
  pageUrl,
}: {
  weekLabel: string | null;
  noteSourceUrl: string | null | undefined;
  pageUrl: string;
}): string | null {
  if (weekLabel === null) return null;
  if (noteSourceUrl !== null && noteSourceUrl !== undefined) return noteSourceUrl;
  return pageUrl;
}

function hasActiveEditorNote(editorActiveId: string | null): boolean {
  return editorActiveId !== null && editorActiveId.length > 0;
}

function useSyncEditorSelection({
  editorActiveId,
  activeNoteId,
  onSelectNote,
}: {
  editorActiveId: string | null;
  activeNoteId: string | null;
  onSelectNote: (noteId: string | null) => void;
}): void {
  const prevEditorActiveIdRef = useRef(editorActiveId);
  useEffect(() => {
    if (
      editorActiveId !== prevEditorActiveIdRef.current &&
      editorActiveId !== activeNoteId &&
      editorActiveId !== null
    ) {
      onSelectNote(editorActiveId);
    }
    prevEditorActiveIdRef.current = editorActiveId;
  }, [editorActiveId, activeNoteId, onSelectNote]);
}

function useEmitSavedNote({
  status,
  note,
  onNoteSaved,
}: {
  status: ReturnType<typeof useNoteEditor>['status'];
  note: Note | null;
  onNoteSaved: (note: Note) => void;
}): void {
  useEffect(() => {
    if (status === 'saved' && note !== null) onNoteSaved(note);
  }, [status, note, onNoteSaved]);
}

function useEmitEditingChange({
  status,
  onNoteEditingChange,
}: {
  status: ReturnType<typeof useNoteEditor>['status'];
  onNoteEditingChange: ((editing: boolean) => void) | undefined;
}): void {
  useEffect(() => {
    const isEditing = status === 'editing' || status === 'saving';
    if (isEditing) {
      onNoteEditingChange?.(true);
      return;
    }
    const timeout = window.setTimeout(
      () => onNoteEditingChange?.(false),
      EDITING_STATUS_SETTLE_DELAY_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [status, onNoteEditingChange]);
}

function useCurrentNoteFromList(editorActiveId: string | null, notes: Note[]): Note | null {
  return useMemo(() => {
    if (editorActiveId === null) return null;
    return notes.find((candidate) => candidate.id === editorActiveId) ?? null;
  }, [editorActiveId, notes]);
}

function useFilteredNotes({
  notes,
  courseCode,
  filter,
  search,
}: {
  notes: Note[];
  courseCode: string | null;
  filter: 'course' | 'all' | 'starred';
  search: string;
}): Note[] {
  return useMemo(
    () => filterNotes({ notes, courseCode, filter, search }),
    [notes, courseCode, filter, search],
  );
}

function usePanelActions({
  props,
  editor,
  setView,
  showToast,
}: {
  props: NotesPanelProps;
  editor: ReturnType<typeof useNoteEditor>;
  setView: Dispatch<SetStateAction<'current' | 'all'>>;
  showToast: ReturnType<typeof useToast>['showToast'];
}): ReturnType<typeof useNotesPanelActions> {
  return useNotesPanelActions({
    editorActiveId: editor.activeNoteId,
    noteTitle: editor.note?.title ?? '',
    onDeleteNote: props.onDeleteNote,
    onToggleStar: props.onToggleStar,
    onNoteSaved: props.onNoteSaved,
    onSelectNote: props.onSelectNote,
    resetToNew: editor.resetToNew,
    showToast,
    setView,
  });
}

function useNotesPanelRuntime({
  props,
  filter,
  search,
  setView,
  toastState,
}: {
  props: NotesPanelProps;
  filter: 'course' | 'all' | 'starred';
  search: string;
  setView: Dispatch<SetStateAction<'current' | 'all'>>;
  toastState: ReturnType<typeof useToast>;
}): {
  editor: ReturnType<typeof useNoteEditor>;
  assets: ReturnType<typeof useNoteAssets>;
  currentNoteFromList: Note | null;
  filteredNotes: Note[];
  actions: ReturnType<typeof useNotesPanelActions>;
  weekLabel: string | null;
  linkedTarget: string | null;
} {
  const effectiveSourceUrl = hasValidWeek(props.currentWeek) ? props.pageUrl : null;
  const editor = useNoteEditor({
    noteId: props.activeNoteId,
    notesService: props.notesService,
    defaultCourseCode: props.courseCode,
    defaultSourceUrl: effectiveSourceUrl,
  });
  const assets = useNoteAssets(editor.activeNoteId, props.notesService);
  const currentNoteFromList = useCurrentNoteFromList(editor.activeNoteId, props.notes);
  const filteredNotes = useFilteredNotes({
    notes: props.notes,
    courseCode: props.courseCode,
    filter,
    search,
  });
  const actions = usePanelActions({ props, editor, setView, showToast: toastState.showToast });
  const weekLabel = formatLinkedLabel(props.currentWeek);
  const linkedTarget = resolveLinkedTarget({
    weekLabel,
    noteSourceUrl: editor.note?.sourceUrl,
    pageUrl: props.pageUrl,
  });
  return { editor, assets, currentNoteFromList, filteredNotes, actions, weekLabel, linkedTarget };
}

export function useNotesPanelModel(props: NotesPanelProps): NotesPanelViewModel {
  const [view, setView] = useState<'current' | 'all'>('current');
  const [filter, setFilter] = useState<'course' | 'all' | 'starred'>('course');
  const [search, setSearch] = useState('');
  const toastState = useToast();
  const runtime = useNotesPanelRuntime({ props, filter, search, setView, toastState });

  useSyncEditorSelection({
    editorActiveId: runtime.editor.activeNoteId,
    activeNoteId: props.activeNoteId,
    onSelectNote: props.onSelectNote,
  });
  useEmitSavedNote({
    status: runtime.editor.status,
    note: runtime.editor.note,
    onNoteSaved: props.onNoteSaved,
  });
  useEmitEditingChange({
    status: runtime.editor.status,
    onNoteEditingChange: props.onNoteEditingChange,
  });

  return {
    notes: props.notes,
    notesLoading: props.notesLoading,
    onRefreshNotes: props.onRefreshNotes,
    courseCode: props.courseCode,
    pageUrl: props.pageUrl,
    currentWeek: props.currentWeek ?? null,
    viewState: { view, setView, filter, setFilter, search, setSearch },
    toastState,
    editor: runtime.editor,
    assets: runtime.assets,
    actions: runtime.actions,
    filteredNotes: runtime.filteredNotes,
    weekLabel: runtime.weekLabel,
    linkedTarget: runtime.linkedTarget,
    showActions: view === 'current' && hasActiveEditorNote(runtime.editor.activeNoteId),
    isCurrentNoteStarred:
      runtime.currentNoteFromList?.isStarred ?? runtime.editor.note?.isStarred ?? false,
  };
}
