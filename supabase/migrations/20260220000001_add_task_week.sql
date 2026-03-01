-- Add week column to tasks table
-- Allows users to assign a study week (1-52) to each task

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS week smallint;

-- Constraint: week must be between 1 and 52
ALTER TABLE tasks
  ADD CONSTRAINT tasks_week_range CHECK (week IS NULL OR (week >= 1 AND week <= 52));

-- Index for filtering by week
CREATE INDEX IF NOT EXISTS idx_tasks_week ON tasks (week) WHERE week IS NOT NULL;

-- Comment
COMMENT ON COLUMN tasks.week IS 'Study week number (1-52), null if unassigned';
