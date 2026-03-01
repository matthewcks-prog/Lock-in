import type { Note } from '@core/domain/Note';

export function createNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    title: 'Sample note',
    content: {
      version: 'lexical_v1',
      editorState: null,
      legacyHtml: null,
      plainText: 'Sample note',
    },
    sourceUrl: null,
    sourceSelection: null,
    courseCode: null,
    noteType: 'manual',
    tags: [],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    isStarred: false,
    previewText: 'Sample note',
    ...overrides,
  };
}
