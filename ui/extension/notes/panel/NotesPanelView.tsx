import { ConfirmDialog, Toast } from '@shared/ui/components';
import { NoteEditor } from '../NoteEditor';
import { NotesListView } from './NotesListView';
import { NotesPanelHeader } from './NotesPanelHeader';
import type { NotesPanelViewModel } from './useNotesPanelModel';

function PanelHeader({ model }: { model: NotesPanelViewModel }): JSX.Element {
  return (
    <NotesPanelHeader
      courseCode={model.courseCode}
      weekLabel={model.weekLabel}
      linkedTarget={model.linkedTarget}
      view={model.viewState.view}
      onViewChange={model.viewState.setView}
      showActions={model.showActions}
      isStarred={model.isCurrentNoteStarred}
      isDeleting={
        model.actions.isDeleting !== null && model.actions.isDeleting === model.editor.activeNoteId
      }
      onToggleStar={model.actions.handleHeaderToggleStar}
      onDeleteNote={model.actions.handleHeaderDelete}
      onNewNote={model.actions.handleNewNote}
      note={model.editor.note}
      week={model.currentWeek}
      onExportError={(error) => model.toastState.showToast(error, 'error')}
    />
  );
}

function DeleteErrorBanner({ model }: { model: NotesPanelViewModel }): JSX.Element | null {
  if (model.actions.deleteError === null) return null;
  return (
    <div className="lockin-notes-error">
      {model.actions.deleteError}
      <button
        type="button"
        className="lockin-notes-error-dismiss"
        onClick={model.actions.clearDeleteError}
      >
        A-
      </button>
    </div>
  );
}

function CurrentNoteEditor({ model }: { model: NotesPanelViewModel }): JSX.Element {
  return (
    <NoteEditor
      note={model.editor.note}
      status={model.editor.status}
      title={model.editor.note?.title ?? ''}
      onTitleChange={model.editor.handleTitleChange}
      onContentChange={model.editor.handleContentChange}
      onSaveNow={() => void model.editor.saveNow()}
      onUploadFile={model.assets.uploadAsset}
      onDeleteAsset={model.assets.deleteAsset}
      isAssetUploading={model.assets.isUploading}
      assetError={model.assets.error}
      editorError={model.editor.error}
    />
  );
}

function AllNotesList({ model }: { model: NotesPanelViewModel }): JSX.Element {
  return (
    <NotesListView
      notesLoading={model.notesLoading}
      filter={model.viewState.filter}
      onFilterChange={model.viewState.setFilter}
      search={model.viewState.search}
      onSearchChange={model.viewState.setSearch}
      onRefreshNotes={model.onRefreshNotes}
      filteredNotes={model.filteredNotes}
      activeNoteId={model.editor.activeNoteId}
      onSelectNote={model.actions.handleSelectNote}
      onToggleStar={(noteId, event) => void model.actions.handleToggleStar(noteId, event)}
      onDeleteNote={model.actions.openDeleteConfirm}
      isDeleting={model.actions.isDeleting}
      onCreateNote={() => model.viewState.setView('current')}
    />
  );
}

function PanelBody({ model }: { model: NotesPanelViewModel }): JSX.Element {
  return (
    <div className="lockin-notes-body">
      {model.viewState.view === 'current' && <CurrentNoteEditor model={model} />}
      {model.viewState.view === 'all' && <AllNotesList model={model} />}
    </div>
  );
}

function DeleteDialog({ model }: { model: NotesPanelViewModel }): JSX.Element {
  return (
    <ConfirmDialog
      isOpen={model.actions.deleteConfirmId !== null}
      onClose={model.actions.closeDeleteConfirm}
      onConfirm={() => void model.actions.executeDelete()}
      title="Delete Note"
      description={`Are you sure you want to delete "${model.actions.noteToDeleteTitle}"? This action cannot be undone.`}
      confirmLabel="Delete"
      cancelLabel="Cancel"
      variant="danger"
      isLoading={model.actions.isDeleting !== null}
    />
  );
}

function PanelToast({ model }: { model: NotesPanelViewModel }): JSX.Element | null {
  const toast = model.toastState.toast;
  if (toast === null) return null;
  return (
    <Toast
      message={toast.message}
      type={toast.type}
      isVisible={toast.isVisible}
      onDismiss={model.toastState.hideToast}
    />
  );
}

interface NotesPanelViewProps {
  model: NotesPanelViewModel;
}

export function NotesPanelView({ model }: NotesPanelViewProps): JSX.Element {
  return (
    <div className="lockin-notes-panel">
      <PanelHeader model={model} />
      <DeleteErrorBanner model={model} />
      <PanelBody model={model} />
      <DeleteDialog model={model} />
      <PanelToast model={model} />
    </div>
  );
}
