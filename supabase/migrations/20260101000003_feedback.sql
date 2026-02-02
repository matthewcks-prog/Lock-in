-- Migration: 20260101000003_feedback.sql
-- Description: User feedback table for bug reports, feature requests, and questions
-- Depends on: 20260101000000_foundation.sql (auth.users)

-- ============================================================================
-- FEEDBACK TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- Keep feedback if user deleted
  type text NOT NULL CHECK (type IN ('bug', 'feature', 'question', 'other')),
  message text NOT NULL,
  context jsonb,                -- { url, courseCode, extensionVersion, browser, page }
  screenshot_url text,          -- Optional Supabase Storage link
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  admin_notes text,             -- Internal notes (not shown to user)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.feedback IS 'User-submitted feedback (bug reports, feature requests, questions)';
COMMENT ON COLUMN public.feedback.type IS 'Feedback type: bug, feature, question, other';
COMMENT ON COLUMN public.feedback.context IS 'Auto-captured context: url, courseCode, extensionVersion, browser, page';
COMMENT ON COLUMN public.feedback.status IS 'Admin status: open, in_progress, resolved, closed';
COMMENT ON COLUMN public.feedback.admin_notes IS 'Internal admin notes (not shown to user)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status, created_at DESC);

-- RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
CREATE POLICY "Users can view own feedback"
  ON public.feedback FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own feedback" ON public.feedback;
CREATE POLICY "Users can insert own feedback"
  ON public.feedback FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Future: Admin role can view/update all feedback (add when admin dashboard is built)
