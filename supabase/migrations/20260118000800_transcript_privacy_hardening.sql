-- Migration: Transcript Privacy Hardening
-- Date: 2026-01-04
-- Purpose: Enhance privacy for AI transcription feature
-- 
-- Changes:
-- 1. Redact media URLs in transcripts table (PII/session tokens)
-- 2. Add TTL for transcript cache (90 days)
-- 3. Add privacy_consent_version tracking
-- 4. Remove media URLs from transcript_jobs after completion

-- ============================================================================
-- 1. Add TTL and consent tracking to transcripts
-- ============================================================================

-- Add expiry timestamp (90 days from creation)
ALTER TABLE public.transcripts 
ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Add consent version tracking
ALTER TABLE public.transcripts 
ADD COLUMN IF NOT EXISTS privacy_consent_version text DEFAULT 'v1';

-- Set expiry for existing records (90 days from creation)
UPDATE public.transcripts 
SET expires_at = created_at + INTERVAL '90 days'
WHERE expires_at IS NULL;

-- Make expires_at required for new records
ALTER TABLE public.transcripts 
ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '90 days');

-- ============================================================================
-- 2. Add redaction flag to transcript_jobs
-- ============================================================================

-- Track if media URL has been redacted after job completion
ALTER TABLE public.transcript_jobs 
ADD COLUMN IF NOT EXISTS media_url_redacted boolean DEFAULT false;

-- ============================================================================
-- 3. Create function to redact completed job URLs
-- ============================================================================

CREATE OR REPLACE FUNCTION redact_completed_job_urls()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Redact media URLs from completed jobs older than 1 hour
  -- Keep normalized URL for cache lookups
  UPDATE public.transcript_jobs
  SET 
    media_url = '[REDACTED]',
    media_url_redacted = true
  WHERE 
    status IN ('done', 'failed')
    AND media_url_redacted = false
    AND media_url != '[REDACTED]'
    AND created_at < (now() - INTERVAL '1 hour');
END;
$$;

-- ============================================================================
-- 4. Create function to clean expired transcripts
-- ============================================================================

CREATE OR REPLACE FUNCTION clean_expired_transcripts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete expired transcripts
  DELETE FROM public.transcripts
  WHERE expires_at < now();
  
  -- Delete old failed jobs (>7 days)
  DELETE FROM public.transcript_jobs
  WHERE status = 'failed'
    AND created_at < (now() - INTERVAL '7 days');
END;
$$;

-- ============================================================================
-- 5. Create indexes for cleanup queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_transcripts_expires_at 
ON public.transcripts(expires_at) 
WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transcript_jobs_cleanup 
ON public.transcript_jobs(status, created_at) 
WHERE status IN ('done', 'failed');

-- ============================================================================
-- 6. Comments for documentation
-- ============================================================================

COMMENT ON COLUMN public.transcripts.expires_at IS 
'Transcript will be automatically deleted after this date (90 days retention)';

COMMENT ON COLUMN public.transcripts.privacy_consent_version IS 
'Version of privacy consent user agreed to when transcript was created';

COMMENT ON COLUMN public.transcript_jobs.media_url_redacted IS 
'Whether media_url has been redacted after job completion (privacy)';

COMMENT ON FUNCTION redact_completed_job_urls() IS 
'Redacts media URLs from completed transcript jobs (run periodically)';

COMMENT ON FUNCTION clean_expired_transcripts() IS 
'Deletes expired transcripts and old failed jobs (run daily)';

-- ============================================================================
-- 7. Grant permissions
-- ============================================================================

-- Service role needs to run cleanup functions
GRANT EXECUTE ON FUNCTION redact_completed_job_urls() TO service_role;
GRANT EXECUTE ON FUNCTION clean_expired_transcripts() TO service_role;

-- ============================================================================
-- MANUAL STEPS REQUIRED
-- ============================================================================
-- 
-- 1. Set up scheduled job to run cleanup (use Supabase Dashboard or pg_cron):
--    - Run clean_expired_transcripts() daily
--    - Run redact_completed_job_urls() every 6 hours
--
-- 2. Example pg_cron setup (if installed):
--    SELECT cron.schedule('clean-transcripts', '0 3 * * *', 'SELECT clean_expired_transcripts()');
--    SELECT cron.schedule('redact-job-urls', '0 */6 * * *', 'SELECT redact_completed_job_urls()');
--
-- 3. Or use Supabase Edge Functions to call these periodically
--
-- ============================================================================
