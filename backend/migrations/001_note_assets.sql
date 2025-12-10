-- Note assets table, indexes, and RLS policies
-- Safe to run multiple times; uses IF NOT EXISTS where possible.

CREATE TABLE IF NOT EXISTS public.note_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  type text NOT NULL,         -- 'image', 'document', 'audio', 'video', 'other'
  mime_type text NOT NULL,
  storage_path text NOT NULL, -- path in Supabase Storage bucket `note-assets`
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_note_assets_note_id ON public.note_assets(note_id);
CREATE INDEX IF NOT EXISTS idx_note_assets_user_id ON public.note_assets(user_id);

-- RLS
ALTER TABLE public.note_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view own note assets"
  ON public.note_assets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own note assets"
  ON public.note_assets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete own note assets"
  ON public.note_assets FOR DELETE
  USING (auth.uid() = user_id);
