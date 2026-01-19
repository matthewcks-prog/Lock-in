-- Migration: 011_chat_assets_cleanup.sql
-- Description: Cleanup for orphaned chat assets (unlinked uploads)
-- Date: February 2026

-- Index for efficient orphan cleanup queries
CREATE INDEX IF NOT EXISTS idx_chat_message_assets_orphaned_created_at
  ON public.chat_message_assets(created_at)
  WHERE message_id IS NULL;

-- Cleanup function for orphaned chat assets (metadata + storage objects)
CREATE OR REPLACE FUNCTION clean_orphaned_chat_assets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  cutoff timestamptz := now() - interval '24 hours';
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'chat-assets'
    AND name IN (
      SELECT storage_path
      FROM public.chat_message_assets
      WHERE message_id IS NULL
        AND created_at < cutoff
    );

  DELETE FROM public.chat_message_assets
  WHERE message_id IS NULL
    AND created_at < cutoff;
END;
$$;

COMMENT ON FUNCTION clean_orphaned_chat_assets() IS
'Deletes chat assets that were uploaded but never linked to a message after 24 hours.';

GRANT EXECUTE ON FUNCTION clean_orphaned_chat_assets() TO service_role;

-- Scheduled job (use Supabase Dashboard or pg_cron if installed):
-- SELECT cron.schedule('clean-orphan-chat-assets', '15 3 * * *', 'SELECT clean_orphaned_chat_assets()');
