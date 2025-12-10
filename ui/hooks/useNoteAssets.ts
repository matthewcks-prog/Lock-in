import { useCallback, useEffect, useState } from "react";
import type { NoteAsset } from "../../core/domain/Note.ts";
import type { NotesService } from "../../core/services/notesService.ts";

export interface UseNoteAssetsResult {
  noteAssets: NoteAsset[];
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;
  uploadAsset: (file: File) => Promise<NoteAsset | null>;
  deleteAsset: (assetId: string) => Promise<boolean>;
  reloadAssets: () => Promise<void>;
}

export function useNoteAssets(
  noteId: string | null | undefined,
  notesService: NotesService | null | undefined
): UseNoteAssetsResult {
  const [noteAssets, setNoteAssets] = useState<NoteAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    if (!noteId || !notesService?.listAssets) {
      setNoteAssets([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setNoteAssets([]);
    try {
      const assets = await notesService.listAssets(noteId);
      setNoteAssets(Array.isArray(assets) ? assets : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load attachments");
    } finally {
      setIsLoading(false);
    }
  }, [noteId, notesService]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const uploadAsset = useCallback(
    async (file: File): Promise<NoteAsset | null> => {
      if (!noteId) {
        setError("Save the note before adding attachments.");
        return null;
      }
      if (!notesService?.uploadAsset) {
        setError("Upload is not available.");
        return null;
      }

      setIsUploading(true);
      setError(null);
      try {
        const asset = await notesService.uploadAsset(noteId, file);
        setNoteAssets((prev) => [...prev, asset]);
        return asset;
      } catch (err: any) {
        setError(err?.message || "Failed to upload attachment");
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [noteId, notesService]
  );

  const deleteAsset = useCallback(
    async (assetId: string): Promise<boolean> => {
      if (!notesService?.deleteAsset) {
        setError("Delete is not available.");
        return false;
      }

      try {
        await notesService.deleteAsset(assetId);
        setNoteAssets((prev) => prev.filter((asset) => asset.id !== assetId));
        return true;
      } catch (err: any) {
        setError(err?.message || "Failed to delete attachment");
        return false;
      }
    },
    [notesService]
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
