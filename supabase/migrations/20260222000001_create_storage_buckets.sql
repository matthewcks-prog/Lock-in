-- Migration: 20260222000001_create_storage_buckets.sql
-- Description: Create storage buckets for note assets and chat assets
-- These buckets were previously created manually via the Supabase Dashboard.
-- This migration ensures they exist in all environments.

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'note-assets',
  'note-assets',
  false,
  10485760,  -- 10 MiB
  ARRAY[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/pdf', 'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-assets',
  'chat-assets',
  false,
  10485760,  -- 10 MiB
  ARRAY[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/pdf', 'text/plain', 'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/javascript', 'application/javascript', 'text/typescript',
    'text/x-python', 'text/x-java', 'text/x-c', 'text/x-c++',
    'text/css', 'text/html', 'application/json',
    'text/x-rust', 'text/x-go'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE POLICIES FOR NOTE ASSETS
-- ============================================================================

DROP POLICY IF EXISTS "Users can upload own note assets" ON storage.objects;
CREATE POLICY "Users can upload own note assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'note-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can read own note assets" ON storage.objects;
CREATE POLICY "Users can read own note assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'note-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own note assets" ON storage.objects;
CREATE POLICY "Users can delete own note assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'note-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- STORAGE POLICIES FOR CHAT ASSETS
-- ============================================================================

DROP POLICY IF EXISTS "Users can upload own chat assets" ON storage.objects;
CREATE POLICY "Users can upload own chat assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can read own chat assets" ON storage.objects;
CREATE POLICY "Users can read own chat assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own chat assets" ON storage.objects;
CREATE POLICY "Users can delete own chat assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
