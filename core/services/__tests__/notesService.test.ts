/**
 * Unit tests for notesService
 *
 * Tests note content normalization, migration, and CRUD operations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNotesService, type NotesApiClient } from '../notesService';
import type { NoteContent, NoteAsset } from '../../domain/Note';

const DEFAULT_LIMIT = 50;
const DEFAULT_TIMESTAMP = '2024-01-01T00:00:00Z';
const DEFAULT_TIMESTAMP_2 = '2024-01-02T00:00:00Z';
const LEXICAL_VERSION = 'lexical_v1';

const createMockApiClient = (): NotesApiClient => ({
  apiRequest: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  toggleNoteStar: vi.fn(),
  setNoteStar: vi.fn(),
  listNotes: vi.fn(),
  uploadNoteAsset: vi.fn(),
  listNoteAssets: vi.fn(),
  deleteNoteAsset: vi.fn(),
});

const setupNotesService = (): {
  mockApiClient: NotesApiClient;
  notesService: ReturnType<typeof createNotesService>;
} => {
  const mockApiClient = createMockApiClient();
  return { mockApiClient, notesService: createNotesService(mockApiClient) };
};

const createLexicalContent = (plainText: string): NoteContent => ({
  version: LEXICAL_VERSION,
  editorState: { root: { children: [] } },
  plainText,
});

const createLexicalContentWithParagraph = (plainText: string): NoteContent => ({
  version: LEXICAL_VERSION,
  editorState: { root: { children: [{ type: 'paragraph', children: [] }] } },
  plainText,
});

const createMockNote = (overrides: Record<string, unknown>): Record<string, unknown> => ({
  id: 'note-1',
  title: 'Test Note',
  content_json: { root: { children: [] } },
  editor_version: LEXICAL_VERSION,
  created_at: DEFAULT_TIMESTAMP,
  updated_at: DEFAULT_TIMESTAMP,
  ...overrides,
});

describe('NotesService createNote (lexical)', () => {
  let mockApiClient: NotesApiClient;
  let notesService: ReturnType<typeof createNotesService>;

  beforeEach(() => {
    ({ mockApiClient, notesService } = setupNotesService());
  });

  it('should create a note with Lexical content', async () => {
    const mockNote = createMockNote({ content_text: 'Test content' });
    vi.mocked(mockApiClient.createNote).mockResolvedValue(mockNote);

    const input = {
      title: 'Test Note',
      content: createLexicalContent('Test content'),
    };

    const result = await notesService.createNote(input);

    expect(mockApiClient.createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Note',
        content_json: { root: { children: [] } },
        editor_version: LEXICAL_VERSION,
      }),
      undefined,
    );
    expect(result.title).toBe('Test Note');
    expect(result.content.version).toBe(LEXICAL_VERSION);
  });
});

describe('NotesService createNote (metadata)', () => {
  let mockApiClient: NotesApiClient;
  let notesService: ReturnType<typeof createNotesService>;

  beforeEach(() => {
    ({ mockApiClient, notesService } = setupNotesService());
  });

  it('should include course code and source URL', async () => {
    const mockNote = createMockNote({
      course_code: 'FIT1045',
      source_url: 'https://example.com',
    });
    vi.mocked(mockApiClient.createNote).mockResolvedValue(mockNote);

    const input = {
      title: 'Test Note',
      content: createLexicalContent(''),
      courseCode: 'FIT1045',
      sourceUrl: 'https://example.com/page',
    };

    const result = await notesService.createNote(input);

    expect(mockApiClient.createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        courseCode: 'FIT1045',
        course_code: 'FIT1045',
        sourceUrl: 'https://example.com/page',
        source_url: 'https://example.com/page',
      }),
      undefined,
    );
    expect(result.courseCode).toBe('FIT1045');
    expect(result.sourceUrl).toBe('https://example.com');
  });
});

describe('NotesService createNote (errors)', () => {
  it('should throw error when API client is null', async () => {
    const service = createNotesService(null);
    await expect(
      service.createNote({
        title: 'Test',
        content: { version: LEXICAL_VERSION, editorState: null, plainText: '' },
      }),
    ).rejects.toThrow('Notes service requires an ApiClient instance');
  });
});

describe('NotesService updateNote', () => {
  let mockApiClient: NotesApiClient;
  let notesService: ReturnType<typeof createNotesService>;

  beforeEach(() => {
    ({ mockApiClient, notesService } = setupNotesService());
  });

  it('should update note title', async () => {
    const mockNote = createMockNote({ title: 'Updated Title' });
    vi.mocked(mockApiClient.updateNote).mockResolvedValue(mockNote);

    const result = await notesService.updateNote('note-1', { title: 'Updated Title' });

    expect(mockApiClient.updateNote).toHaveBeenCalledWith(
      'note-1',
      expect.objectContaining({ title: 'Updated Title' }),
      undefined,
    );
    expect(result.title).toBe('Updated Title');
  });

  it('should update note content', async () => {
    const mockNote = createMockNote({
      content_json: { root: { children: [{ type: 'paragraph', children: [] }] } },
      content_text: 'Updated content',
    });
    vi.mocked(mockApiClient.updateNote).mockResolvedValue(mockNote);

    const newContent = createLexicalContentWithParagraph('Updated content');
    const result = await notesService.updateNote('note-1', { content: newContent });

    const contentJsonExpectation: unknown = expect.any(Object);
    expect(mockApiClient.updateNote).toHaveBeenCalledWith(
      'note-1',
      expect.objectContaining({
        content_json: contentJsonExpectation,
        editor_version: LEXICAL_VERSION,
      }),
      undefined,
    );
    expect(result.content.plainText).toBe('Updated content');
  });
});

describe('NotesService listNotes (filters)', () => {
  let mockApiClient: NotesApiClient;
  let notesService: ReturnType<typeof createNotesService>;

  beforeEach(() => {
    ({ mockApiClient, notesService } = setupNotesService());
  });

  it('should list notes with default limit', async () => {
    const mockNotes = [
      createMockNote({ title: 'Note 1' }),
      createMockNote({ id: 'note-2', title: 'Note 2', created_at: DEFAULT_TIMESTAMP_2 }),
    ];

    vi.mocked(mockApiClient.listNotes).mockResolvedValue(mockNotes);

    const result = await notesService.listNotes();

    expect(mockApiClient.listNotes).toHaveBeenCalledWith({ limit: DEFAULT_LIMIT });
    expect(result).toHaveLength(2);
    const [firstNote] = result;
    expect(firstNote).toBeDefined();
    expect(firstNote?.id).toBe('note-1');
  });

  it('should filter by course code', async () => {
    const mockNotes = [createMockNote({ title: 'Note 1', course_code: 'FIT1045' })];

    vi.mocked(mockApiClient.listNotes).mockResolvedValue(mockNotes);

    const result = await notesService.listNotes({ courseCode: 'FIT1045' });

    expect(mockApiClient.listNotes).toHaveBeenCalledWith({
      courseCode: 'FIT1045',
      limit: DEFAULT_LIMIT,
    });
    const [firstNote] = result;
    expect(firstNote).toBeDefined();
    expect(firstNote?.courseCode).toBe('FIT1045');
  });
});

describe('NotesService listNotes (migration)', () => {
  let mockApiClient: NotesApiClient;
  let notesService: ReturnType<typeof createNotesService>;

  beforeEach(() => {
    ({ mockApiClient, notesService } = setupNotesService());
  });

  it('should migrate legacy notes without content_json', async () => {
    const legacyNote = {
      id: 'note-1',
      title: 'Legacy Note',
      content: '<p>Legacy HTML content</p>',
      created_at: DEFAULT_TIMESTAMP,
    };

    const migratedNote = createMockNote({
      title: 'Legacy Note',
      content_text: 'Legacy HTML content',
    });

    vi.mocked(mockApiClient.listNotes).mockResolvedValue([legacyNote]);
    vi.mocked(mockApiClient.updateNote).mockResolvedValue(migratedNote);

    const result = await notesService.listNotes();

    expect(result).toHaveLength(1);
    const [firstNote] = result;
    expect(firstNote).toBeDefined();
    expect(firstNote?.content.version).toBe(LEXICAL_VERSION);
    expect(firstNote?.content.plainText).toContain('Legacy HTML content');
  });
});

describe('NotesService getNote', () => {
  let mockApiClient: NotesApiClient;
  let notesService: ReturnType<typeof createNotesService>;

  beforeEach(() => {
    ({ mockApiClient, notesService } = setupNotesService());
  });

  it('should get a note by ID', async () => {
    const mockNote = createMockNote({});
    vi.mocked(mockApiClient.apiRequest).mockResolvedValue(mockNote);

    const result = await notesService.getNote('note-1');

    expect(mockApiClient.apiRequest).toHaveBeenCalledWith('/api/notes/note-1', { method: 'GET' });
    expect(result.id).toBe('note-1');
    expect(result.title).toBe('Test Note');
  });
});

describe('NotesService deleteNote', () => {
  let mockApiClient: NotesApiClient;
  let notesService: ReturnType<typeof createNotesService>;

  beforeEach(() => {
    ({ mockApiClient, notesService } = setupNotesService());
  });

  it('should delete a note', async () => {
    vi.mocked(mockApiClient.deleteNote).mockResolvedValue(undefined);

    await notesService.deleteNote('note-1');

    expect(mockApiClient.deleteNote).toHaveBeenCalledWith('note-1');
  });
});

describe('NotesService toggleStar', () => {
  let mockApiClient: NotesApiClient;
  let notesService: ReturnType<typeof createNotesService>;

  beforeEach(() => {
    ({ mockApiClient, notesService } = setupNotesService());
  });

  it('should toggle star status', async () => {
    const mockNote = createMockNote({ is_starred: true });
    vi.mocked(mockApiClient.toggleNoteStar).mockResolvedValue(mockNote);

    const result = await notesService.toggleStar('note-1');

    expect(mockApiClient.toggleNoteStar).toHaveBeenCalledWith('note-1');
    expect(result.isStarred).toBe(true);
  });

  it('should throw error when noteId is missing', async () => {
    await expect(notesService.toggleStar('')).rejects.toThrow('Note ID is required');
  });
});

describe('NotesService setStar', () => {
  let mockApiClient: NotesApiClient;
  let notesService: ReturnType<typeof createNotesService>;

  beforeEach(() => {
    ({ mockApiClient, notesService } = setupNotesService());
  });

  it('should set star status to true', async () => {
    const mockNote = createMockNote({ is_starred: true });
    vi.mocked(mockApiClient.setNoteStar).mockResolvedValue(mockNote);

    const result = await notesService.setStar('note-1', true);

    expect(mockApiClient.setNoteStar).toHaveBeenCalledWith('note-1', true);
    expect(result.isStarred).toBe(true);
  });
});

describe('NotesService listAssets', () => {
  let mockApiClient: NotesApiClient;
  let notesService: ReturnType<typeof createNotesService>;

  beforeEach(() => {
    ({ mockApiClient, notesService } = setupNotesService());
  });

  it('should list assets for a note', async () => {
    const mockAssets: NoteAsset[] = [
      {
        id: 'asset-1',
        noteId: 'note-1',
        userId: 'user-1',
        type: 'image',
        mimeType: 'image/png',
        storagePath: 'path/to/asset.png',
        createdAt: DEFAULT_TIMESTAMP,
        url: 'https://example.com/asset.png',
        fileName: 'image.png',
      },
    ];

    vi.mocked(mockApiClient.listNoteAssets).mockResolvedValue(mockAssets);

    const result = await notesService.listAssets('note-1');

    expect(mockApiClient.listNoteAssets).toHaveBeenCalledWith({ noteId: 'note-1' });
    expect(result).toHaveLength(1);
    const [firstAsset] = result;
    expect(firstAsset).toBeDefined();
    expect(firstAsset?.id).toBe('asset-1');
  });
});

describe('NotesService uploadAsset', () => {
  let mockApiClient: NotesApiClient;
  let notesService: ReturnType<typeof createNotesService>;

  beforeEach(() => {
    ({ mockApiClient, notesService } = setupNotesService());
  });

  it('should upload an asset', async () => {
    const mockAsset: NoteAsset = {
      id: 'asset-1',
      noteId: 'note-1',
      userId: 'user-1',
      type: 'image',
      mimeType: 'image/png',
      storagePath: 'path/to/asset.png',
      createdAt: DEFAULT_TIMESTAMP,
      url: 'https://example.com/asset.png',
      fileName: 'image.png',
    };

    const file = new File(['content'], 'image.png', { type: 'image/png' });
    vi.mocked(mockApiClient.uploadNoteAsset).mockResolvedValue(mockAsset);

    const result = await notesService.uploadAsset('note-1', file);

    expect(mockApiClient.uploadNoteAsset).toHaveBeenCalledWith({ noteId: 'note-1', file });
    expect(result.id).toBe('asset-1');
  });
});

describe('NotesService deleteAsset', () => {
  let mockApiClient: NotesApiClient;
  let notesService: ReturnType<typeof createNotesService>;

  beforeEach(() => {
    ({ mockApiClient, notesService } = setupNotesService());
  });

  it('should delete an asset', async () => {
    vi.mocked(mockApiClient.deleteNoteAsset).mockResolvedValue(undefined);

    await notesService.deleteAsset('asset-1');

    expect(mockApiClient.deleteNoteAsset).toHaveBeenCalledWith({ assetId: 'asset-1' });
  });
});
