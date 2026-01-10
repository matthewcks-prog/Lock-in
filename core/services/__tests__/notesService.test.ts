/**
 * Unit tests for notesService
 *
 * Tests note content normalization, migration, and CRUD operations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNotesService } from '../notesService';
import type { ApiClient } from '../../../api/client';
import type { NoteContent } from '../../domain/Note';

describe('NotesService', () => {
  let mockApiClient: ApiClient;
  let notesService: ReturnType<typeof createNotesService>;

  beforeEach(() => {
    // Create a mock API client
    mockApiClient = {
      apiRequest: vi.fn(),
      getBackendUrl: vi.fn(() => 'https://api.example.com'),
      processText: vi.fn(),
      getRecentChats: vi.fn(),
      getChatMessages: vi.fn(),
      deleteChat: vi.fn(),
      createNote: vi.fn(),
      updateNote: vi.fn(),
      deleteNote: vi.fn(),
      toggleNoteStar: vi.fn(),
      setNoteStar: vi.fn(),
      listNotes: vi.fn(),
      searchNotes: vi.fn(),
      chatWithNotes: vi.fn(),
      uploadNoteAsset: vi.fn(),
      listNoteAssets: vi.fn(),
      deleteNoteAsset: vi.fn(),
    } as unknown as ApiClient;

    notesService = createNotesService(mockApiClient);
  });

  describe('createNote', () => {
    it('should create a note with Lexical content', async () => {
      const mockNote = {
        id: 'note-1',
        title: 'Test Note',
        content_json: { root: { children: [] } },
        editor_version: 'lexical_v1',
        content_text: 'Test content',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(mockApiClient.createNote).mockResolvedValue(mockNote);

      const input = {
        title: 'Test Note',
        content: {
          version: 'lexical_v1',
          editorState: { root: { children: [] } },
          plainText: 'Test content',
        } as NoteContent,
      };

      const result = await notesService.createNote(input);

      expect(mockApiClient.createNote).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Note',
          content_json: { root: { children: [] } },
          editor_version: 'lexical_v1',
        }),
        undefined,
      );
      expect(result.title).toBe('Test Note');
      expect(result.content.version).toBe('lexical_v1');
    });

    it('should include course code and source URL', async () => {
      const mockNote = {
        id: 'note-1',
        title: 'Test Note',
        content_json: { root: { children: [] } },
        editor_version: 'lexical_v1',
        course_code: 'FIT1045',
        source_url: 'https://example.com',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(mockApiClient.createNote).mockResolvedValue(mockNote);

      const input = {
        title: 'Test Note',
        content: {
          version: 'lexical_v1',
          editorState: { root: { children: [] } },
          plainText: '',
        } as NoteContent,
        courseCode: 'FIT1045',
        sourceUrl: 'https://example.com',
      };

      const result = await notesService.createNote(input);

      expect(mockApiClient.createNote).toHaveBeenCalledWith(
        expect.objectContaining({
          courseCode: 'FIT1045',
          course_code: 'FIT1045',
          sourceUrl: 'https://example.com',
          source_url: 'https://example.com',
        }),
        undefined,
      );
      expect(result.courseCode).toBe('FIT1045');
      expect(result.sourceUrl).toBe('https://example.com');
    });

    it('should throw error when API client is null', async () => {
      const service = createNotesService(null);
      await expect(
        service.createNote({
          title: 'Test',
          content: { version: 'lexical_v1', editorState: null, plainText: '' },
        }),
      ).rejects.toThrow('Notes service requires an ApiClient instance');
    });
  });

  describe('updateNote', () => {
    it('should update note title', async () => {
      const mockNote = {
        id: 'note-1',
        title: 'Updated Title',
        content_json: { root: { children: [] } },
        editor_version: 'lexical_v1',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(mockApiClient.updateNote).mockResolvedValue(mockNote);

      const result = await notesService.updateNote('note-1', {
        title: 'Updated Title',
      });

      expect(mockApiClient.updateNote).toHaveBeenCalledWith(
        'note-1',
        expect.objectContaining({
          title: 'Updated Title',
        }),
        undefined,
      );
      expect(result.title).toBe('Updated Title');
    });

    it('should update note content', async () => {
      const mockNote = {
        id: 'note-1',
        title: 'Test Note',
        content_json: { root: { children: [{ type: 'paragraph', children: [] }] } },
        editor_version: 'lexical_v1',
        content_text: 'Updated content',
        updated_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(mockApiClient.updateNote).mockResolvedValue(mockNote);

      const newContent: NoteContent = {
        version: 'lexical_v1',
        editorState: { root: { children: [{ type: 'paragraph', children: [] }] } },
        plainText: 'Updated content',
      };

      const result = await notesService.updateNote('note-1', {
        content: newContent,
      });

      expect(mockApiClient.updateNote).toHaveBeenCalledWith(
        'note-1',
        expect.objectContaining({
          content_json: expect.any(Object),
          editor_version: 'lexical_v1',
        }),
        undefined,
      );
      expect(result.content.plainText).toBe('Updated content');
    });
  });

  describe('listNotes', () => {
    it('should list notes with default limit', async () => {
      const mockNotes = [
        {
          id: 'note-1',
          title: 'Note 1',
          content_json: { root: { children: [] } },
          editor_version: 'lexical_v1',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'note-2',
          title: 'Note 2',
          content_json: { root: { children: [] } },
          editor_version: 'lexical_v1',
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      vi.mocked(mockApiClient.listNotes).mockResolvedValue(mockNotes);

      const result = await notesService.listNotes();

      expect(mockApiClient.listNotes).toHaveBeenCalledWith({
        limit: 50,
      });
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('note-1');
    });

    it('should filter by course code', async () => {
      const mockNotes = [
        {
          id: 'note-1',
          title: 'Note 1',
          course_code: 'FIT1045',
          content_json: { root: { children: [] } },
          editor_version: 'lexical_v1',
          created_at: '2024-01-01T00:00:00Z',
        },
      ];

      vi.mocked(mockApiClient.listNotes).mockResolvedValue(mockNotes);

      const result = await notesService.listNotes({ courseCode: 'FIT1045' });

      expect(mockApiClient.listNotes).toHaveBeenCalledWith({
        courseCode: 'FIT1045',
        limit: 50,
      });
      expect(result[0].courseCode).toBe('FIT1045');
    });

    it('should migrate legacy notes without content_json', async () => {
      const legacyNote = {
        id: 'note-1',
        title: 'Legacy Note',
        content: '<p>Legacy HTML content</p>',
        created_at: '2024-01-01T00:00:00Z',
      };

      const migratedNote = {
        id: 'note-1',
        title: 'Legacy Note',
        content_json: { root: { children: [] } },
        editor_version: 'lexical_v1',
        content_text: 'Legacy HTML content',
        created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(mockApiClient.listNotes).mockResolvedValue([legacyNote]);
      vi.mocked(mockApiClient.updateNote).mockResolvedValue(migratedNote);

      const result = await notesService.listNotes();

      expect(result).toHaveLength(1);
      expect(result[0].content.version).toBe('lexical_v1');
      expect(result[0].content.plainText).toContain('Legacy HTML content');
    });
  });

  describe('getNote', () => {
    it('should get a note by ID', async () => {
      const mockNote = {
        id: 'note-1',
        title: 'Test Note',
        content_json: { root: { children: [] } },
        editor_version: 'lexical_v1',
        created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(mockApiClient.apiRequest).mockResolvedValue(mockNote);

      const result = await notesService.getNote('note-1');

      expect(mockApiClient.apiRequest).toHaveBeenCalledWith('/api/notes/note-1', { method: 'GET' });
      expect(result.id).toBe('note-1');
      expect(result.title).toBe('Test Note');
    });
  });

  describe('deleteNote', () => {
    it('should delete a note', async () => {
      vi.mocked(mockApiClient.deleteNote).mockResolvedValue(undefined);

      await notesService.deleteNote('note-1');

      expect(mockApiClient.deleteNote).toHaveBeenCalledWith('note-1');
    });
  });

  describe('toggleStar', () => {
    it('should toggle star status', async () => {
      const mockNote = {
        id: 'note-1',
        title: 'Test Note',
        is_starred: true,
        content_json: { root: { children: [] } },
        editor_version: 'lexical_v1',
        created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(mockApiClient.toggleNoteStar).mockResolvedValue(mockNote);

      const result = await notesService.toggleStar('note-1');

      expect(mockApiClient.toggleNoteStar).toHaveBeenCalledWith('note-1');
      expect(result.isStarred).toBe(true);
    });

    it('should throw error when noteId is missing', async () => {
      await expect(notesService.toggleStar('')).rejects.toThrow('Note ID is required');
    });
  });

  describe('setStar', () => {
    it('should set star status to true', async () => {
      const mockNote = {
        id: 'note-1',
        title: 'Test Note',
        is_starred: true,
        content_json: { root: { children: [] } },
        editor_version: 'lexical_v1',
        created_at: '2024-01-01T00:00:00Z',
      };

      vi.mocked(mockApiClient.setNoteStar).mockResolvedValue(mockNote);

      const result = await notesService.setStar('note-1', true);

      expect(mockApiClient.setNoteStar).toHaveBeenCalledWith('note-1', true);
      expect(result.isStarred).toBe(true);
    });
  });

  describe('listAssets', () => {
    it('should list assets for a note', async () => {
      const mockAssets = [
        {
          id: 'asset-1',
          note_id: 'note-1',
          type: 'image',
          mime_type: 'image/png',
          storage_path: 'path/to/asset.png',
          created_at: '2024-01-01T00:00:00Z',
          url: 'https://example.com/asset.png',
          file_name: 'image.png',
        },
      ] as unknown as any[];

      vi.mocked(mockApiClient.listNoteAssets).mockResolvedValue(mockAssets);

      const result = await notesService.listAssets('note-1');

      expect(mockApiClient.listNoteAssets).toHaveBeenCalledWith({ noteId: 'note-1' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('asset-1');
    });
  });

  describe('uploadAsset', () => {
    it('should upload an asset', async () => {
      const mockAsset = {
        id: 'asset-1',
        note_id: 'note-1',
        type: 'image',
        mime_type: 'image/png',
        storage_path: 'path/to/asset.png',
        created_at: '2024-01-01T00:00:00Z',
        url: 'https://example.com/asset.png',
        file_name: 'image.png',
      } as unknown as any;

      const file = new File(['content'], 'image.png', { type: 'image/png' });
      vi.mocked(mockApiClient.uploadNoteAsset).mockResolvedValue(mockAsset);

      const result = await notesService.uploadAsset('note-1', file);

      expect(mockApiClient.uploadNoteAsset).toHaveBeenCalledWith({
        noteId: 'note-1',
        file,
      });
      expect(result.id).toBe('asset-1');
    });
  });

  describe('deleteAsset', () => {
    it('should delete an asset', async () => {
      vi.mocked(mockApiClient.deleteNoteAsset).mockResolvedValue(undefined);

      await notesService.deleteAsset('asset-1');

      expect(mockApiClient.deleteNoteAsset).toHaveBeenCalledWith({ assetId: 'asset-1' });
    });
  });
});
