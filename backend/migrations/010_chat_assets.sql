-- Migration: 010_chat_assets.sql
-- Description: Chat message attachments table and storage bucket for file uploads in chat
-- Date: January 2026

-- Chat message assets table (mirrors note_assets pattern)
-- Stores metadata for files attached to chat messages
CREATE TABLE IF NOT EXISTS public.chat_message_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  type text NOT NULL CHECK (type IN ('image', 'document', 'code', 'other')),
  mime_type text NOT NULL,
  storage_path text NOT NULL,  -- path in Supabase Storage bucket `chat-assets`
  file_name text,              -- original filename for display
  file_size integer,           -- size in bytes for validation
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_chat_message_assets_message_id ON public.chat_message_assets(message_id);
CREATE INDEX IF NOT EXISTS idx_chat_message_assets_user_id ON public.chat_message_assets(user_id);

-- Enable Row Level Security
ALTER TABLE public.chat_message_assets ENABLE ROW LEVEL SECURITY;

-- Users can view their own chat assets
DROP POLICY IF EXISTS "Users can view own chat assets" ON public.chat_message_assets;
CREATE POLICY "Users can view own chat assets"
  ON public.chat_message_assets FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own chat assets
DROP POLICY IF EXISTS "Users can insert own chat assets" ON public.chat_message_assets;
CREATE POLICY "Users can insert own chat assets"
  ON public.chat_message_assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own chat assets
DROP POLICY IF EXISTS "Users can delete own chat assets" ON public.chat_message_assets;
CREATE POLICY "Users can delete own chat assets"
  ON public.chat_message_assets FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE public.chat_message_assets IS 'File attachments for chat messages (images, documents, code files)';
COMMENT ON COLUMN public.chat_message_assets.message_id IS 'Parent chat message (nullable for pending uploads before message creation)';
COMMENT ON COLUMN public.chat_message_assets.type IS 'Asset type: image, document, code, other';
COMMENT ON COLUMN public.chat_message_assets.storage_path IS 'Path in Supabase Storage bucket chat-assets: <user_id>/<chat_id>/<asset_id>.<ext>';
COMMENT ON COLUMN public.chat_message_assets.file_name IS 'Original filename for display purposes';
COMMENT ON COLUMN public.chat_message_assets.file_size IS 'File size in bytes for validation and display';

-- Storage bucket creation (run in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'chat-assets',
--   'chat-assets',
--   false,
--   10485760,  -- 10MB limit
--   ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 
--         'application/pdf', 'application/msword', 
--         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
--         'text/plain', 'text/markdown', 'text/x-python', 'text/javascript',
--         'application/json', 'text/css', 'text/html']
-- );

-- Storage policies for chat-assets bucket (run after bucket creation)
-- CREATE POLICY "Users can upload own chat assets"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'chat-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can view own chat assets"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'chat-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- CREATE POLICY "Users can delete own chat assets"
--   ON storage.objects FOR DELETE
--   USING (bucket_id = 'chat-assets' AND auth.uid()::text = (storage.foldername(name))[1]);
