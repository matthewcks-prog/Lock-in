import { Star, Trash2 } from 'lucide-react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { Note } from '@core/domain/Note';
import { relativeLabel } from '../utils/relativeTime';

interface NotesListItemProps {
  note: Note;
  isActive: boolean;
  onSelect: () => void;
  onToggleStar: (event: ReactMouseEvent) => void;
  onDeleteNote: (event: ReactMouseEvent) => void;
  isDeleting: boolean;
}

interface NoteDisplayData {
  hasNoteId: boolean;
  isStarred: boolean;
  title: string;
  courseCode: string | null;
  previewText: string;
  updatedAtValue: string | null | undefined;
}

function hasText(value: string | null | undefined): value is string {
  return value !== null && value !== undefined && value.length > 0;
}

function resolvePreviewText(note: Note): string {
  if (hasText(note.previewText)) return note.previewText;
  if (hasText(note.content?.plainText)) return note.content.plainText;
  return 'No content';
}

function resolveDisplayData(note: Note): NoteDisplayData {
  return {
    hasNoteId: hasText(note.id),
    isStarred: note.isStarred === true,
    title: hasText(note.title) ? note.title : 'Untitled',
    courseCode: hasText(note.courseCode) ? note.courseCode : null,
    previewText: resolvePreviewText(note),
    updatedAtValue: hasText(note.updatedAt) ? note.updatedAt : note.createdAt,
  };
}

function handleCardKeyDown(event: ReactKeyboardEvent, onSelect: () => void): void {
  if (event.key === 'Enter' || event.key === ' ') onSelect();
}

function NoteCardActions({
  hasNoteId,
  isStarred,
  onToggleStar,
  onDeleteNote,
  isDeleting,
}: {
  hasNoteId: boolean;
  isStarred: boolean;
  onToggleStar: (event: ReactMouseEvent) => void;
  onDeleteNote: (event: ReactMouseEvent) => void;
  isDeleting: boolean;
}): JSX.Element | null {
  if (!hasNoteId) return null;

  return (
    <>
      <button
        type="button"
        className={`lockin-note-action-btn lockin-note-star-btn${isStarred ? ' is-starred' : ''}`}
        onClick={onToggleStar}
        title={isStarred ? 'Unstar note' : 'Star note'}
        aria-label={isStarred ? 'Unstar note' : 'Star note'}
      >
        <Star size={14} strokeWidth={2} fill={isStarred ? 'currentColor' : 'none'} />
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
  );
}

function NoteCardHeader({
  title,
  isStarred,
  actions,
}: {
  title: string;
  isStarred: boolean;
  actions: JSX.Element | null;
}): JSX.Element {
  return (
    <div className="lockin-note-card-header">
      <div className="lockin-note-card-title-row">
        {isStarred ? (
          <Star
            className="lockin-note-star-indicator"
            size={14}
            strokeWidth={2}
            fill="currentColor"
            aria-label="Starred"
          />
        ) : null}
        <div className="lockin-note-card-title">{title}</div>
      </div>
      <div className="lockin-note-card-actions">{actions}</div>
    </div>
  );
}

export function NotesListItem({
  note,
  isActive,
  onSelect,
  onToggleStar,
  onDeleteNote,
  isDeleting,
}: NotesListItemProps): JSX.Element {
  const display = resolveDisplayData(note);
  const actions = (
    <NoteCardActions
      hasNoteId={display.hasNoteId}
      isStarred={display.isStarred}
      onToggleStar={onToggleStar}
      onDeleteNote={onDeleteNote}
      isDeleting={isDeleting}
    />
  );

  return (
    <div
      className={`lockin-note-card${isActive ? ' is-active' : ''}${display.isStarred ? ' is-starred' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => handleCardKeyDown(event, onSelect)}
    >
      <NoteCardHeader title={display.title} isStarred={display.isStarred} actions={actions} />
      {display.courseCode !== null ? (
        <span className="lockin-note-badge">{display.courseCode}</span>
      ) : null}
      <div className="lockin-note-card-snippet">{display.previewText}</div>
      <div className="lockin-note-card-meta">Updated {relativeLabel(display.updatedAtValue)}</div>
    </div>
  );
}
