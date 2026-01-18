import { useEffect, useMemo, useRef, useState } from 'react';
import type { Note } from '@core/domain/Note';
import type { NotesService } from '@core/services/notesService';
import { ConfirmDialog, Toast, useToast } from '@shared/ui/components';
import { useNoteAssets } from '../../hooks/useNoteAssets';
import { useNoteEditor } from '../../hooks/useNoteEditor';
import { NoteEditor } from './NoteEditor';
import { NotesListView } from './panel/NotesListView';
import { NotesPanelHeader } from './panel/NotesPanelHeader';
import { filterNotes } from './panel/noteFilters';
import { useNotesPanelActions } from './panel/useNotesPanelActions';

interface NotesPanelProps {
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

function formatLinkedLabel(week: number | null | undefined): string | null {
  if (week != null && week > 0) {
    return `Week ${week}`;
  }
  return null;
}

export function NotesPanel({
  notesService,
  notes,
  notesLoading,
  onRefreshNotes,
  onNoteSaved,
  onDeleteNote,
  onToggleStar,
  activeNoteId,
  onSelectNote,
  courseCode,
  pageUrl,
  currentWeek,
  onNoteEditingChange,
}: NotesPanelProps) {
  const [view, setView] = useState<'current' | 'all'>('current');
  const [filter, setFilter] = useState<'course' | 'all' | 'starred'>('course');
  const [search, setSearch] = useState('');
  const { toast, showToast, hideToast } = useToast();
  const hasValidWeek = currentWeek != null && currentWeek > 0;
  const effectiveSourceUrl = hasValidWeek ? pageUrl : null;

  const {
    note,
    status,
    error: editorError,
    activeNoteId: editorActiveId,
    handleContentChange,
    handleTitleChange,
    saveNow,
    resetToNew,
  } = useNoteEditor({
    noteId: activeNoteId,
    notesService,
    defaultCourseCode: courseCode,
    defaultSourceUrl: effectiveSourceUrl,
  });

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

  useEffect(() => {
    if (status === 'saved' && note) {
      onNoteSaved(note);
    }
  }, [note, onNoteSaved, status]);

  useEffect(() => {
    const isEditing = status === 'editing' || status === 'saving';
    if (isEditing) {
      onNoteEditingChange?.(true);
      return;
    }

    const timeout = window.setTimeout(() => {
      onNoteEditingChange?.(false);
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [onNoteEditingChange, status]);

  const {
    isUploading: isAssetUploading,
    error: noteAssetError,
    uploadAsset,
    deleteAsset,
  } = useNoteAssets(editorActiveId, notesService);

  const currentNoteFromList = useMemo(() => {
    if (!editorActiveId) return null;
    return notes.find((n) => n.id === editorActiveId) || null;
  }, [editorActiveId, notes]);

  const isCurrentNoteStarred = currentNoteFromList?.isStarred ?? note?.isStarred ?? false;
  const filteredNotes = useMemo(
    () =>
      filterNotes({
        notes,
        courseCode,
        filter,
        search,
      }),
    [courseCode, filter, notes, search],
  );
  const {
    deleteConfirmId,
    noteToDeleteTitle,
    deleteError,
    isDeleting,
    openDeleteConfirm,
    closeDeleteConfirm,
    executeDelete,
    handleToggleStar,
    handleHeaderToggleStar,
    handleHeaderDelete,
    handleNewNote,
    handleSelectNote,
    clearDeleteError,
  } = useNotesPanelActions({
    editorActiveId,
    noteTitle: note?.title || '',
    onDeleteNote,
    onToggleStar,
    onNoteSaved,
    onSelectNote,
    resetToNew,
    showToast,
    setView,
  });

  const weekLabel = formatLinkedLabel(currentWeek);
  const linkedTarget = weekLabel ? note?.sourceUrl || pageUrl : null;
  const showActions = view === 'current' && !!editorActiveId;

  return (
    <div className="lockin-notes-panel">
      <NotesPanelHeader
        courseCode={courseCode}
        weekLabel={weekLabel}
        linkedTarget={linkedTarget}
        view={view}
        onViewChange={setView}
        showActions={showActions}
        isStarred={isCurrentNoteStarred}
        isDeleting={isDeleting === editorActiveId}
        onToggleStar={handleHeaderToggleStar}
        onDeleteNote={handleHeaderDelete}
        onNewNote={handleNewNote}
      />

      {deleteError && (
        <div className="lockin-notes-error">
          {deleteError}
          <button
            type="button"
            className="lockin-notes-error-dismiss"
            onClick={clearDeleteError}
          >
            A-
          </button>
        </div>
      )}

      <div className="lockin-notes-body">
        {view === 'current' && (
          <NoteEditor
            note={note}
            status={status}
            title={note?.title || ''}
            onTitleChange={handleTitleChange}
            onContentChange={handleContentChange}
            onSaveNow={saveNow}
            onUploadFile={uploadAsset}
            onDeleteAsset={deleteAsset}
            isAssetUploading={isAssetUploading}
            assetError={noteAssetError}
            editorError={editorError}
          />
        )}

        {view === 'all' && (
          <NotesListView
            notesLoading={notesLoading}
            filter={filter}
            onFilterChange={setFilter}
            search={search}
            onSearchChange={setSearch}
            onRefreshNotes={onRefreshNotes}
            filteredNotes={filteredNotes}
            activeNoteId={editorActiveId}
            onSelectNote={handleSelectNote}
            onToggleStar={handleToggleStar}
            onDeleteNote={openDeleteConfirm}
            isDeleting={isDeleting}
            onCreateNote={() => setView('current')}
          />
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={closeDeleteConfirm}
        onConfirm={executeDelete}
        title="Delete Note"
        description={`Are you sure you want to delete "${noteToDeleteTitle}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeleting !== null}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={toast.isVisible}
          onDismiss={hideToast}
        />
      )}
    </div>
  );
}
