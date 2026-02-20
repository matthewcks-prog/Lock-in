-- Migration: 20260101000007_tasks.sql
-- Description: Study tasks table for task management within the Lock-in sidebar
-- Date: February 2026
-- 
-- This migration creates the tasks table for study-focused task management.
-- Designed for fast inline editing, iPhone Notes-style simplicity.

-- ============================================================================
-- TASKS TABLE
-- ============================================================================
-- Study tasks linked to courses with completion tracking.
-- Optimized for fast reads and frequent status updates.

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,           -- When task was marked complete
  due_date timestamptz,               -- Optional due date
  course_code text,                   -- Course code (e.g., 'FIT1045')
  source_url text,                    -- URL where task was created
  sort_order integer NOT NULL DEFAULT 0, -- Manual sort order within list
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tasks IS 'Study tasks for task management in the sidebar';
COMMENT ON COLUMN public.tasks.title IS 'Task title (required, displayed in list)';
COMMENT ON COLUMN public.tasks.description IS 'Optional task description or notes';
COMMENT ON COLUMN public.tasks.completed IS 'Whether the task is marked as done';
COMMENT ON COLUMN public.tasks.completed_at IS 'Timestamp when task was completed';
COMMENT ON COLUMN public.tasks.due_date IS 'Optional due date for the task';
COMMENT ON COLUMN public.tasks.course_code IS 'Course code for filtering (e.g., FIT1045)';
COMMENT ON COLUMN public.tasks.source_url IS 'URL where the task was created';
COMMENT ON COLUMN public.tasks.sort_order IS 'Manual sort order for drag-drop reordering';

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Optimize common query patterns for task retrieval.

-- Primary query pattern: user's tasks sorted by completion and order
CREATE INDEX IF NOT EXISTS idx_tasks_user_sort 
  ON public.tasks (user_id, completed, sort_order);

-- Filter by course code (common for study context)
CREATE INDEX IF NOT EXISTS idx_tasks_user_course 
  ON public.tasks (user_id, course_code) 
  WHERE course_code IS NOT NULL;

-- Filter incomplete tasks (most common view)
CREATE INDEX IF NOT EXISTS idx_tasks_user_incomplete 
  ON public.tasks (user_id, sort_order) 
  WHERE completed = false;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Users can only access their own tasks.

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own tasks
CREATE POLICY tasks_select_own ON public.tasks
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own tasks
CREATE POLICY tasks_insert_own ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own tasks
CREATE POLICY tasks_update_own ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own tasks
CREATE POLICY tasks_delete_own ON public.tasks
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
-- Auto-update updated_at timestamp on row changes.

CREATE OR REPLACE FUNCTION public.update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tasks_updated_at();

-- ============================================================================
-- COMPLETED_AT TRIGGER
-- ============================================================================
-- Auto-set completed_at when task is marked complete.

CREATE OR REPLACE FUNCTION public.update_tasks_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completed = true AND OLD.completed = false THEN
    NEW.completed_at = now();
  ELSIF NEW.completed = false AND OLD.completed = true THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tasks_completed_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tasks_completed_at();
