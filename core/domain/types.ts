/**
 * Core Domain Types for Lock-in
 *
 * Shared types and interfaces used across extension and web app.
 * No Chrome dependencies - pure TypeScript/JavaScript.
 */

/**
 * Study mode types
 */
export type StudyMode = 'explain' | 'general';

/**
 * Theme preference
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Chat message role
 */
export type ChatRole = 'user' | 'assistant' | 'system';

/**
 * Chat message
 */
export interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp?: string;
  messageId?: string;
}

/**
 * Course context extracted from page
 */
export interface CourseContext {
  courseCode: string | null;
  courseName?: string | null;
  week?: number | null;
  topic?: string | null;
  sourceUrl: string;
  sourceLabel?: string;
}

/**
 * Page context metadata
 */
export interface PageContext {
  url: string;
  title: string;
  heading?: string;
  courseContext: CourseContext;
}

/**
 * Study response from API
 */
export interface StudyResponse {
  mode: StudyMode;
  explanation: string;
  notes?: Array<{
    title: string;
    content: string;
    type: string;
  }>;
  todos?: Array<{
    title: string;
    description: string;
  }>;
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
}

/**
 * API response wrapper
 */
export interface ApiResponse<T = StudyResponse> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
  chatId?: string;
  chatTitle?: string;
}

/**
 * Task domain model (for future use)
 */
export interface Task {
  id: string | null;
  title: string;
  description: string;
  courseCode: string | null;
  dueDate?: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Chat session
 */
export interface ChatSession {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  messageCount?: number;
}

/**
 * User preferences
 */
export interface UserPreferences {
  preferredLanguage: string;
  theme: Theme;
  accentColor: string;
  defaultMode: StudyMode;
  modePreference: 'fixed' | 'lastUsed';
}

/**
 * Auth user (from Supabase)
 */
export interface AuthUser {
  id: string;
  email?: string;
  [key: string]: unknown; // Supabase user object may have additional fields
}

/**
 * Auth session
 */
export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
  user: AuthUser | null;
}

/**
 * Database entity types (matching Supabase schema)
 */

/**
 * Chat database record
 */
export interface ChatRecord {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}

/**
 * Chat message database record
 */
export interface ChatMessageRecord {
  id: string;
  chat_id: string;
  user_id: string;
  role: string;
  mode: string | null;
  source: string | null;
  input_text: string | null;
  output_text: string | null;
  created_at: string;
}

/**
 * Note database record
 */
export interface NoteRecord {
  id: string;
  user_id: string;
  title: string | null;
  content: string;
  source_selection: string | null;
  source_url: string | null;
  course_code: string | null;
  note_type: string | null;
  tags: string[];
  embedding?: number[] | null; // Vector embedding for semantic search
  created_at: string;
  updated_at: string;
}

/**
 * Folder database record
 */
export interface FolderRecord {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

/**
 * AI request log record
 */
export interface AIRequestRecord {
  id: string;
  user_id: string;
  mode: string;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
}

/**
 * Feedback type options
 */
export type FeedbackType = 'bug' | 'feature' | 'question' | 'other';

/**
 * Feedback status (admin use)
 */
export type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

/**
 * Context auto-captured with feedback
 */
export interface FeedbackContext {
  url?: string;
  courseCode?: string;
  extensionVersion?: string;
  browser?: string;
  page?: string;
}

/**
 * Feedback database record
 */
export interface FeedbackRecord {
  id: string;
  user_id: string;
  type: FeedbackType;
  message: string;
  context: FeedbackContext | null;
  screenshot_url: string | null;
  status: FeedbackStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Note-related domain exports live in core/domain/Note.ts
 * and are re-exported here for convenience.
 */
export type {
  Note,
  NoteAsset,
  NoteAssetType,
  NoteContent,
  NoteContentVersion,
  NoteStatus,
  NoteType,
} from './Note.ts';
