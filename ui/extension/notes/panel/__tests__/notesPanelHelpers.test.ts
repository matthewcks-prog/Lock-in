import { describe, expect, it } from 'vitest';
import type { Note } from '@core/domain/Note';
import { resolveLinkedTarget, resolveNoteWeekLabel } from '../notesPanelHelpers';

const BASE_URL = 'https://example.edu/course/week3';
const OTHER_URL = 'https://example.edu/course/week5';

function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: 'Test note',
    content: { version: 'lexical_v1', editorState: { root: { children: [] } } },
    sourceUrl: null,
    sourceSelection: null,
    courseCode: null,
    week: null,
    noteType: 'manual',
    tags: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// resolveNoteWeekLabel
// ─────────────────────────────────────────────

describe('resolveNoteWeekLabel', () => {
  it('returns the stored week over the current page week', () => {
    const note = createNote({ week: 4 });
    expect(resolveNoteWeekLabel(note, 9, BASE_URL)).toBe('Week 4');
  });

  it('uses current week for unsaved (new) notes', () => {
    const note = createNote({ id: null, week: null });
    expect(resolveNoteWeekLabel(note, 6, BASE_URL)).toBe('Week 6');
  });

  it('uses current week when note is on the same page and has no stored week', () => {
    const note = createNote({ sourceUrl: BASE_URL, week: null });
    expect(resolveNoteWeekLabel(note, 8, BASE_URL)).toBe('Week 8');
  });

  it('returns null for existing notes from a different page with no stored week', () => {
    const note = createNote({ sourceUrl: OTHER_URL, week: null });
    expect(resolveNoteWeekLabel(note, 8, BASE_URL)).toBeNull();
  });

  it('returns null when no week is available anywhere', () => {
    const note = createNote({ id: null, week: null });
    expect(resolveNoteWeekLabel(note, null, BASE_URL)).toBeNull();
  });

  it('uses current week when note is null (treated as new draft)', () => {
    // A null note means a draft not yet created — we still show the current page week.
    expect(resolveNoteWeekLabel(null, 3, BASE_URL)).toBe('Week 3');
  });

  it('returns null when note is null and there is no current week', () => {
    expect(resolveNoteWeekLabel(null, null, BASE_URL)).toBeNull();
  });
});

// ─────────────────────────────────────────────
// resolveLinkedTarget — core bug cases
// ─────────────────────────────────────────────

describe('resolveLinkedTarget', () => {
  it('returns the note sourceUrl regardless of whether a weekLabel exists', () => {
    // THE BUG: notes with sourceUrl but week=null were returning null before this fix
    const note = createNote({ sourceUrl: OTHER_URL, week: null });
    expect(resolveLinkedTarget({ note, pageUrl: BASE_URL })).toBe(OTHER_URL);
  });

  it('returns sourceUrl even when note is from a different page', () => {
    const note = createNote({ sourceUrl: OTHER_URL });
    expect(resolveLinkedTarget({ note, pageUrl: BASE_URL })).toBe(OTHER_URL);
  });

  it('returns sourceUrl for notes that also have a stored week', () => {
    const note = createNote({ sourceUrl: OTHER_URL, week: 5 });
    expect(resolveLinkedTarget({ note, pageUrl: BASE_URL })).toBe(OTHER_URL);
  });

  it('returns current pageUrl when the note is new (unsaved)', () => {
    const note = createNote({ id: null, sourceUrl: null, week: null });
    expect(resolveLinkedTarget({ note, pageUrl: BASE_URL })).toBe(BASE_URL);
  });

  it('returns current pageUrl when id is empty string (also treated as new)', () => {
    const note = createNote({ id: '', sourceUrl: null });
    expect(resolveLinkedTarget({ note, pageUrl: BASE_URL })).toBe(BASE_URL);
  });

  it('returns null for existing notes that have no sourceUrl', () => {
    const note = createNote({ id: 'note-1', sourceUrl: null });
    expect(resolveLinkedTarget({ note, pageUrl: BASE_URL })).toBeNull();
  });

  it('returns null when note itself is null', () => {
    expect(resolveLinkedTarget({ note: null, pageUrl: BASE_URL })).toBeNull();
  });
});
