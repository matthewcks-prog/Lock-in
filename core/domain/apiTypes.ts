/**
 * API Response Types
 *
 * Standardized response types for all API endpoints.
 * These types ensure type safety between frontend and backend.
 */

import type { Note, NoteAsset } from '../domain/Note';
import type { ChatMessage, StudyResponse, ChatSession } from '../domain/types';

/**
 * Base API response wrapper
 */
export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

/**
 * API error format
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================
// Notes API Response Types
// ============================================

/**
 * Note list response (from GET /api/notes)
 */
export type NotesListResponse = Note[];

/**
 * Single note response (from GET/POST/PUT /api/notes/:id)
 */
export type NoteResponse = Note;

/**
 * Note search response (from GET /api/notes/search)
 */
export interface NoteSearchResult {
  note: Note;
  similarity: number;
}

export type NotesSearchResponse = NoteSearchResult[];

/**
 * Note assets list response
 */
export type NoteAssetsResponse = NoteAsset[];

/**
 * Note asset upload response
 */
export type NoteAssetUploadResponse = NoteAsset;

// ============================================
// Chat API Response Types
// ============================================

/**
 * Chat session response
 */
export type ChatSessionResponse = ChatSession;

/**
 * Chat sessions list response
 */
export type ChatSessionsListResponse = ChatSession[];

/**
 * Chat messages response
 */
export type ChatMessagesResponse = ChatMessage[];

/**
 * Process text (Lock-in AI) response
 */
export interface ProcessTextResponse {
  success: boolean;
  data?: StudyResponse;
  chatId?: string;
  chatTitle?: string;
  error?: ApiError;
}

/**
 * Chat with notes response
 */
export interface ChatWithNotesResponse {
  answer: string;
  usedNotes: Note[];
}

// ============================================
// Auth API Response Types
// ============================================

/**
 * Sign in/up response
 */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
  user: {
    id: string;
    email?: string;
    [key: string]: unknown;
  } | null;
}

// ============================================
// Health/Status Response Types
// ============================================

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  message: string;
  limits?: {
    maxSelectionLength: number;
    maxUserMessageLength: number;
  };
}
