-- Add week column to notes table
-- Stores the Moodle week number (1–52) at the time the note was created.
-- NULL means the note was created outside a week context or before this feature.
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS week SMALLINT
    CONSTRAINT notes_week_range CHECK (week BETWEEN 1 AND 52);

-- Index for filtering notes by week (partial – NULL rows excluded automatically)
CREATE INDEX IF NOT EXISTS idx_notes_week
  ON notes (week)
  WHERE week IS NOT NULL;
