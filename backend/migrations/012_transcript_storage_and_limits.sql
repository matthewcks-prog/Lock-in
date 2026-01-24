-- Migration: 012_transcript_storage_and_limits.sql
-- Description: Add durable transcript processing metadata, upload rate tracking, and idempotency storage.
-- Date: February 2026

BEGIN;

-- Extend transcript jobs with processing metadata and persisted options
ALTER TABLE public.transcript_jobs
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_worker_id text,
  ADD COLUMN IF NOT EXISTS language_hint text,
  ADD COLUMN IF NOT EXISTS max_minutes integer;

CREATE INDEX IF NOT EXISTS idx_transcript_jobs_processing_heartbeat
  ON public.transcript_jobs(status, processing_heartbeat_at);

-- Track per-user upload rate windows for transcript chunk uploads
CREATE TABLE IF NOT EXISTS public.transcript_upload_windows (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transcript_upload_windows_pkey PRIMARY KEY (user_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_transcript_upload_windows_window_start
  ON public.transcript_upload_windows(window_start DESC);

ALTER TABLE public.transcript_upload_windows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transcript upload windows" ON public.transcript_upload_windows;
CREATE POLICY "Users can view own transcript upload windows"
  ON public.transcript_upload_windows FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own transcript upload windows" ON public.transcript_upload_windows;
CREATE POLICY "Users can insert own transcript upload windows"
  ON public.transcript_upload_windows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own transcript upload windows" ON public.transcript_upload_windows;
CREATE POLICY "Users can update own transcript upload windows"
  ON public.transcript_upload_windows FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.transcript_upload_windows IS 'Per-user per-minute upload windows for transcript chunk rate limiting.';

-- Atomic rate limiter helper for upload bytes
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
  DO UPDATE SET bytes = public.transcript_upload_windows.bytes + EXCLUDED.bytes,
                updated_at = now()
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

COMMENT ON FUNCTION public.consume_transcript_upload_bytes IS 'Atomically increments transcript upload bytes per user-minute window and returns allowance.';

-- Idempotency key storage for request deduplication
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  idempotency_key text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'in_progress',
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT idempotency_keys_status_check
    CHECK (status IN ('in_progress', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user_expires
  ON public.idempotency_keys(user_id, expires_at);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own idempotency keys" ON public.idempotency_keys;
CREATE POLICY "Users can view own idempotency keys"
  ON public.idempotency_keys FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own idempotency keys" ON public.idempotency_keys;
CREATE POLICY "Users can insert own idempotency keys"
  ON public.idempotency_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own idempotency keys" ON public.idempotency_keys;
CREATE POLICY "Users can update own idempotency keys"
  ON public.idempotency_keys FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.idempotency_keys IS 'Request deduplication keys with short TTL and cached responses.';

-- Storage RLS policies for transcript job chunks (bucket: transcript-jobs)
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
