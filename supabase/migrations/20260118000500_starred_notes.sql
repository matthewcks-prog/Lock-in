-- Migration: Add is_starred column to notes table
-- Date: December 2024
-- Description: Enables starring/favoriting notes for quick access

-- Add is_starred column with default value of false
ALTER TABLE public.notes
ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for efficient starred notes filtering
-- Partial index: only index starred notes since most notes won't be starred
CREATE INDEX IF NOT EXISTS idx_notes_starred
ON public.notes(user_id, is_starred, created_at DESC)
WHERE is_starred = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN public.notes.is_starred IS 'Whether the note is starred/favorited by the user for quick access';
