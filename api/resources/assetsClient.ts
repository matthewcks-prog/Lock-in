import type { NoteAsset } from '../../core/domain/types';
import type { ApiRequest } from '../fetcher';
import { validateNoteAssetRecord, validateNoteAssetRecords } from '../validation';

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

type NoteAssetRecord = {
  id: string;
  note_id: string;
  user_id: string;
  type: NoteAsset['type'];
  mime_type: string;
  storage_path: string;
  created_at: string;
  url?: string | null;
  file_name?: string | null;
  filename?: string | null;
  name?: string | null;
};

function resolveFileName(raw: NoteAssetRecord): string | null {
  if (typeof raw.file_name === 'string' && raw.file_name.length > 0) return raw.file_name;
  if (typeof raw.filename === 'string' && raw.filename.length > 0) return raw.filename;
  if (typeof raw.name === 'string' && raw.name.length > 0) return raw.name;
  return null;
}

function mapNoteAsset(raw: NoteAssetRecord): NoteAsset {
  return {
    id: raw.id,
    noteId: raw.note_id,
    userId: raw.user_id,
    type: raw.type,
    mimeType: raw.mime_type,
    storagePath: raw.storage_path,
    createdAt: raw.created_at,
    url: typeof raw.url === 'string' ? raw.url : '',
    fileName: resolveFileName(raw),
  };
}

export type AssetsClient = {
  uploadNoteAsset: (params: UploadNoteAssetParams) => Promise<NoteAsset>;
  listNoteAssets: (params: ListNoteAssetsParams) => Promise<NoteAsset[]>;
  deleteNoteAsset: (params: DeleteNoteAssetParams) => Promise<void>;
};

export function createAssetsClient(apiRequest: ApiRequest): AssetsClient {
  async function uploadNoteAsset(params: UploadNoteAssetParams): Promise<NoteAsset> {
    const { noteId, file } = params;
    if (typeof noteId !== 'string' || noteId.trim().length === 0) {
      throw new Error('noteId is required to upload an asset');
    }
    if (file === undefined || file === null) {
      throw new Error('file is required to upload an asset');
    }

    const formData = new FormData();
    formData.append('file', file);

    const raw = await apiRequest<unknown>(`/api/notes/${noteId}/assets`, {
      method: 'POST',
      body: formData,
    });

    return mapNoteAsset(validateNoteAssetRecord(raw, 'uploadNoteAsset') as NoteAssetRecord);
  }

  async function listNoteAssets(params: ListNoteAssetsParams): Promise<NoteAsset[]> {
    const { noteId } = params;
    if (typeof noteId !== 'string' || noteId.trim().length === 0) {
      throw new Error('noteId is required to list assets');
    }

    const raw = await apiRequest<unknown>(`/api/notes/${noteId}/assets`, {
      method: 'GET',
    });

    return validateNoteAssetRecords(raw, 'listNoteAssets').map((record) =>
      mapNoteAsset(record as NoteAssetRecord),
    );
  }

  async function deleteNoteAsset(params: DeleteNoteAssetParams): Promise<void> {
    const { assetId } = params;
    if (typeof assetId !== 'string' || assetId.trim().length === 0) {
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
