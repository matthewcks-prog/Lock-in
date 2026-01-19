-- Migration: 003_row_level_security.sql
-- Description: Row Level Security policies to ensure users can only access their own data
-- 
-- CRITICAL FOR SCALABILITY & SECURITY:
-- RLS ensures that even if application code has bugs, users cannot access each other's data.
-- This is a defense-in-depth measure required for multi-tenant applications.

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CHATS POLICIES
-- ============================================================================

-- Users can view their own chats
DROP POLICY IF EXISTS "Users can view own chats" ON public.chats;
CREATE POLICY "Users can view own chats"
  ON public.chats FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own chats
DROP POLICY IF EXISTS "Users can insert own chats" ON public.chats;
CREATE POLICY "Users can insert own chats"
  ON public.chats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own chats
DROP POLICY IF EXISTS "Users can update own chats" ON public.chats;
CREATE POLICY "Users can update own chats"
  ON public.chats FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own chats
DROP POLICY IF EXISTS "Users can delete own chats" ON public.chats;
CREATE POLICY "Users can delete own chats"
  ON public.chats FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- CHAT_MESSAGES POLICIES
-- ============================================================================

-- Users can view their own messages
DROP POLICY IF EXISTS "Users can view own messages" ON public.chat_messages;
CREATE POLICY "Users can view own messages"
  ON public.chat_messages FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own messages
DROP POLICY IF EXISTS "Users can insert own messages" ON public.chat_messages;
CREATE POLICY "Users can insert own messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own messages (rarely needed, but for completeness)
DROP POLICY IF EXISTS "Users can update own messages" ON public.chat_messages;
CREATE POLICY "Users can update own messages"
  ON public.chat_messages FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own messages
DROP POLICY IF EXISTS "Users can delete own messages" ON public.chat_messages;
CREATE POLICY "Users can delete own messages"
  ON public.chat_messages FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- NOTES POLICIES
-- ============================================================================

-- Users can view their own notes
DROP POLICY IF EXISTS "Users can view own notes" ON public.notes;
CREATE POLICY "Users can view own notes"
  ON public.notes FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own notes
DROP POLICY IF EXISTS "Users can insert own notes" ON public.notes;
CREATE POLICY "Users can insert own notes"
  ON public.notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own notes
DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
CREATE POLICY "Users can update own notes"
  ON public.notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notes
DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;
CREATE POLICY "Users can delete own notes"
  ON public.notes FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- NOTE_ASSETS POLICIES
-- ============================================================================

-- Users can view their own assets
DROP POLICY IF EXISTS "Users can view own assets" ON public.note_assets;
CREATE POLICY "Users can view own assets"
  ON public.note_assets FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own assets
DROP POLICY IF EXISTS "Users can insert own assets" ON public.note_assets;
CREATE POLICY "Users can insert own assets"
  ON public.note_assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own assets
DROP POLICY IF EXISTS "Users can delete own assets" ON public.note_assets;
CREATE POLICY "Users can delete own assets"
  ON public.note_assets FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- FOLDERS POLICIES
-- ============================================================================

-- Users can view their own folders
DROP POLICY IF EXISTS "Users can view own folders" ON public.folders;
CREATE POLICY "Users can view own folders"
  ON public.folders FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own folders
DROP POLICY IF EXISTS "Users can insert own folders" ON public.folders;
CREATE POLICY "Users can insert own folders"
  ON public.folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own folders
DROP POLICY IF EXISTS "Users can update own folders" ON public.folders;
CREATE POLICY "Users can update own folders"
  ON public.folders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own folders
DROP POLICY IF EXISTS "Users can delete own folders" ON public.folders;
CREATE POLICY "Users can delete own folders"
  ON public.folders FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- AI_REQUESTS POLICIES
-- ============================================================================

-- Users can view their own AI requests (for usage analytics)
DROP POLICY IF EXISTS "Users can view own ai_requests" ON public.ai_requests;
CREATE POLICY "Users can view own ai_requests"
  ON public.ai_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own AI requests (logged by backend)
DROP POLICY IF EXISTS "Users can insert own ai_requests" ON public.ai_requests;
CREATE POLICY "Users can insert own ai_requests"
  ON public.ai_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Note: No UPDATE or DELETE policies for ai_requests - they're append-only logs

-- ============================================================================
-- SERVICE ROLE BYPASS
-- ============================================================================
-- The service role key (used by the backend) bypasses RLS by default in Supabase.
-- This is correct behavior - the backend validates user ownership in application code.
-- RLS provides defense-in-depth if there are bugs in the application layer.

-- ============================================================================
-- VERIFY RLS (run manually)
-- ============================================================================
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public';
--
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies 
-- WHERE schemaname = 'public';
