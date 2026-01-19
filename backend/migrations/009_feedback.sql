-- Migration: 009_feedback.sql
-- Description: Feedback table for structured user reports (bug reports, feature requests)
-- Date: January 2026

-- Feedback table for structured user reports
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  type text NOT NULL CHECK (type IN ('bug', 'feature', 'question', 'other')),
  message text NOT NULL,
  context jsonb, -- { url, courseCode, extensionVersion, browser, page }
  screenshot_url text, -- Optional Supabase Storage link (future)
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  admin_notes text, -- Internal notes (not shown to user)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_feedback_user_id ON public.feedback(user_id, created_at DESC);
CREATE INDEX idx_feedback_status ON public.feedback(status, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
  ON public.feedback FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Future: Admin role can view all feedback
-- (Will add when admin dashboard is built with user_roles table)

-- Add comment for documentation
COMMENT ON TABLE public.feedback IS 'User-submitted feedback (bug reports, feature requests, questions)';
COMMENT ON COLUMN public.feedback.type IS 'Feedback type: bug, feature, question, other';
COMMENT ON COLUMN public.feedback.context IS 'Auto-captured context: url, courseCode, extensionVersion, browser, page';
COMMENT ON COLUMN public.feedback.status IS 'Admin status: open, in_progress, resolved, closed';
COMMENT ON COLUMN public.feedback.admin_notes IS 'Internal admin notes (not shown to user)';
