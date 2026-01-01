-- 007_transcripts_hardening.sql
-- Harden transcript jobs + cache (state machine, chunk tracking, per-user cache)

BEGIN;

-- Normalize legacy statuses
UPDATE public.transcript_jobs
SET status = CASE
  WHEN status = 'completed' THEN 'done'
  WHEN status = 'failed' THEN 'error'
  ELSE status
END
WHERE status IN ('completed', 'failed');

ALTER TABLE public.transcript_jobs
  ADD COLUMN IF NOT EXISTS expected_total_chunks integer,
  ADD COLUMN IF NOT EXISTS bytes_received bigint NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transcript_jobs_status_check'
  ) THEN
    ALTER TABLE public.transcript_jobs
      ADD CONSTRAINT transcript_jobs_status_check
      CHECK (status IN ('created','uploading','uploaded','processing','done','error','canceled'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.transcript_job_chunks (
  job_id uuid NOT NULL REFERENCES public.transcript_jobs(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  byte_size integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transcript_job_chunks_pkey PRIMARY KEY (job_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_transcript_job_chunks_job
  ON public.transcript_job_chunks(job_id);

ALTER TABLE public.transcript_job_chunks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'transcript_job_chunks'
      AND policyname = 'Users can view own transcript job chunks'
  ) THEN
    CREATE POLICY "Users can view own transcript job chunks"
      ON public.transcript_job_chunks FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.transcript_jobs
          WHERE transcript_jobs.id = transcript_job_chunks.job_id
            AND transcript_jobs.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Clear cached transcripts (cache only) and enforce per-user access
DELETE FROM public.transcripts;

ALTER TABLE public.transcripts
  DROP CONSTRAINT IF EXISTS transcripts_pkey;

ALTER TABLE public.transcripts
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

ALTER TABLE public.transcripts
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.transcripts
  ADD CONSTRAINT transcripts_pkey PRIMARY KEY (user_id, fingerprint);

-- Redact any stored URLs
UPDATE public.transcript_jobs
SET media_url = NULL,
    media_url_normalized = NULL;

UPDATE public.transcripts
SET media_url = NULL,
    media_url_normalized = NULL;

ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'transcripts'
      AND policyname = 'Users can view own transcripts'
  ) THEN
    CREATE POLICY "Users can view own transcripts"
      ON public.transcripts FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'transcripts'
      AND policyname = 'Users can insert own transcripts'
  ) THEN
    CREATE POLICY "Users can insert own transcripts"
      ON public.transcripts FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'transcripts'
      AND policyname = 'Users can update own transcripts'
  ) THEN
    CREATE POLICY "Users can update own transcripts"
      ON public.transcripts FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'transcripts'
      AND policyname = 'Users can delete own transcripts'
  ) THEN
    CREATE POLICY "Users can delete own transcripts"
      ON public.transcripts FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

COMMIT;
