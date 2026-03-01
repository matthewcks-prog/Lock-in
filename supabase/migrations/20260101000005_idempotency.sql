-- Migration: 20260101000005_idempotency.sql
-- Description: Request deduplication for reliable API operations
-- Depends on: 20260101000000_foundation.sql (auth.users)

-- ============================================================================
-- IDEMPOTENCY_KEYS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  idempotency_key text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
  response jsonb,               -- Cached response payload
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

COMMENT ON TABLE public.idempotency_keys IS 'Request deduplication keys with short TTL and cached responses';
COMMENT ON COLUMN public.idempotency_keys.idempotency_key IS 'Client-provided unique key for request deduplication';
COMMENT ON COLUMN public.idempotency_keys.status IS 'Processing state: in_progress, completed, failed';
COMMENT ON COLUMN public.idempotency_keys.response IS 'Cached response for completed requests';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_user_expires ON public.idempotency_keys(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON public.idempotency_keys(expires_at);

-- RLS
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own idempotency keys" ON public.idempotency_keys;
CREATE POLICY "Users can view own idempotency keys"
  ON public.idempotency_keys FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own idempotency keys" ON public.idempotency_keys;
CREATE POLICY "Users can insert own idempotency keys"
  ON public.idempotency_keys FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own idempotency keys" ON public.idempotency_keys;
CREATE POLICY "Users can update own idempotency keys"
  ON public.idempotency_keys FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- CLEANUP FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION clean_expired_idempotency_keys()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.idempotency_keys WHERE expires_at < now();
END;
$$;

COMMENT ON FUNCTION clean_expired_idempotency_keys IS 'Delete expired idempotency keys (run via cron)';

-- Schedule via pg_cron (run in Supabase Dashboard):
-- SELECT cron.schedule('clean-idempotency-keys', '0 * * * *', 'SELECT clean_expired_idempotency_keys()');
