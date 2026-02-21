/**
 * Pure helper functions for the NotesPanel view model.
 *
 * Extracted for testability and separation of concerns. These functions
 * are stateless and have no React dependencies.
 */

import type { Note } from '@core/domain/Note';

function formatLinkedLabel(week: number | null | undefined): string | null {
  return week !== null && week !== undefined && week > 0 ? `Week ${week}` : null;
}

function isNewNote(note: Note | null): boolean {
  return note === null || note.id === null || note.id === undefined || note.id === '';
}

/**
 * Returns the week label to display in the "Linked to:" context bar.
 *
 * Priority:
 * 1. The note's persisted `week` field (original creation week) — always authoritative.
 * 2. The current page week — but ONLY for new (unsaved) notes or notes on the same page.
 * 3. `null` — for existing notes from a different page that have no stored week.
 */
export function resolveNoteWeekLabel(
  note: Note | null,
  currentWeek: number | null | undefined,
  pageUrl: string,
): string | null {
  const storedWeek = note?.week ?? null;
  if (storedWeek !== null) return formatLinkedLabel(storedWeek);

  const noteSourceUrl = note?.sourceUrl ?? null;
  const onSamePage = noteSourceUrl !== null && noteSourceUrl === pageUrl;

  return isNewNote(note) || onSamePage ? formatLinkedLabel(currentWeek) : null;
}

/**
 * Resolves the URL for the "Linked to:" anchor.
 *
 * The linked target is INDEPENDENT of whether there is a week label.
 * A note always links back to its original creation page (`sourceUrl`).
 *
 * Rules:
 * - If the note has a `sourceUrl`, that is always the target (immutable origin).
 * - If the note is new (unsaved), link to the current page URL.
 * - Otherwise return `null` — existing notes with no recorded origin have no link.
 */
export function resolveLinkedTarget({
  note,
  pageUrl,
}: {
  note: Note | null;
  pageUrl: string;
}): string | null {
  if (note === null) return null;

  const noteSourceUrl = note.sourceUrl ?? null;
  if (noteSourceUrl !== null) return noteSourceUrl;

  if (isNewNote(note)) return pageUrl;

  return null;
}
