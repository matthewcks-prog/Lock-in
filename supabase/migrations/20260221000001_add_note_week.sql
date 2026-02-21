-- Add week column to notes table
-- Allows users to persist the study week (1-52) a note was originally created on

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS week smallint;

-- Constraint: week must be between 1 and 52
ALTER TABLE notes
  ADD CONSTRAINT notes_week_range CHECK (week IS NULL OR (week >= 1 AND week <= 52));

-- Index for filtering by week
CREATE INDEX IF NOT EXISTS idx_notes_week ON notes (week) WHERE week IS NOT NULL;

-- Comment
COMMENT ON COLUMN notes.week IS 'Study week number (1-52), null if unassigned';
