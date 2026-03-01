import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Note, NoteStatus } from '@core/domain/Note';
import { createClientNoteId, createContentFingerprint, createDraftNote } from './noteUtils';

export interface DraftDefaults {
  courseCode?: string | null;
  sourceUrl?: string | null;
  sourceSelection?: string | null;
  week?: number | null;
}

export function buildDraftDefaults({
  defaultCourseCode,
  defaultSourceUrl,
  sourceSelection,
  defaultWeek,
}: {
  defaultCourseCode?: string | null | undefined;
  defaultSourceUrl?: string | null | undefined;
  sourceSelection?: string | null | undefined;
  defaultWeek?: number | null | undefined;
}): DraftDefaults {
  const draftDefaults: DraftDefaults = {};
  if (defaultCourseCode !== undefined) draftDefaults.courseCode = defaultCourseCode;
  if (defaultSourceUrl !== undefined) draftDefaults.sourceUrl = defaultSourceUrl;
  if (sourceSelection !== undefined) draftDefaults.sourceSelection = sourceSelection;
  if (defaultWeek !== undefined) draftDefaults.week = defaultWeek;
  return draftDefaults;
}

export function resetToDraftIfNeeded({
  currentNote,
  defaultCourseCode,
  defaultSourceUrl,
  sourceSelection,
  defaultWeek,
  clientNoteIdRef,
  loadingNoteIdRef,
  lastLoadedNoteIdRef,
  lastSavedFingerprintRef,
  setNote,
  setStatus,
  setIsLoading,
}: {
  currentNote: Note | null;
  defaultCourseCode?: string | null | undefined;
  defaultSourceUrl?: string | null | undefined;
  sourceSelection?: string | null | undefined;
  defaultWeek?: number | null | undefined;
  clientNoteIdRef: MutableRefObject<string>;
  loadingNoteIdRef: MutableRefObject<string | null>;
  lastLoadedNoteIdRef: MutableRefObject<string | null>;
  lastSavedFingerprintRef: MutableRefObject<string | null>;
  setNote: Dispatch<SetStateAction<Note | null>>;
  setStatus: Dispatch<SetStateAction<NoteStatus>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
}): void {
  loadingNoteIdRef.current = null;
  lastLoadedNoteIdRef.current = null;
  if (currentNote === null || currentNote.id !== null) {
    const draft = createDraftNote(
      buildDraftDefaults({ defaultCourseCode, defaultSourceUrl, sourceSelection, defaultWeek }),
    );
    clientNoteIdRef.current = createClientNoteId();
    setNote(draft);
    lastSavedFingerprintRef.current = createContentFingerprint(draft.title, draft.content);
  }
  setStatus('idle');
  setIsLoading(false);
}
