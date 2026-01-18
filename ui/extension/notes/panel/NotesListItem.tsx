import { Star, Trash2 } from 'lucide-react';
import type { Note } from '@core/domain/Note';
import { relativeLabel } from '../utils/relativeTime';

export function NotesListItem({
  note,
  isActive,
  onSelect,
  onToggleStar,
  onDeleteNote,
  isDeleting,
}: {
  note: Note;
  isActive: boolean;
  onSelect: () => void;
  onToggleStar: (event: React.MouseEvent) => void;
  onDeleteNote: (event: React.MouseEvent) => void;
  isDeleting: boolean;
}) {
  return (
    <div
      className={`lockin-note-card${isActive ? ' is-active' : ''}${note.isStarred ? ' is-starred' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelect();
        }
      }}
    >
      <div className="lockin-note-card-header">
        <div className="lockin-note-card-title-row">
          {note.isStarred && (
            <Star
              className="lockin-note-star-indicator"
              size={14}
              strokeWidth={2}
              fill="currentColor"
              aria-label="Starred"
            />
          )}
          <div className="lockin-note-card-title">{note.title || 'Untitled'}</div>
        </div>
        <div className="lockin-note-card-actions">
          {note.id && (
            <>
              <button
                type="button"
                className={`lockin-note-action-btn lockin-note-star-btn${
                  note.isStarred ? ' is-starred' : ''
                }`}
                onClick={onToggleStar}
                title={note.isStarred ? 'Unstar note' : 'Star note'}
                aria-label={note.isStarred ? 'Unstar note' : 'Star note'}
              >
                <Star size={14} strokeWidth={2} fill={note.isStarred ? 'currentColor' : 'none'} />
              </button>
              <button
                type="button"
                className="lockin-note-action-btn lockin-note-delete-btn"
                onClick={onDeleteNote}
                disabled={isDeleting}
                title="Delete note"
                aria-label="Delete note"
              >
                {isDeleting ? (
                  <span className="lockin-inline-spinner" aria-hidden="true" />
                ) : (
                  <Trash2 size={14} strokeWidth={2} />
                )}
              </button>
            </>
          )}
        </div>
      </div>
      {note.courseCode && <span className="lockin-note-badge">{note.courseCode}</span>}
      <div className="lockin-note-card-snippet">
        {note.previewText || note.content?.plainText || 'No content'}
      </div>
      <div className="lockin-note-card-meta">
        Updated {relativeLabel(note.updatedAt || note.createdAt)}
      </div>
    </div>
  );
}
