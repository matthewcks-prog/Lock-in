-- Migration: 20260101000000_foundation.sql
-- Description: Core schema foundation - all base tables required by the application
-- Date: January 2026
-- 
-- This migration creates the foundational tables that all other migrations depend on.
-- Tables: chats, chat_messages, notes, folders, ai_requests
-- 
-- IMPORTANT: This MUST run first before any other migrations.

-- ============================================================================
-- ENABLE REQUIRED EXTENSIONS
-- ============================================================================

-- Create extensions schema if not exists (Supabase standard)
CREATE SCHEMA IF NOT EXISTS extensions;

-- Enable pgvector for semantic search (in extensions schema per Supabase convention)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Set search_path to include extensions schema for vector operations
SET search_path = public, extensions;

-- Make search_path persistent for all Supabase roles
ALTER ROLE authenticator SET search_path = public, extensions;
ALTER ROLE anon SET search_path = public, extensions;
ALTER ROLE authenticated SET search_path = public, extensions;
ALTER ROLE service_role SET search_path = public, extensions;

-- ============================================================================
-- CHATS TABLE
-- ============================================================================
-- Conversation sessions. Each chat represents a conversation thread.

CREATE TABLE IF NOT EXISTS public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.chats IS 'Conversation sessions (one per thread)';
COMMENT ON COLUMN public.chats.title IS 'Optional chat title (auto-generated or user-set)';
COMMENT ON COLUMN public.chats.last_message_at IS 'Timestamp of most recent message (for sorting)';

-- ============================================================================
-- CHAT_MESSAGES TABLE
-- ============================================================================
-- Individual messages within a chat.

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  mode text,                    -- Study mode: 'explain', 'general'
  source text,                  -- Original selected text (for user messages)
  input_text text,              -- User input text
  output_text text,             -- Assistant response text
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chat_messages IS 'Individual messages within a chat';
COMMENT ON COLUMN public.chat_messages.role IS 'Message role: user, assistant, or system';
COMMENT ON COLUMN public.chat_messages.mode IS 'Study mode used: explain, general';
COMMENT ON COLUMN public.chat_messages.source IS 'Original selected text (for user messages)';

-- ============================================================================
-- NOTES TABLE
-- ============================================================================
-- Study notes linked to pages/courses with semantic search support.

CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  content_json jsonb NOT NULL,
  editor_version text NOT NULL DEFAULT 'lexical_v1',
  content_plain text,           -- Plain text for search/embeddings
  source_selection text,        -- Original selected text
  source_url text,              -- URL where note was created
  course_code text,             -- Course code (e.g., 'FIT1045')
  note_type text,               -- Type: manual, definition, formula, concept, general, ai-generated
  tags text[] DEFAULT '{}',     -- Array of tags
  embedding extensions.vector(1536),  -- Vector embedding for semantic search
  is_starred boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notes IS 'Study notes with semantic search support';
COMMENT ON COLUMN public.notes.content_json IS 'Canonical structured content (Lexical JSON)';
COMMENT ON COLUMN public.notes.editor_version IS 'Version tag for the editor (e.g., lexical_v1)';
COMMENT ON COLUMN public.notes.embedding IS 'Vector embedding for semantic search (1536 dimensions for OpenAI)';
COMMENT ON COLUMN public.notes.is_starred IS 'Whether the note is starred/favorited';

-- ============================================================================
-- FOLDERS TABLE
-- ============================================================================
-- User-defined folder groupings for organizing notes.

CREATE TABLE IF NOT EXISTS public.folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.folders IS 'User-defined folder groupings for organizing notes';

-- ============================================================================
-- AI_REQUESTS TABLE
-- ============================================================================
-- Log of AI API requests for analytics, quotas, and debugging.

CREATE TABLE IF NOT EXISTS public.ai_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL,
  tokens_in integer,
  tokens_out integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_requests IS 'AI usage log for rate limiting, analytics, and billing';
COMMENT ON COLUMN public.ai_requests.mode IS 'Study mode: explain, general';

-- ============================================================================
-- PERFORMANCE INDEXES (Foundation Tables)
-- ============================================================================

-- Chats: Primary listing by user + last message
CREATE INDEX IF NOT EXISTS idx_chats_user_last_message 
  ON public.chats(user_id, last_message_at DESC);

-- Chat Messages: Load chat history
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_created 
  ON public.chat_messages(chat_id, created_at ASC);

-- Notes: Primary listing by user + date
CREATE INDEX IF NOT EXISTS idx_notes_user_created 
  ON public.notes(user_id, created_at DESC);

-- Notes: Course code filter
CREATE INDEX IF NOT EXISTS idx_notes_course_code 
  ON public.notes(user_id, course_code);

-- Notes: Source URL filter
CREATE INDEX IF NOT EXISTS idx_notes_source_url 
  ON public.notes(user_id, source_url);

-- Notes: Updated at for optimistic locking
CREATE INDEX IF NOT EXISTS idx_notes_updated_at 
  ON public.notes(user_id, updated_at DESC);

-- Notes: Starred notes partial index
CREATE INDEX IF NOT EXISTS idx_notes_starred
  ON public.notes(user_id, is_starred, created_at DESC)
  WHERE is_starred = true;

-- Notes: Semantic search (IVFFlat for approximate nearest neighbor)
CREATE INDEX IF NOT EXISTS idx_notes_embedding 
  ON public.notes USING ivfflat (embedding extensions.vector_cosine_ops) 
  WITH (lists = 100);

-- Folders: User's folders
CREATE INDEX IF NOT EXISTS idx_folders_user_id 
  ON public.folders(user_id);

-- AI Requests: Rate limiting by user + date
CREATE INDEX IF NOT EXISTS idx_ai_requests_user_created 
  ON public.ai_requests(user_id, created_at DESC);

-- AI Requests: Time-series analytics
CREATE INDEX IF NOT EXISTS idx_ai_requests_created_at 
  ON public.ai_requests(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (Foundation Tables)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

-- CHATS POLICIES
DROP POLICY IF EXISTS "Users can view own chats" ON public.chats;
CREATE POLICY "Users can view own chats"
  ON public.chats FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chats" ON public.chats;
CREATE POLICY "Users can insert own chats"
  ON public.chats FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own chats" ON public.chats;
CREATE POLICY "Users can update own chats"
  ON public.chats FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chats" ON public.chats;
CREATE POLICY "Users can delete own chats"
  ON public.chats FOR DELETE USING (auth.uid() = user_id);

-- CHAT_MESSAGES POLICIES
DROP POLICY IF EXISTS "Users can view own messages" ON public.chat_messages;
CREATE POLICY "Users can view own messages"
  ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own messages" ON public.chat_messages;
CREATE POLICY "Users can insert own messages"
  ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own messages" ON public.chat_messages;
CREATE POLICY "Users can update own messages"
  ON public.chat_messages FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own messages" ON public.chat_messages;
CREATE POLICY "Users can delete own messages"
  ON public.chat_messages FOR DELETE USING (auth.uid() = user_id);

-- NOTES POLICIES
DROP POLICY IF EXISTS "Users can view own notes" ON public.notes;
CREATE POLICY "Users can view own notes"
  ON public.notes FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notes" ON public.notes;
CREATE POLICY "Users can insert own notes"
  ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
CREATE POLICY "Users can update own notes"
  ON public.notes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;
CREATE POLICY "Users can delete own notes"
  ON public.notes FOR DELETE USING (auth.uid() = user_id);

-- FOLDERS POLICIES
DROP POLICY IF EXISTS "Users can view own folders" ON public.folders;
CREATE POLICY "Users can view own folders"
  ON public.folders FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own folders" ON public.folders;
CREATE POLICY "Users can insert own folders"
  ON public.folders FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own folders" ON public.folders;
CREATE POLICY "Users can update own folders"
  ON public.folders FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own folders" ON public.folders;
CREATE POLICY "Users can delete own folders"
  ON public.folders FOR DELETE USING (auth.uid() = user_id);

-- AI_REQUESTS POLICIES
DROP POLICY IF EXISTS "Users can view own ai requests" ON public.ai_requests;
CREATE POLICY "Users can view own ai requests"
  ON public.ai_requests FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own ai requests" ON public.ai_requests;
CREATE POLICY "Users can insert own ai requests"
  ON public.ai_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Semantic search function for notes
CREATE OR REPLACE FUNCTION match_notes(
  query_embedding extensions.vector(1536),
  match_count integer,
  in_user_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  content_plain text,
  source_url text,
  course_code text,
  note_type text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.title,
    n.content_plain,
    n.source_url,
    n.course_code,
    n.note_type,
    1 - (n.embedding <=> query_embedding) AS similarity
  FROM notes n
  WHERE n.user_id = in_user_id
    AND n.embedding IS NOT NULL
  ORDER BY n.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_notes IS 'Semantic search for notes using vector similarity';
