import type { Note } from '@core/domain/Note';
import { ChevronDown, RotateCcw } from 'lucide-react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { NotesListItem } from './NotesListItem';

type NotesFilter = 'course' | 'all' | 'starred';

interface NotesListViewProps {
  notesLoading: boolean;
  filter: NotesFilter;
  onFilterChange: (value: NotesFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onRefreshNotes: () => void;
  filteredNotes: Note[];
  activeNoteId: string | null;
  onSelectNote: (noteId: string | null) => void;
  onToggleStar: (noteId: string, event: ReactMouseEvent) => void;
  onDeleteNote: (noteId: string, title: string, event: ReactMouseEvent) => void;
  isDeleting: string | null;
  onCreateNote: () => void;
}

function hasNoteId(note: Note): note is Note & { id: string } {
  return note.id !== null && note.id.length > 0;
}

function resolveNoteId(note: Note): string | null {
  return hasNoteId(note) ? note.id : null;
}

function resolveNoteTitle(note: Note): string {
  return note.title.length > 0 ? note.title : 'Untitled';
}

function resolveItemKey(note: Note): string {
  return hasNoteId(note) ? note.id : note.title;
}

function NotesFilterSelect({
  filter,
  onFilterChange,
}: {
  filter: NotesFilter;
  onFilterChange: (value: NotesFilter) => void;
}): JSX.Element {
  return (
    <div className="lockin-notes-filter-select-shell">
      <select
        className="lockin-notes-filter-select"
        value={filter}
        onChange={(e) => onFilterChange(e.target.value as NotesFilter)}
      >
        <option value="course">This course</option>
        <option value="all">All notes</option>
        <option value="starred">Starred</option>
      </select>
      <ChevronDown
        aria-hidden="true"
        className="lockin-notes-filter-select-chevron"
        size={12}
        strokeWidth={2}
      />
    </div>
  );
}

function NotesFilterBar({
  filter,
  onFilterChange,
  search,
  onSearchChange,
  onRefreshNotes,
}: {
  filter: NotesFilter;
  onFilterChange: (value: NotesFilter) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onRefreshNotes: () => void;
}): JSX.Element {
  return (
    <div className="lockin-notes-filter-bar">
      <div className="lockin-notes-filter-group">
        <span className="lockin-notes-filter-label">Filter</span>
        <NotesFilterSelect filter={filter} onFilterChange={onFilterChange} />
      </div>
      <input
        type="text"
        className="lockin-notes-search-input"
        placeholder="Search notes"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <button
        type="button"
        className="lockin-notes-refresh-btn"
        onClick={onRefreshNotes}
        title="Refresh notes"
        aria-label="Refresh notes"
      >
        <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}

function NotesEmptyState({ onCreateNote }: { onCreateNote: () => void }): JSX.Element {
  return (
    <div className="lockin-notes-empty">
      <div className="lockin-notes-empty-title">No notes yet</div>
      <div className="lockin-notes-empty-subtitle">
        Capture a note from the current page to see it here.
      </div>
      <button
        type="button"
        className="lockin-btn-ghost lockin-notes-empty-btn"
        onClick={onCreateNote}
      >
        Create a note
      </button>
    </div>
  );
}

function NotesItems({
  filteredNotes,
  activeNoteId,
  isDeleting,
  onSelectNote,
  onToggleStar,
  onDeleteNote,
}: {
  filteredNotes: Note[];
  activeNoteId: string | null;
  isDeleting: string | null;
  onSelectNote: (noteId: string | null) => void;
  onToggleStar: (noteId: string, event: ReactMouseEvent) => void;
  onDeleteNote: (noteId: string, title: string, event: ReactMouseEvent) => void;
}): JSX.Element {
  return (
    <>
      {filteredNotes.map((item) => {
        const noteId = resolveNoteId(item);
        return (
          <NotesListItem
            key={resolveItemKey(item)}
            note={item}
            isActive={noteId !== null && noteId === activeNoteId}
            isDeleting={noteId !== null && isDeleting === noteId}
            onSelect={() => onSelectNote(noteId)}
            onToggleStar={(event) => {
              if (noteId !== null) onToggleStar(noteId, event);
            }}
            onDeleteNote={(event) => {
              if (noteId === null) return;
              onDeleteNote(noteId, resolveNoteTitle(item), event);
            }}
          />
        );
      })}
    </>
  );
}

export function NotesListView({
  notesLoading,
  filter,
  onFilterChange,
  search,
  onSearchChange,
  onRefreshNotes,
  filteredNotes,
  activeNoteId,
  onSelectNote,
  onToggleStar,
  onDeleteNote,
  isDeleting,
  onCreateNote,
}: NotesListViewProps): JSX.Element {
  let listContent: JSX.Element;
  if (notesLoading) {
    listContent = <div className="lockin-notes-empty">Loading notes...</div>;
  } else if (filteredNotes.length === 0) {
    listContent = <NotesEmptyState onCreateNote={onCreateNote} />;
  } else {
    listContent = (
      <NotesItems
        filteredNotes={filteredNotes}
        activeNoteId={activeNoteId}
        isDeleting={isDeleting}
        onSelectNote={onSelectNote}
        onToggleStar={onToggleStar}
        onDeleteNote={onDeleteNote}
      />
    );
  }

  return (
    <div className="lockin-notes-list-container">
      <NotesFilterBar
        filter={filter}
        onFilterChange={onFilterChange}
        search={search}
        onSearchChange={onSearchChange}
        onRefreshNotes={onRefreshNotes}
      />
      <div className="lockin-notes-list">{listContent}</div>
    </div>
  );
}
