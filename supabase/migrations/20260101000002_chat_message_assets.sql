-- Migration: 20260101000002_chat_message_assets.sql
-- Description: Chat message attachments for images, documents, and code files
-- Depends on: 20260101000000_foundation.sql (chat_messages table)

-- ============================================================================
-- CHAT_MESSAGE_ASSETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chat_message_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.chat_messages(id) ON DELETE CASCADE,  -- Nullable for pending uploads
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('image', 'document', 'code', 'other')),
  mime_type text NOT NULL,
  storage_path text NOT NULL,   -- Path in Supabase Storage bucket 'chat-assets'
  file_name text,               -- Original filename for display
  file_size integer,            -- Size in bytes for validation
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chat_message_assets IS 'File attachments for chat messages';
COMMENT ON COLUMN public.chat_message_assets.message_id IS 'Parent message (nullable for pending uploads before message creation)';
COMMENT ON COLUMN public.chat_message_assets.storage_path IS 'Path in Supabase Storage: <user_id>/<chat_id>/<asset_id>.<ext>';
COMMENT ON COLUMN public.chat_message_assets.type IS 'Asset type: image, document, code, other';
COMMENT ON COLUMN public.chat_message_assets.file_name IS 'Original filename for display purposes';
COMMENT ON COLUMN public.chat_message_assets.file_size IS 'File size in bytes for validation and display';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_message_assets_message_id ON public.chat_message_assets(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_assets_user_id ON public.chat_message_assets(user_id);

-- Index for orphan cleanup queries
CREATE INDEX IF NOT EXISTS idx_chat_message_assets_orphaned_created_at
  ON public.chat_message_assets(created_at)
  WHERE message_id IS NULL;

-- RLS
ALTER TABLE public.chat_message_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own chat assets" ON public.chat_message_assets;
CREATE POLICY "Users can view own chat assets"
  ON public.chat_message_assets FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own chat assets" ON public.chat_message_assets;
CREATE POLICY "Users can insert own chat assets"
  ON public.chat_message_assets FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own chat assets" ON public.chat_message_assets;
CREATE POLICY "Users can delete own chat assets"
  ON public.chat_message_assets FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- CLEANUP FUNCTION FOR ORPHANED ASSETS
-- ============================================================================

CREATE OR REPLACE FUNCTION clean_orphaned_chat_assets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  cutoff timestamptz := now() - interval '24 hours';
BEGIN
  -- Delete storage objects for orphaned assets
  DELETE FROM storage.objects
  WHERE bucket_id = 'chat-assets'
    AND name IN (
      SELECT storage_path
      FROM public.chat_message_assets
      WHERE message_id IS NULL
        AND created_at < cutoff
    );

  -- Delete orphaned asset metadata
  DELETE FROM public.chat_message_assets
  WHERE message_id IS NULL
    AND created_at < cutoff;
END;
$$;

COMMENT ON FUNCTION clean_orphaned_chat_assets() IS 
'Deletes chat assets uploaded but never linked to a message after 24 hours.';

GRANT EXECUTE ON FUNCTION clean_orphaned_chat_assets() TO service_role;

-- Schedule via pg_cron (run in Supabase Dashboard):
-- SELECT cron.schedule('clean-orphan-chat-assets', '15 3 * * *', 'SELECT clean_orphaned_chat_assets()');
