import { Star, Trash2 } from 'lucide-react';
import type { Note } from '@core/domain/Note';
import { ExportDropdown } from '../export';

interface NotesPanelHeaderProps {
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
}

/* -- Nav bar: stable row with toggle + New note, never shifts -- */
function NotesNavBar({
  view,
  onViewChange,
  onNewNote,
}: Pick<NotesPanelHeaderProps, 'view' | 'onViewChange' | 'onNewNote'>): React.JSX.Element {
  return (
    <div className="lockin-tab-toolbar">
      <div className="lockin-tab-toolbar-start" />

      <div className="lockin-tab-toolbar-center">
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

      <div className="lockin-tab-toolbar-end">
        <button type="button" className="lockin-btn-new lockin-new-note-btn" onClick={onNewNote}>
          + New note
        </button>
      </div>
    </div>
  );
}

/* -- Context bar: course info + action buttons, current-view only -- */
function NotesContextBar({
  courseCode,
  weekLabel,
  linkedTarget,
  showActions,
  isStarred,
  isDeleting,
  onToggleStar,
  onDeleteNote,
  note,
  week,
  onExportError,
}: Omit<NotesPanelHeaderProps, 'view' | 'onViewChange' | 'onNewNote'>): React.JSX.Element {
  return (
    <div className="lockin-notes-context-bar">
      <NotesInfoBar courseCode={courseCode} weekLabel={weekLabel} linkedTarget={linkedTarget} />
      <NotesActionButtons
        showActions={showActions}
        isStarred={isStarred}
        isDeleting={isDeleting}
        onToggleStar={onToggleStar}
        onDeleteNote={onDeleteNote}
        note={note}
        week={week}
        onExportError={onExportError}
      />
    </div>
  );
}

function NotesInfoBar({
  courseCode,
  weekLabel,
  linkedTarget,
}: Pick<NotesPanelHeaderProps, 'courseCode' | 'weekLabel' | 'linkedTarget'>): React.JSX.Element {
  return (
    <div className="lockin-notes-info-bar">
      <div className="lockin-notes-course-row">
        <span className="lockin-notes-label">Course:</span>
        <strong className="lockin-notes-course-value">
          {courseCode !== null && courseCode !== '' ? courseCode : 'None'}
        </strong>
      </div>
      {(linkedTarget !== null || weekLabel !== null) && (
        <div className="lockin-notes-link-row">
          <span className="lockin-notes-label">Linked to:</span>
          {linkedTarget !== null ? (
            <a
              href={linkedTarget}
              target="_blank"
              rel="noreferrer"
              className="lockin-notes-link-href"
            >
              {weekLabel ?? 'Source page'}
            </a>
          ) : (
            <span className="lockin-notes-link-href">{weekLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

interface NotesActionButtonsProps {
  showActions: boolean;
  isStarred: boolean;
  isDeleting: boolean;
  onToggleStar: (event: React.MouseEvent) => void;
  onDeleteNote: (event: React.MouseEvent) => void;
  note: Note | null;
  week: number | null;
  onExportError?: ((error: string) => void) | undefined;
}

function NotesActionButtons({
  showActions,
  isStarred,
  isDeleting,
  onToggleStar,
  onDeleteNote,
  note,
  week,
  onExportError,
}: NotesActionButtonsProps): React.JSX.Element {
  return (
    <div className="lockin-notes-header-actions">
      <ExportDropdown
        note={note}
        week={week}
        disabled={!showActions}
        {...(onExportError !== undefined ? { onExportError } : {})}
      />
      <button
        type="button"
        className={`lockin-note-action-btn lockin-note-star-btn${isStarred ? ' is-starred' : ''}`}
        onClick={onToggleStar}
        disabled={!showActions}
        title={isStarred ? 'Unstar note' : 'Star note'}
        aria-label={isStarred ? 'Unstar note' : 'Star note'}
      >
        <Star size={14} strokeWidth={2} fill={isStarred ? 'currentColor' : 'none'} />
      </button>
      <button
        type="button"
        className="lockin-note-action-btn lockin-note-delete-btn"
        onClick={onDeleteNote}
        disabled={!showActions || isDeleting}
        title="Delete note"
        aria-label="Delete note"
      >
        {isDeleting ? (
          <span className="lockin-inline-spinner" aria-hidden="true" />
        ) : (
          <Trash2 size={14} strokeWidth={2} />
        )}
      </button>
    </div>
  );
}

export function NotesPanelHeader(props: NotesPanelHeaderProps): React.JSX.Element {
  const { view, onViewChange, onNewNote, ...contextProps } = props;

  return (
    <header className="lockin-notes-header">
      <NotesNavBar view={view} onViewChange={onViewChange} onNewNote={onNewNote} />
      {view === 'current' && <NotesContextBar {...contextProps} />}
    </header>
  );
}
