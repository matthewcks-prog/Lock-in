import { Star, Trash2 } from 'lucide-react';
import type { Note } from '@core/domain/Note';
import { ExportDropdown } from '../export';

export function NotesPanelHeader({
  courseCode,
  weekLabel,
  linkedTarget,
  view,
  onViewChange,
  showActions,
  isStarred,
  isDeleting,
  onToggleStar,
  onDeleteNote,
  onNewNote,
  note,
  week,
  onExportError,
}: {
  courseCode: string | null;
  weekLabel: string | null;
  linkedTarget: string | null;
  view: 'current' | 'all';
  onViewChange: (view: 'current' | 'all') => void;
  showActions: boolean;
  isStarred: boolean;
  isDeleting: boolean;
  onToggleStar: (event: React.MouseEvent) => void;
  onDeleteNote: (event: React.MouseEvent) => void;
  onNewNote: () => void;
  note: Note | null;
  week: number | null;
  onExportError?: (error: string) => void;
}) {
  return (
    <header className="lockin-notes-header lockin-notes-header-row">
      <div className="lockin-notes-header-left">
        <div className="lockin-notes-course-row">
          <span className="lockin-notes-label">Course:</span>
          <strong className="lockin-notes-course-value">{courseCode || 'None'}</strong>
        </div>
        {weekLabel && (
          <div className="lockin-notes-link-row">
            <span className="lockin-notes-label">Linked to:</span>
            <a
              href={linkedTarget || '#'}
              target="_blank"
              rel="noreferrer"
              className="lockin-notes-link-href"
            >
              {weekLabel}
            </a>
          </div>
        )}
      </div>

      <div className="lockin-notes-header-center">
        <div className="lockin-notes-toggle">
          <button
            type="button"
            className={`lockin-notes-toggle-btn${view === 'current' ? ' is-active' : ''}`}
            onClick={() => onViewChange('current')}
          >
            Current
          </button>
          <button
            type="button"
            className={`lockin-notes-toggle-btn${view === 'all' ? ' is-active' : ''}`}
            onClick={() => onViewChange('all')}
          >
            All notes
          </button>
        </div>
      </div>

      <div className="lockin-notes-header-right">
        {showActions && (
          <div className="lockin-notes-header-actions">
            <ExportDropdown note={note} week={week} {...(onExportError ? { onExportError } : {})} />
            <button
              type="button"
              className={`lockin-note-action-btn lockin-note-star-btn${
                isStarred ? ' is-starred' : ''
              }`}
              onClick={onToggleStar}
              title={isStarred ? 'Unstar note' : 'Star note'}
              aria-label={isStarred ? 'Unstar note' : 'Star note'}
            >
              <Star size={16} strokeWidth={2} fill={isStarred ? 'currentColor' : 'none'} />
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
                <Trash2 size={16} strokeWidth={2} />
              )}
            </button>
          </div>
        )}
        <button type="button" className="lockin-btn-primary" onClick={onNewNote}>
          + New note
        </button>
      </div>
    </header>
  );
}
