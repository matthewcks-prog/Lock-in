/**
 * Note domain model (UI/editor agnostic).
 *
 * This file intentionally avoids importing React or Lexical types.
 * Lexical editor state is treated as opaque structured JSON and only
 * parsed/serialized inside the editor adapter layer.
 */

export type NoteContentVersion = 'lexical_v1' | 'legacy_html';

export interface NoteContent {
  version: NoteContentVersion;
  /**
   * Structured editor state (opaque to the domain layer).
   * The Lexical editor serializes to JSON; we keep it as unknown here.
   */
  editorState: unknown;
  /**
   * Optional HTML fallback from legacy contentEditable storage.
   * Used only as a migration path.
   */
  legacyHtml?: string | null;
  /**
   * Optional plain-text preview for list rendering/search.
   */
  plainText?: string | null;
}

export type NoteStatus = 'idle' | 'editing' | 'saving' | 'saved' | 'error';

export type NoteType =
  | 'manual'
  | 'definition'
  | 'formula'
  | 'concept'
  | 'general'
  | 'ai-generated'
  | 'transcript'
  | 'quiz'
  | 'key_takeaways';

export type NoteAssetType = 'image' | 'document' | 'audio' | 'video' | 'other';

export interface NoteAsset {
  id: string;
  noteId: string;
  userId: string;
  type: NoteAssetType;
  mimeType: string;
  storagePath: string;
  createdAt: string; // ISO string from backend
  url: string;
  fileName?: string | null;
}

export interface Note {
  id: string | null;
  title: string;
  content: NoteContent;
  sourceUrl: string | null;
  sourceSelection?: string | null;
  courseCode: string | null;
  noteType: NoteType;
  tags: string[];
  createdAt: string | null;
  updatedAt: string | null;
  linkedLabel?: string;
  isStarred?: boolean;
  previewText?: string | null;
}
