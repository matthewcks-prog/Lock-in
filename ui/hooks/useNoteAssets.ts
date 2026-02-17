import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { NoteAsset } from '../../core/domain/Note.ts';
import type { NotesService } from '../../core/services/notesService.ts';

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.length > 0) return err.message;
  if (typeof err === 'object' && err !== null) {
    const record = err as Record<string, unknown>;
    if (typeof record['message'] === 'string') return record['message'];
  }
  return fallback;
}

function canListAssets(
  noteId: string | null | undefined,
  notesService: NotesService | null | undefined,
): noteId is string {
  return (
    noteId !== undefined &&
    noteId !== null &&
    noteId.length > 0 &&
    notesService?.listAssets !== undefined
  );
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

function useLoadAssets({
  noteId,
  notesService,
  setNoteAssets,
  setIsLoading,
  setError,
  loadingNoteIdRef,
}: {
  noteId: string | null | undefined;
  notesService: NotesService | null | undefined;
  setNoteAssets: Dispatch<SetStateAction<NoteAsset[]>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  loadingNoteIdRef: MutableRefObject<string | null>;
}): () => Promise<void> {
  return useCallback(async () => {
    const listAssets = notesService?.listAssets;
    if (!canListAssets(noteId, notesService) || listAssets === undefined) {
      setNoteAssets([]);
      setIsLoading(false);
      return;
    }

    if (loadingNoteIdRef.current === noteId) {
      return;
    }

    loadingNoteIdRef.current = noteId;
    setIsLoading(true);
    setError(null);
    setNoteAssets([]);

    try {
      const assets = await listAssets(noteId);
      if (loadingNoteIdRef.current === noteId) {
        setNoteAssets(Array.isArray(assets) ? assets : []);
      }
    } catch (err: unknown) {
      if (loadingNoteIdRef.current === noteId) {
        setError(getErrorMessage(err, 'Failed to load attachments'));
      }
    } finally {
      if (loadingNoteIdRef.current === noteId) {
        setIsLoading(false);
        loadingNoteIdRef.current = null;
      }
    }
  }, [loadingNoteIdRef, noteId, notesService, setError, setIsLoading, setNoteAssets]);
}

function useUploadAsset({
  noteId,
  notesService,
  setNoteAssets,
  setIsUploading,
  setError,
}: {
  noteId: string | null | undefined;
  notesService: NotesService | null | undefined;
  setNoteAssets: Dispatch<SetStateAction<NoteAsset[]>>;
  setIsUploading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
}): (file: File) => Promise<NoteAsset | null> {
  return useCallback(
    async (file: File): Promise<NoteAsset | null> => {
      if (noteId === undefined || noteId === null || noteId.length === 0) {
        setError('Save the note before adding attachments.');
        return null;
      }
      if (notesService?.uploadAsset === undefined) {
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
    [noteId, notesService, setError, setIsUploading, setNoteAssets],
  );
}

function useDeleteAsset({
  notesService,
  setNoteAssets,
  setError,
}: {
  notesService: NotesService | null | undefined;
  setNoteAssets: Dispatch<SetStateAction<NoteAsset[]>>;
  setError: Dispatch<SetStateAction<string | null>>;
}): (assetId: string) => Promise<boolean> {
  return useCallback(
    async (assetId: string): Promise<boolean> => {
      if (notesService?.deleteAsset === undefined) {
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
    [notesService, setError, setNoteAssets],
  );
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
  const loadingNoteIdRef = useRef<string | null>(null);

  const reloadAssets = useLoadAssets({
    noteId,
    notesService,
    setNoteAssets,
    setIsLoading,
    setError,
    loadingNoteIdRef,
  });
  const uploadAsset = useUploadAsset({
    noteId,
    notesService,
    setNoteAssets,
    setIsUploading,
    setError,
  });
  const deleteAsset = useDeleteAsset({ notesService, setNoteAssets, setError });

  return {
    noteAssets,
    isLoading,
    isUploading,
    error,
    uploadAsset,
    deleteAsset,
    reloadAssets,
  };
}
