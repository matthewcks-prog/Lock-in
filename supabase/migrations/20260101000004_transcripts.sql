-- Migration: 20260101000004_transcripts.sql
-- Description: Transcript caching and AI transcription job management
-- Depends on: 20260101000000_foundation.sql (auth.users)

BEGIN;

-- ============================================================================
-- TRANSCRIPTS TABLE (Per-User Cache)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transcripts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  provider text,                    -- e.g., 'openai', 'whisper'
  media_url text,                   -- Redacted (no raw tokens/queries)
  media_url_normalized text,        -- Redacted URL without query/hash
  etag text,                        -- Upstream ETag if known
  last_modified text,               -- Upstream Last-Modified if known
  duration_ms integer,              -- Media duration in milliseconds
  transcript_json jsonb NOT NULL,   -- Canonical transcript payload
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  privacy_consent_version text DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transcripts_pkey PRIMARY KEY (user_id, fingerprint)
);

COMMENT ON TABLE public.transcripts IS 'Per-user cached AI transcripts keyed by fingerprint';
COMMENT ON COLUMN public.transcripts.fingerprint IS 'Deterministic hash of media URL + duration';
COMMENT ON COLUMN public.transcripts.expires_at IS 'TTL: transcripts expire after 90 days';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transcripts_media_url_norm ON public.transcripts(media_url_normalized);
CREATE INDEX IF NOT EXISTS idx_transcripts_expires_at ON public.transcripts(expires_at) WHERE expires_at IS NOT NULL;

-- RLS
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transcripts" ON public.transcripts;
CREATE POLICY "Users can view own transcripts"
  ON public.transcripts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own transcripts" ON public.transcripts;
CREATE POLICY "Users can insert own transcripts"
  ON public.transcripts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own transcripts" ON public.transcripts;
CREATE POLICY "Users can update own transcripts"
  ON public.transcripts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own transcripts" ON public.transcripts;
CREATE POLICY "Users can delete own transcripts"
  ON public.transcripts FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TRANSCRIPT_JOBS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transcript_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  provider text,
  media_url text,
  media_url_normalized text,
  media_url_redacted boolean DEFAULT false,
  duration_ms integer,
  status text NOT NULL DEFAULT 'created' 
    CHECK (status IN ('created', 'uploading', 'uploaded', 'processing', 'done', 'error', 'canceled')),
  error text,
  expected_total_chunks integer,
  bytes_received bigint NOT NULL DEFAULT 0,
  language_hint text,
  max_minutes integer,
  processing_started_at timestamptz,
  processing_heartbeat_at timestamptz,
  processing_worker_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.transcript_jobs IS 'AI transcription job state machine';
COMMENT ON COLUMN public.transcript_jobs.status IS 'Job state: created → uploading → uploaded → processing → done/error/canceled';
COMMENT ON COLUMN public.transcript_jobs.fingerprint IS 'Cache key matching transcripts table';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transcript_jobs_user_created ON public.transcript_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transcript_jobs_fingerprint ON public.transcript_jobs(fingerprint);
CREATE INDEX IF NOT EXISTS idx_transcript_jobs_processing_heartbeat ON public.transcript_jobs(status, processing_heartbeat_at);
CREATE INDEX IF NOT EXISTS idx_transcript_jobs_cleanup ON public.transcript_jobs(status, created_at) WHERE status IN ('done', 'error');

-- RLS
ALTER TABLE public.transcript_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transcript jobs" ON public.transcript_jobs;
CREATE POLICY "Users can view own transcript jobs"
  ON public.transcript_jobs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own transcript jobs" ON public.transcript_jobs;
CREATE POLICY "Users can insert own transcript jobs"
  ON public.transcript_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own transcript jobs" ON public.transcript_jobs;
CREATE POLICY "Users can update own transcript jobs"
  ON public.transcript_jobs FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own transcript jobs" ON public.transcript_jobs;
CREATE POLICY "Users can delete own transcript jobs"
  ON public.transcript_jobs FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- TRANSCRIPT_JOB_CHUNKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transcript_job_chunks (
  job_id uuid NOT NULL REFERENCES public.transcript_jobs(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  byte_size integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transcript_job_chunks_pkey PRIMARY KEY (job_id, chunk_index)
);

COMMENT ON TABLE public.transcript_job_chunks IS 'Uploaded chunk tracking for transcript job integrity';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transcript_job_chunks_job ON public.transcript_job_chunks(job_id);

-- RLS
ALTER TABLE public.transcript_job_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transcript job chunks" ON public.transcript_job_chunks;
CREATE POLICY "Users can view own transcript job chunks"
  ON public.transcript_job_chunks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.transcript_jobs
    WHERE transcript_jobs.id = transcript_job_chunks.job_id
      AND transcript_jobs.user_id = auth.uid()
  ));

-- ============================================================================
-- TRANSCRIPT_UPLOAD_WINDOWS TABLE (Rate Limiting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transcript_upload_windows (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transcript_upload_windows_pkey PRIMARY KEY (user_id, window_start)
);

COMMENT ON TABLE public.transcript_upload_windows IS 'Per-user per-minute upload windows for rate limiting';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transcript_upload_windows_window_start ON public.transcript_upload_windows(window_start DESC);

-- RLS
ALTER TABLE public.transcript_upload_windows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transcript upload windows" ON public.transcript_upload_windows;
CREATE POLICY "Users can view own transcript upload windows"
  ON public.transcript_upload_windows FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own transcript upload windows" ON public.transcript_upload_windows;
CREATE POLICY "Users can insert own transcript upload windows"
  ON public.transcript_upload_windows FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own transcript upload windows" ON public.transcript_upload_windows;
CREATE POLICY "Users can update own transcript upload windows"
  ON public.transcript_upload_windows FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Atomic rate limiter for upload bytes
CREATE OR REPLACE FUNCTION public.consume_transcript_upload_bytes(
  p_user_id uuid,
  p_bytes bigint,
  p_limit bigint
) RETURNS TABLE(allowed boolean, remaining bigint, retry_after_seconds integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_window_start timestamptz := date_trunc('minute', now());
  v_total_bytes bigint;
  v_retry_after integer;
BEGIN
  IF p_bytes IS NULL OR p_bytes <= 0 THEN
    RETURN QUERY SELECT true, p_limit, 0;
    RETURN;
  END IF;

  INSERT INTO public.transcript_upload_windows (user_id, window_start, bytes, created_at, updated_at)
  VALUES (p_user_id, v_window_start, p_bytes, now(), now())
  ON CONFLICT (user_id, window_start)
  DO UPDATE SET bytes = public.transcript_upload_windows.bytes + EXCLUDED.bytes, updated_at = now()
  RETURNING bytes INTO v_total_bytes;

  IF p_limit IS NULL OR p_limit <= 0 THEN
    RETURN QUERY SELECT true, NULL::bigint, 0;
    RETURN;
  END IF;

  IF v_total_bytes > p_limit THEN
    v_retry_after := CEIL(EXTRACT(EPOCH FROM (date_trunc('minute', now()) + interval '1 minute' - now())));
    RETURN QUERY SELECT false, GREATEST(p_limit - v_total_bytes, 0), v_retry_after;
  ELSE
    RETURN QUERY SELECT true, p_limit - v_total_bytes, 0;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.consume_transcript_upload_bytes IS 'Atomically tracks transcript upload bytes per user-minute window';

-- Redact completed job URLs (privacy)
CREATE OR REPLACE FUNCTION redact_completed_job_urls()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.transcript_jobs
  SET media_url = '[REDACTED]', media_url_redacted = true
  WHERE status IN ('done', 'error')
    AND media_url_redacted = false
    AND media_url IS NOT NULL
    AND media_url != '[REDACTED]'
    AND created_at < (now() - interval '1 hour');
END;
$$;

COMMENT ON FUNCTION redact_completed_job_urls IS 'Redact media URLs from completed jobs for privacy (run via cron)';

-- Clean expired transcripts
CREATE OR REPLACE FUNCTION clean_expired_transcripts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.transcripts WHERE expires_at < now();
  DELETE FROM public.transcript_jobs WHERE status = 'error' AND created_at < (now() - interval '7 days');
END;
$$;

COMMENT ON FUNCTION clean_expired_transcripts IS 'Delete expired transcripts and old failed jobs (run via cron)';

-- ============================================================================
-- STORAGE POLICIES (for transcript-jobs bucket)
-- ============================================================================

-- Note: Bucket must be created via Supabase Dashboard or API first

DROP POLICY IF EXISTS "read own transcript jobs for 48h" ON storage.objects;
CREATE POLICY "read own transcript jobs for 48h"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'transcript-jobs'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND created_at >= now() - interval '48 hours'
  );

DROP POLICY IF EXISTS "upload own transcript jobs" ON storage.objects;
CREATE POLICY "upload own transcript jobs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'transcript-jobs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
