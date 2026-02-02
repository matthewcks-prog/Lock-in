-- Migration: 20260101000001_note_assets.sql
-- Description: Note attachments table for images, documents, and other files
-- Depends on: 20260101000000_foundation.sql (notes table)

-- ============================================================================
-- NOTE_ASSETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.note_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('image', 'document', 'audio', 'video', 'other')),
  mime_type text NOT NULL,
  storage_path text NOT NULL,  -- Path in Supabase Storage bucket 'note-assets'
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.note_assets IS 'File attachments for notes (images, documents, etc.)';
COMMENT ON COLUMN public.note_assets.storage_path IS 'Path in Supabase Storage: <user_id>/<note_id>/<asset_id>.<ext>';
COMMENT ON COLUMN public.note_assets.type IS 'Asset type: image, document, audio, video, other';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_note_assets_note_id ON public.note_assets(note_id);
CREATE INDEX IF NOT EXISTS idx_note_assets_user_id ON public.note_assets(user_id);

-- RLS
ALTER TABLE public.note_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own note assets" ON public.note_assets;
CREATE POLICY "Users can view own note assets"
  ON public.note_assets FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own note assets" ON public.note_assets;
CREATE POLICY "Users can insert own note assets"
  ON public.note_assets FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own note assets" ON public.note_assets;
CREATE POLICY "Users can delete own note assets"
  ON public.note_assets FOR DELETE USING (auth.uid() = user_id);
