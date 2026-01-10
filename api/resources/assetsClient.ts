import type { NoteAsset } from '../../core/domain/types';
import type { ApiRequest } from '../fetcher';

export interface UploadNoteAssetParams {
  noteId: string;
  file: File | Blob;
}

export interface ListNoteAssetsParams {
  noteId: string;
}

export interface DeleteNoteAssetParams {
  assetId: string;
}

function mapNoteAsset(raw: any): NoteAsset {
  return {
    id: raw.id,
    noteId: raw.note_id,
    userId: raw.user_id,
    type: raw.type,
    mimeType: raw.mime_type,
    storagePath: raw.storage_path,
    createdAt: raw.created_at,
    url: raw.url,
    fileName: raw.file_name || raw.filename || raw.name || null,
  };
}

export function createAssetsClient(apiRequest: ApiRequest) {
  async function uploadNoteAsset(params: UploadNoteAssetParams): Promise<NoteAsset> {
    const { noteId, file } = params;
    if (!noteId) {
      throw new Error('noteId is required to upload an asset');
    }
    if (!file) {
      throw new Error('file is required to upload an asset');
    }

    const formData = new FormData();
    formData.append('file', file);

    const raw = await apiRequest<any>(`/api/notes/${noteId}/assets`, {
      method: 'POST',
      body: formData,
    });

    return mapNoteAsset(raw);
  }

  async function listNoteAssets(params: ListNoteAssetsParams): Promise<NoteAsset[]> {
    const { noteId } = params;
    if (!noteId) {
      throw new Error('noteId is required to list assets');
    }

    const raw = await apiRequest<any[]>(`/api/notes/${noteId}/assets`, {
      method: 'GET',
    });

    return raw.map(mapNoteAsset);
  }

  async function deleteNoteAsset(params: DeleteNoteAssetParams): Promise<void> {
    const { assetId } = params;
    if (!assetId) {
      throw new Error('assetId is required to delete an asset');
    }

    return apiRequest<void>(`/api/note-assets/${assetId}`, {
      method: 'DELETE',
    });
  }

  return {
    uploadNoteAsset,
    listNoteAssets,
    deleteNoteAsset,
  };
}
