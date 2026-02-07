/**
 * Core Domain Types for Lock-in
 *
 * Shared types and interfaces used across extension and web app.
 * No Chrome dependencies - pure TypeScript/JavaScript.
 */

/**
 * Theme preference
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Chat message role (industry standard: user, assistant, system)
 */
export type ChatRole = 'user' | 'assistant' | 'system';

/**
 * Chat message - follows OpenAI/Anthropic message format
 */
export type ChatMessage = {
  role: ChatRole;
  content: string;
  timestamp?: string;
  messageId?: string;
};

/**
 * Course context extracted from page
 */
export type CourseContext = {
  courseCode: string | null;
  courseName?: string | null;
  week?: number | null;
  topic?: string | null;
  sourceUrl: string;
  sourceLabel?: string;
};

/**
 * Page context metadata
 */
export type PageContext = {
  url: string;
  title: string;
  heading?: string;
  courseContext: CourseContext;
};

/**
 * Study response from API
 *
 * The assistant's markdown response content.
 * Uses 'content' as the canonical field name (industry standard).
 */
export type StudyResponse = {
  /** The assistant's response content (markdown) */
  content: string;
};

/**
 * API response wrapper
 */
export type ApiResponse<T = StudyResponse> = {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
  chatId?: string;
  chatTitle?: string;
};

/**
 * Task domain model (for future use)
 */
export type Task = {
  id: string | null;
  title: string;
  description: string;
  courseCode: string | null;
  dueDate?: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Chat session
 */
export type ChatSession = {
  id: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
  messageCount?: number;
};

/**
 * User preferences
 */
export type UserPreferences = {
  preferredLanguage: string;
  theme: Theme;
  accentColor: string;
};

/**
 * Auth user (from Supabase)
 */
export type AuthUser = {
  id: string;
  email?: string;
  [key: string]: unknown; // Supabase user object may have additional fields
};

/**
 * Auth session
 */
export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
  user: AuthUser | null;
};

/**
 * Database entity types (matching Supabase schema)
 */

/**
 * Chat database record
 */
export type ChatRecord = {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
};

/**
 * Chat message database record
 */
export type ChatMessageRecord = {
  id: string;
  chat_id: string;
  user_id: string;
  role: string;
  mode: string | null;
  source: string | null;
  input_text: string | null;
  output_text: string | null;
  created_at: string;
};

/**
 * Note database record
 */
export type NoteRecord = {
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
};

/**
 * Folder database record
 */
export type FolderRecord = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

/**
 * AI request log record
 */
export type AIRequestRecord = {
  id: string;
  user_id: string;
  mode: string;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
};

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
export type FeedbackContext = {
  url?: string | null | undefined;
  courseCode?: string | null | undefined;
  extensionVersion?: string | null | undefined;
  browser?: string | null | undefined;
  page?: string | null | undefined;
};

/**
 * Feedback database record
 */
export type FeedbackRecord = {
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
};

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
