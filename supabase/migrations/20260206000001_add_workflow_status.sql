-- Migration: 20260206000001_add_workflow_status.sql
-- Description: Add workflow_status column to tasks table for Kanban board support
-- Date: February 2026
--
-- Adds a workflow_status column to track task position on the Kanban board.
-- Values: 'backlog', 'in_progress', 'done'

-- ============================================================================
-- ADD COLUMN
-- ============================================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS workflow_status text NOT NULL DEFAULT 'backlog';

-- ============================================================================
-- CONSTRAINT
-- ============================================================================

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_workflow_status_check
  CHECK (workflow_status IN ('backlog', 'in_progress', 'done'));

-- ============================================================================
-- INDEX
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_user_workflow
  ON public.tasks (user_id, workflow_status);

-- ============================================================================
-- BACKFILL: Mark completed tasks as 'done'
-- ============================================================================

UPDATE public.tasks SET workflow_status = 'done' WHERE completed = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN public.tasks.workflow_status IS 'Kanban board workflow status (backlog, in_progress, done)';
