/**
 * Tests for ExportManager
 */

import { describe, expect, it } from 'vitest';
import { generateFilename, hasExportableContent } from '../ExportManager';
import type { ExportMetadata } from '../types';
import type { NoteContent } from '@core/domain/Note';

describe('generateFilename', () => {
  it('generates filename with all metadata', () => {
    const metadata: ExportMetadata = {
      title: 'My Note Title',
      courseCode: 'FIT1045',
      week: 5,
    };

    const filename = generateFilename(metadata, 'pdf');

    expect(filename).toBe('lock-in_fit1045_week5_my-note-title.pdf');
  });

  it('handles missing course code', () => {
    const metadata: ExportMetadata = {
      title: 'Test Note',
      courseCode: null,
      week: 3,
    };

    const filename = generateFilename(metadata, 'md');

    expect(filename).toBe('lock-in_week3_test-note.md');
  });

  it('handles missing week', () => {
    const metadata: ExportMetadata = {
      title: 'Test Note',
      courseCode: 'ABC123',
      week: null,
    };

    const filename = generateFilename(metadata, 'txt');

    expect(filename).toBe('lock-in_abc123_test-note.txt');
  });

  it('handles empty metadata with timestamp fallback', () => {
    const metadata: ExportMetadata = {
      title: '',
      courseCode: null,
      week: null,
    };

    const filename = generateFilename(metadata, 'pdf');

    // Should have fallback format: lock-in_note_<timestamp>.pdf
    expect(filename).toMatch(/^lock-in_note_\d+\.pdf$/);
  });

  it('truncates long titles to 50 characters', () => {
    const metadata: ExportMetadata = {
      title: 'This is a very long note title that exceeds fifty characters and should be truncated',
      courseCode: null,
      week: null,
    };

    const filename = generateFilename(metadata, 'md');
    const titlePart = filename.replace('lock-in_', '').replace('.md', '');

    expect(titlePart.length).toBeLessThanOrEqual(50);
  });

  it('removes emoji from titles', () => {
    const metadata: ExportMetadata = {
      title: '📚 Study Notes 🎓',
      courseCode: null,
      week: null,
    };

    const filename = generateFilename(metadata, 'pdf');

    expect(filename).not.toContain('📚');
    expect(filename).not.toContain('🎓');
    expect(filename).toContain('study-notes');
  });

  it('handles unicode accented characters', () => {
    const metadata: ExportMetadata = {
      title: 'Café résumé naïve',
      courseCode: null,
      week: null,
    };

    const filename = generateFilename(metadata, 'txt');

    // Should normalize to ASCII
    expect(filename).toContain('cafe-resume-naive');
  });

  it('removes illegal filename characters', () => {
    const metadata: ExportMetadata = {
      title: 'Note: "Important" <stuff>',
      courseCode: null,
      week: null,
    };

    const filename = generateFilename(metadata, 'pdf');

    expect(filename).not.toContain(':');
    expect(filename).not.toContain('"');
    expect(filename).not.toContain('<');
    expect(filename).not.toContain('>');
  });

  it('collapses multiple spaces and dashes', () => {
    const metadata: ExportMetadata = {
      title: 'Note   with    spaces',
      courseCode: null,
      week: null,
    };

    const filename = generateFilename(metadata, 'pdf');

    expect(filename).not.toContain('--');
    expect(filename).toContain('note-with-spaces');
  });
});

describe('hasExportableContent', () => {
  it('returns false for null content', () => {
    expect(hasExportableContent(null)).toBe(false);
  });

  it('returns false for undefined content', () => {
    expect(hasExportableContent(undefined)).toBe(false);
  });

  it('returns false for content with null editorState', () => {
    const content: NoteContent = {
      version: 'lexical_v1',
      editorState: null,
    };

    expect(hasExportableContent(content)).toBe(false);
  });

  it('returns false for empty editor state', () => {
    const content: NoteContent = {
      version: 'lexical_v1',
      editorState: { root: { children: [] } },
    };

    expect(hasExportableContent(content)).toBe(false);
  });

  it('returns true for content with text', () => {
    const content: NoteContent = {
      version: 'lexical_v1',
      editorState: {
        root: {
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Hello world', format: 0 }],
            },
          ],
        },
      },
    };

    expect(hasExportableContent(content)).toBe(true);
  });

  it('returns false for whitespace-only content', () => {
    const content: NoteContent = {
      version: 'lexical_v1',
      editorState: {
        root: {
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: '   \n  ', format: 0 }],
            },
          ],
        },
      },
    };

    expect(hasExportableContent(content)).toBe(false);
  });

  it('returns true for code blocks with content', () => {
    const content: NoteContent = {
      version: 'lexical_v1',
      editorState: {
        root: {
          children: [
            {
              type: 'code',
              children: [{ type: 'text', text: 'const x = 1;', format: 0 }],
            },
          ],
        },
      },
    };

    expect(hasExportableContent(content)).toBe(true);
  });
});
