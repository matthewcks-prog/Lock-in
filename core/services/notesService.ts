import type { ApiClient } from '../../api/client';
import type { Note, NoteAsset, NoteContent, NoteContentVersion, NoteType } from '../domain/Note.ts';
import { AppError, ErrorCodes } from '../errors';
import { createLogger, type Logger } from '../utils/logger';
import { sanitizeUrl } from '../utils/urlSanitizer';

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

export interface NotesServiceDependencies {
  logger?: Logger;
}

const DEFAULT_CONTENT: NoteContent = {
  version: 'lexical_v1',
  editorState: null,
  legacyHtml: null,
  plainText: '',
};

type NoteRecord = Record<string, unknown>;

function isRecord(value: unknown): value is NoteRecord {
  return typeof value === 'object' && value !== null;
}

function safeParseJson(value: unknown): unknown | null {
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

function createPlainTextEditorState(text: string): Record<string, unknown> {
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
    if (!isRecord(state)) return '';

    const collectText = (node: unknown): string => {
      if (!isRecord(node)) return '';
      if (typeof node.text === 'string') return node.text;
      if (Array.isArray(node.children)) {
        return node.children.map(collectText).join(' ');
      }
      return '';
    };

    const root = state.root;
    if (!isRecord(root)) return '';
    const segments = Array.isArray(root.children)
      ? root.children.map(collectText).filter(Boolean)
      : [];
    return segments.join(' ').trim();
  } catch {
    return '';
  }
}

function normalizeContent(raw: NoteRecord | null | undefined): NoteContent {
  const record = raw ?? {};
  const editorVersion = (record.editor_version || record.editorVersion) as
    | NoteContentVersion
    | undefined;
  const contentJson = safeParseJson(record.content_json ?? record.contentJson);
  const legacyContent = typeof record.content === 'string' ? record.content : undefined;
  const contentText =
    typeof record.content_text === 'string'
      ? record.content_text
      : typeof record.plain_text === 'string'
        ? record.plain_text
        : undefined;

  if (contentJson) {
    return {
      version: editorVersion || 'lexical_v1',
      editorState: contentJson,
      legacyHtml: legacyContent,
      plainText: contentText || stripHtml(legacyContent || ''),
    };
  }

  if (legacyContent) {
    return legacyHtmlToNoteContent(legacyContent);
  }

  return { ...DEFAULT_CONTENT };
}

function toDomainNote(raw: NoteRecord | null | undefined): Note {
  const record = raw ?? {};
  const content = normalizeContent(raw);
  const preview =
    (typeof record.preview === 'string' ? record.preview : undefined) ||
    (typeof record.content_text === 'string' ? record.content_text : undefined) ||
    content.plainText ||
    extractPlainTextFromEditorState(content.editorState);

  return {
    id: typeof record.id === 'string' ? record.id : null,
    title: typeof record.title === 'string' && record.title ? record.title : 'Untitled note',
    content,
    sourceUrl:
      (typeof record.source_url === 'string' ? record.source_url : undefined) ??
      (typeof record.sourceUrl === 'string' ? record.sourceUrl : undefined) ??
      null,
    sourceSelection:
      (typeof record.source_selection === 'string' ? record.source_selection : undefined) ??
      (typeof record.sourceSelection === 'string' ? record.sourceSelection : undefined) ??
      null,
    courseCode:
      (typeof record.course_code === 'string' ? record.course_code : undefined) ??
      (typeof record.courseCode === 'string' ? record.courseCode : undefined) ??
      null,
    noteType:
      ((typeof record.note_type === 'string' ? record.note_type : undefined) as NoteType) ||
      ((typeof record.noteType === 'string' ? record.noteType : undefined) as NoteType) ||
      'manual',
    tags: Array.isArray(record.tags) ? (record.tags as string[]) : [],
    createdAt:
      (typeof record.created_at === 'string' ? record.created_at : undefined) ??
      (typeof record.createdAt === 'string' ? record.createdAt : undefined) ??
      null,
    updatedAt:
      (typeof record.updated_at === 'string' ? record.updated_at : undefined) ??
      (typeof record.updatedAt === 'string' ? record.updatedAt : undefined) ??
      null,
    linkedLabel:
      (typeof record.linked_label === 'string' ? record.linked_label : undefined) ??
      (typeof record.course_code === 'string' ? record.course_code : undefined) ??
      (typeof record.courseCode === 'string' ? record.courseCode : undefined) ??
      undefined,
    isStarred: Boolean(record.is_starred ?? record.isStarred),
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

async function migrateLegacyNote(
  raw: NoteRecord | null | undefined,
  apiClient: ApiClient,
): Promise<Note> {
  if (!raw?.id || raw?.content_json) {
    return toDomainNote(raw);
  }

  if (typeof raw?.content !== 'string') {
    return toDomainNote(raw);
  }

  const legacyContent = legacyHtmlToNoteContent(raw.content);
  const title =
    typeof raw.title === 'string' && raw.title.trim().length > 0 ? raw.title : 'Untitled note';
  const payload = {
    title,
    ...toBackendPayload(legacyContent),
  };

  try {
    const updated = await apiClient.updateNote(raw.id as string, payload, undefined);
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

export function createNotesService(
  apiClient: ApiClient | null | undefined,
  deps: NotesServiceDependencies = {},
): NotesService {
  const logger = deps.logger ?? createLogger('NotesService');
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
    const raw = await apiClient.apiRequest<unknown>(`/api/notes/${noteId}`, {
      method: 'GET',
    });
    const record = isRecord(raw) ? raw : null;
    if (record && !record.content_json && typeof record.content === 'string') {
      return migrateLegacyNote(record, apiClient);
    }
    return toDomainNote(record);
  }

  async function createNote(initial: CreateNoteInput, options?: NoteRequestOptions): Promise<Note> {
    ensureService(apiClient);
    // Sanitize URL to remove sensitive query parameters (sesskey, tokens, etc.)
    const cleanSourceUrl = initial.sourceUrl ? sanitizeUrl(initial.sourceUrl) : null;
    const payload = {
      title: initial.title,
      sourceUrl: cleanSourceUrl,
      source_url: cleanSourceUrl,
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
    // Sanitize URL to remove sensitive query parameters (sesskey, tokens, etc.)
    const cleanSourceUrl = changes.sourceUrl ? sanitizeUrl(changes.sourceUrl) : undefined;
    const payload = {
      ...(changes.title ? { title: changes.title } : {}),
      sourceUrl: cleanSourceUrl,
      source_url: cleanSourceUrl,
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
