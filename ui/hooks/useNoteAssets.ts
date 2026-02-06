import { useCallback, useRef, useState } from 'react';
import type { NoteAsset } from '../../core/domain/Note.ts';
import type { NotesService } from '../../core/services/notesService.ts';

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object' && err !== null) {
    const record = err as Record<string, unknown>;
    if (typeof record['message'] === 'string') return record['message'];
  }
  return fallback;
}

export interface UseNoteAssetsResult {
  noteAssets: NoteAsset[];
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;
  uploadAsset: (file: File) => Promise<NoteAsset | null>;
  deleteAsset: (assetId: string) => Promise<boolean>;
  reloadAssets: () => Promise<void>;
}

/**
 * Hook for managing note assets (attachments).
 *
 * IMPORTANT: This hook does NOT auto-fetch assets on mount or when noteId changes.
 * Assets are only loaded when explicitly requested via `reloadAssets()`.
 * This prevents excessive API calls during autosave cycles.
 *
 * The hook includes request deduplication - if a request is already in progress
 * for the same noteId, subsequent calls will be ignored.
 */
export function useNoteAssets(
  noteId: string | null | undefined,
  notesService: NotesService | null | undefined,
): UseNoteAssetsResult {
  const [noteAssets, setNoteAssets] = useState<NoteAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track in-flight request to prevent duplicate requests
  const loadingNoteIdRef = useRef<string | null>(null);

  const loadAssets = useCallback(async () => {
    if (!noteId || !notesService?.listAssets) {
      setNoteAssets([]);
      setIsLoading(false);
      return;
    }

    // Prevent duplicate requests for the same noteId
    if (loadingNoteIdRef.current === noteId) {
      return;
    }

    loadingNoteIdRef.current = noteId;
    setIsLoading(true);
    setError(null);
    setNoteAssets([]);

    try {
      const assets = await notesService.listAssets(noteId);
      // Only update state if this is still the current request
      if (loadingNoteIdRef.current === noteId) {
        setNoteAssets(Array.isArray(assets) ? assets : []);
      }
    } catch (err: unknown) {
      // Only update error if this is still the current request
      if (loadingNoteIdRef.current === noteId) {
        setError(getErrorMessage(err, 'Failed to load attachments'));
      }
    } finally {
      // Only clear loading if this is still the current request
      if (loadingNoteIdRef.current === noteId) {
        setIsLoading(false);
        loadingNoteIdRef.current = null;
      }
    }
  }, [noteId, notesService]);

  // Do not auto-fetch on mount; we only need assets when explicitly requested.
  // This avoids piling up GET requests during autosave cycles.

  const uploadAsset = useCallback(
    async (file: File): Promise<NoteAsset | null> => {
      if (!noteId) {
        setError('Save the note before adding attachments.');
        return null;
      }
      if (!notesService?.uploadAsset) {
        setError('Upload is not available.');
        return null;
      }

      setIsUploading(true);
      setError(null);
      try {
        const asset = await notesService.uploadAsset(noteId, file);
        setNoteAssets((prev) => [...prev, asset]);
        return asset;
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Failed to upload attachment'));
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [noteId, notesService],
  );

  const deleteAsset = useCallback(
    async (assetId: string): Promise<boolean> => {
      if (!notesService?.deleteAsset) {
        setError('Delete is not available.');
        return false;
      }

      try {
        await notesService.deleteAsset(assetId);
        setNoteAssets((prev) => prev.filter((asset) => asset.id !== assetId));
        return true;
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Failed to delete attachment'));
        return false;
      }
    },
    [notesService],
  );

  return {
    noteAssets,
    isLoading,
    isUploading,
    error,
    uploadAsset,
    deleteAsset,
    reloadAssets: loadAssets,
  };
}
