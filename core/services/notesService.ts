import type { ApiClient } from '../../api/client';
import type { Note, NoteAsset, NoteContent, NoteContentVersion, NoteType } from '../domain/Note.ts';
import { AppError, ErrorCodes } from '../errors';
import { createLogger } from '../utils/logger';

export interface CreateNoteInput {
  title: string;
  content: NoteContent;
  sourceUrl?: string | null;
  sourceSelection?: string | null;
  courseCode?: string | null;
  noteType?: NoteType;
  tags?: string[];
  clientNoteId?: string;
}

export interface UpdateNoteInput {
  title?: string;
  content?: NoteContent;
  sourceUrl?: string | null;
  sourceSelection?: string | null;
  courseCode?: string | null;
  noteType?: NoteType;
  tags?: string[];
}

export interface NoteRequestOptions {
  signal?: AbortSignal;
  expectedUpdatedAt?: string | null;
}

export interface NotesService {
  listNotes(params?: {
    courseCode?: string | null;
    sourceUrl?: string | null;
    limit?: number;
  }): Promise<Note[]>;
  getNote(noteId: string): Promise<Note>;
  createNote(initial: CreateNoteInput, options?: NoteRequestOptions): Promise<Note>;
  updateNote(noteId: string, changes: UpdateNoteInput, options?: NoteRequestOptions): Promise<Note>;
  deleteNote(noteId: string): Promise<void>;
  toggleStar(noteId: string): Promise<Note>;
  setStar(noteId: string, isStarred: boolean): Promise<Note>;
  listAssets(noteId: string): Promise<NoteAsset[]>;
  uploadAsset(noteId: string, file: File | Blob): Promise<NoteAsset>;
  deleteAsset(assetId: string): Promise<void>;
}

const DEFAULT_CONTENT: NoteContent = {
  version: 'lexical_v1',
  editorState: null,
  legacyHtml: null,
  plainText: '',
};

const logger = createLogger('NotesService');

function isJson(value: unknown): boolean {
  return typeof value === 'object' && value !== null;
}

function safeParseJson(value: unknown): any | null {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.body?.textContent || '';
    } catch {
      // fall through to regex fallback
    }
  }
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function createPlainTextEditorState(text: string): Record<string, any> {
  const paragraph = {
    children: text
      ? [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text,
            type: 'text',
            version: 1,
          },
        ]
      : [],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'paragraph',
    version: 1,
  };

  return {
    root: {
      children: [paragraph],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  };
}

function legacyHtmlToNoteContent(html: string): NoteContent {
  const plainText = stripHtml(html);
  return {
    version: 'lexical_v1',
    editorState: createPlainTextEditorState(plainText),
    legacyHtml: html,
    plainText,
  };
}

function extractPlainTextFromEditorState(editorState: unknown): string {
  try {
    const state = typeof editorState === 'string' ? JSON.parse(editorState) : editorState;
    if (!isJson(state)) return '';

    const collectText = (node: any): string => {
      if (!node) return '';
      if (typeof node.text === 'string') return node.text;
      if (Array.isArray(node.children)) {
        return node.children.map(collectText).join(' ');
      }
      return '';
    };

    const root = (state as any).root;
    if (!root) return '';
    const segments = Array.isArray(root.children)
      ? root.children.map(collectText).filter(Boolean)
      : [];
    return segments.join(' ').trim();
  } catch {
    return '';
  }
}

function normalizeContent(raw: any): NoteContent {
  const editorVersion = (raw?.editor_version || raw?.editorVersion) as
    | NoteContentVersion
    | undefined;
  const contentJson = safeParseJson(raw?.content_json ?? raw?.contentJson);
  const legacyContent = typeof raw?.content === 'string' ? raw.content : undefined;

  if (contentJson) {
    return {
      version: editorVersion || 'lexical_v1',
      editorState: contentJson,
      legacyHtml: legacyContent,
      plainText: raw?.content_text || raw?.plain_text || stripHtml(legacyContent || ''),
    };
  }

  if (legacyContent) {
    return legacyHtmlToNoteContent(legacyContent);
  }

  return { ...DEFAULT_CONTENT };
}

function toDomainNote(raw: any): Note {
  const content = normalizeContent(raw);
  const preview =
    raw?.preview ||
    raw?.content_text ||
    content.plainText ||
    extractPlainTextFromEditorState(content.editorState);

  return {
    id: raw?.id ?? null,
    title: raw?.title || 'Untitled note',
    content,
    sourceUrl: raw?.source_url ?? raw?.sourceUrl ?? null,
    sourceSelection: raw?.source_selection ?? raw?.sourceSelection ?? null,
    courseCode: raw?.course_code ?? raw?.courseCode ?? null,
    noteType: (raw?.note_type as NoteType) || raw?.noteType || 'manual',
    tags: Array.isArray(raw?.tags) ? raw.tags : [],
    createdAt: raw?.created_at ?? raw?.createdAt ?? null,
    updatedAt: raw?.updated_at ?? raw?.updatedAt ?? null,
    linkedLabel: raw?.linked_label ?? raw?.course_code ?? raw?.courseCode ?? undefined,
    isStarred: Boolean(raw?.is_starred ?? raw?.isStarred),
    previewText: preview || '',
  };
}

function toBackendPayload(content: NoteContent | undefined) {
  if (!content) return {};
  const editorState =
    content.editorState ??
    createPlainTextEditorState(
      content.plainText || extractPlainTextFromEditorState(content.editorState) || '',
    );
  const plainText = content.plainText || extractPlainTextFromEditorState(editorState) || null;

  if (content.version === 'lexical_v1') {
    return {
      content_json: editorState,
      editor_version: 'lexical_v1',
      // Keep legacy compatibility: send HTML/plain as a fallback field
      content: content.legacyHtml ?? plainText ?? '',
      content_text: plainText ?? '',
    };
  }

  return {
    content_json: editorState,
    editor_version: content.version,
    content: content.legacyHtml ?? plainText ?? '',
    content_text: plainText ?? '',
  };
}

async function migrateLegacyNote(raw: any, apiClient: ApiClient): Promise<Note> {
  if (!raw?.id || raw?.content_json) {
    return toDomainNote(raw);
  }

  if (typeof raw?.content !== 'string') {
    return toDomainNote(raw);
  }

  const legacyContent = legacyHtmlToNoteContent(raw.content);
  const payload = {
    title: raw.title ?? 'Untitled note',
    ...toBackendPayload(legacyContent),
  };

  try {
    const updated = await apiClient.updateNote(raw.id, payload, undefined);
    return toDomainNote(updated);
  } catch {
    const augmentedRaw = {
      ...raw,
      content_json: payload.content_json,
      editor_version: payload.editor_version,
    };
    return toDomainNote(augmentedRaw);
  }
}

function ensureService(apiClient: ApiClient | null | undefined): asserts apiClient is ApiClient {
  if (!apiClient) {
    throw new Error('Notes service requires an ApiClient instance');
  }
}

export function createNotesService(apiClient: ApiClient | null | undefined): NotesService {
  async function listNotes(
    params: {
      courseCode?: string | null;
      sourceUrl?: string | null;
      limit?: number;
    } = {},
  ): Promise<Note[]> {
    ensureService(apiClient);
    const rawNotes = await apiClient.listNotes({
      courseCode: params.courseCode || undefined,
      sourceUrl: params.sourceUrl || undefined,
      limit: params.limit ?? 50,
    });
    if (!Array.isArray(rawNotes)) return [];
    const migrated = await Promise.all(
      rawNotes.map((raw) =>
        raw?.content_json ? Promise.resolve(toDomainNote(raw)) : migrateLegacyNote(raw, apiClient),
      ),
    );
    return migrated;
  }

  async function getNote(noteId: string): Promise<Note> {
    ensureService(apiClient);
    const raw = await apiClient.apiRequest<any>(`/api/notes/${noteId}`, {
      method: 'GET',
    });
    if (!raw?.content_json && raw?.content) {
      return migrateLegacyNote(raw, apiClient);
    }
    return toDomainNote(raw);
  }

  async function createNote(initial: CreateNoteInput, options?: NoteRequestOptions): Promise<Note> {
    ensureService(apiClient);
    const payload = {
      title: initial.title,
      sourceUrl: initial.sourceUrl ?? null,
      source_url: initial.sourceUrl ?? null,
      sourceSelection: initial.sourceSelection ?? null,
      source_selection: initial.sourceSelection ?? null,
      courseCode: initial.courseCode ?? null,
      course_code: initial.courseCode ?? null,
      noteType: initial.noteType ?? 'manual',
      note_type: initial.noteType ?? 'manual',
      tags: initial.tags ?? [],
      clientNoteId: initial.clientNoteId ?? undefined,
      ...toBackendPayload(initial.content),
    };

    const requestOptions = options?.signal ? { signal: options.signal } : undefined;
    const raw = await apiClient.createNote(payload, requestOptions);
    return toDomainNote(raw);
  }

  async function updateNote(
    noteId: string,
    changes: UpdateNoteInput,
    options?: NoteRequestOptions,
  ): Promise<Note> {
    ensureService(apiClient);
    const payload = {
      ...(changes.title ? { title: changes.title } : {}),
      sourceUrl: changes.sourceUrl ?? undefined,
      source_url: changes.sourceUrl ?? undefined,
      sourceSelection: changes.sourceSelection ?? undefined,
      source_selection: changes.sourceSelection ?? undefined,
      courseCode: changes.courseCode ?? undefined,
      course_code: changes.courseCode ?? undefined,
      noteType: changes.noteType ?? undefined,
      note_type: changes.noteType ?? undefined,
      tags: changes.tags ?? undefined,
      ...toBackendPayload(changes.content),
    };

    const requestOptions =
      options?.signal || options?.expectedUpdatedAt
        ? {
            signal: options?.signal,
            ifUnmodifiedSince: options?.expectedUpdatedAt ?? undefined,
          }
        : undefined;
    const raw = await apiClient.updateNote(noteId, payload, requestOptions);
    return toDomainNote(raw);
  }

  async function deleteNote(noteId: string): Promise<void> {
    ensureService(apiClient);
    await apiClient.deleteNote(noteId);
  }

  async function toggleStar(noteId: string): Promise<Note> {
    ensureService(apiClient);
    if (!noteId) {
      throw new Error('Note ID is required to toggle star');
    }

    // Validate that toggleNoteStar method exists on the API client
    if (typeof apiClient.toggleNoteStar !== 'function') {
      const availableMethods = Object.keys(apiClient);
      const error = new AppError(
        'API client is missing toggleNoteStar method. Please rebuild initApi.js or check your API client initialization.',
        ErrorCodes.INTERNAL_ERROR,
        { details: { reason: 'API_CLIENT_ERROR', availableMethods } },
      );
      logger.error('toggleStar failed: missing toggleNoteStar', { availableMethods });
      throw error;
    }

    try {
      const raw = await apiClient.toggleNoteStar(noteId);
      return toDomainNote(raw);
    } catch (error) {
      // Re-throw with preserved error code for better error handling upstream
      logger.error('toggleStar failed', error);
      throw error;
    }
  }

  async function setStar(noteId: string, isStarred: boolean): Promise<Note> {
    ensureService(apiClient);
    const raw = await apiClient.setNoteStar(noteId, isStarred);
    return toDomainNote(raw);
  }

  async function listAssets(noteId: string): Promise<NoteAsset[]> {
    ensureService(apiClient);
    return apiClient.listNoteAssets({ noteId });
  }

  async function uploadAsset(noteId: string, file: File | Blob): Promise<NoteAsset> {
    ensureService(apiClient);
    return apiClient.uploadNoteAsset({ noteId, file });
  }

  async function deleteAsset(assetId: string): Promise<void> {
    ensureService(apiClient);
    return apiClient.deleteNoteAsset({ assetId });
  }

  return {
    listNotes,
    getNote,
    createNote,
    updateNote,
    deleteNote,
    toggleStar,
    setStar,
    listAssets,
    uploadAsset,
    deleteAsset,
  };
}
