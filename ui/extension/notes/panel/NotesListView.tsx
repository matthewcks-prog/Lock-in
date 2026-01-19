import type { Note } from '@core/domain/Note';
import { NotesListItem } from './NotesListItem';

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
}: {
  notesLoading: boolean;
  filter: 'course' | 'all' | 'starred';
  onFilterChange: (value: 'course' | 'all' | 'starred') => void;
  search: string;
  onSearchChange: (value: string) => void;
  onRefreshNotes: () => void;
  filteredNotes: Note[];
  activeNoteId: string | null;
  onSelectNote: (noteId: string | null) => void;
  onToggleStar: (noteId: string, event: React.MouseEvent) => void;
  onDeleteNote: (noteId: string, title: string, event: React.MouseEvent) => void;
  isDeleting: string | null;
  onCreateNote: () => void;
}) {
  return (
    <div className="lockin-notes-list-container">
      <div className="lockin-notes-filter-bar">
        <div className="lockin-notes-filter-group">
          <span className="lockin-notes-filter-label">Filter</span>
          <select
            className="lockin-notes-filter-select"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value as typeof filter)}
          >
            <option value="course">This course</option>
            <option value="all">All notes</option>
            <option value="starred">Starred</option>
          </select>
        </div>
        <input
          type="text"
          className="lockin-notes-search-input"
          placeholder="Search notes"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <button type="button" className="lockin-btn-ghost" onClick={onRefreshNotes}>
          Refresh
        </button>
      </div>

      <div className="lockin-notes-list">
        {notesLoading ? (
          <div className="lockin-notes-empty">Loading notes...</div>
        ) : filteredNotes.length === 0 ? (
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
        ) : (
          filteredNotes.map((item) => (
            <NotesListItem
              key={item.id || item.title}
              note={item}
              isActive={!!item.id && item.id === activeNoteId}
              isDeleting={isDeleting === item.id}
              onSelect={() => onSelectNote(item.id || null)}
              onToggleStar={(event) => item.id && onToggleStar(item.id, event)}
              onDeleteNote={(event) =>
                item.id && onDeleteNote(item.id, item.title || 'Untitled', event)
              }
            />
          ))
        )}
      </div>
    </div>
  );
}
