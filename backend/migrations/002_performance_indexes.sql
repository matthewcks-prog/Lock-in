-- Migration: 002_performance_indexes.sql
-- Description: Add indexes for scalable query performance (thousands of users)
-- 
-- These indexes are designed for the common query patterns:
-- 1. List notes by user (sorted by date)
-- 2. Filter notes by course_code or source_url
-- 3. Chat queries by user
-- 4. Semantic search via embeddings

-- ============================================================================
-- NOTES TABLE INDEXES
-- ============================================================================

-- Primary listing index: user_id + created_at for the most common query
-- This is a composite index that covers: list notes, filter by user, order by date
CREATE INDEX IF NOT EXISTS idx_notes_user_created 
ON public.notes(user_id, created_at DESC);

-- Course code filter (for filtering notes by course)
-- Partial index only on rows where course_code is set
CREATE INDEX IF NOT EXISTS idx_notes_course_code 
ON public.notes(user_id, course_code);

-- Source URL filter (for filtering notes by page URL)
CREATE INDEX IF NOT EXISTS idx_notes_source_url 
ON public.notes(user_id, source_url);

-- Updated at index for optimistic locking queries and sorting
CREATE INDEX IF NOT EXISTS idx_notes_updated_at 
ON public.notes(user_id, updated_at DESC);

-- Embedding index for semantic search (using IVFFlat for approximate nearest neighbor)
-- Note: This requires the pgvector extension to be enabled
-- The number of lists (100) is a good starting point for < 1 million vectors
-- Adjust based on your data size: sqrt(n) lists is a good heuristic
CREATE INDEX IF NOT EXISTS idx_notes_embedding 
ON public.notes USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- ============================================================================
-- CHATS TABLE INDEXES
-- ============================================================================

-- Primary chat listing index: user_id + last_message_at for chat list
CREATE INDEX IF NOT EXISTS idx_chats_user_last_message 
ON public.chats(user_id, last_message_at DESC);

-- ============================================================================
-- CHAT_MESSAGES TABLE INDEXES
-- ============================================================================

-- Messages by chat (for loading chat history)
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_created 
ON public.chat_messages(chat_id, created_at ASC);

-- ============================================================================
-- NOTE_ASSETS TABLE INDEXES
-- ============================================================================

-- Assets by note (for loading note attachments)
-- Note: This may already exist, IF NOT EXISTS handles that
CREATE INDEX IF NOT EXISTS idx_note_assets_note_id 
ON public.note_assets(note_id);

-- Assets by user (for admin/cleanup queries)
CREATE INDEX IF NOT EXISTS idx_note_assets_user_id 
ON public.note_assets(user_id);

-- ============================================================================
-- AI_REQUESTS TABLE INDEXES
-- ============================================================================

-- Rate limiting queries: user + date
CREATE INDEX IF NOT EXISTS idx_ai_requests_user_created 
ON public.ai_requests(user_id, created_at DESC);

-- Analytics: created_at for time-series queries
CREATE INDEX IF NOT EXISTS idx_ai_requests_created_at 
ON public.ai_requests(created_at DESC);

-- ============================================================================
-- FOLDERS TABLE INDEXES (if used)
-- ============================================================================

-- User's folders
CREATE INDEX IF NOT EXISTS idx_folders_user_id 
ON public.folders(user_id);


-- ============================================================================
-- VERIFY INDEXES (run manually to check)
-- ============================================================================
-- SELECT indexname, tablename, indexdef 
-- FROM pg_indexes 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename, indexname;
