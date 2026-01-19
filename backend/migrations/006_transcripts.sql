-- 006_transcripts.sql
-- Transcript jobs and transcript cache tables

CREATE TABLE IF NOT EXISTS public.transcripts (
  fingerprint text PRIMARY KEY,
  provider text,
  media_url text,
  media_url_normalized text,
  etag text,
  last_modified text,
  duration_ms integer,
  transcript_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transcript_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  fingerprint text NOT NULL,
  provider text,
  media_url text,
  media_url_normalized text,
  duration_ms integer,
  status text NOT NULL DEFAULT 'created',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transcript_jobs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_transcript_jobs_user_created
  ON public.transcript_jobs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transcript_jobs_fingerprint
  ON public.transcript_jobs(fingerprint);

CREATE INDEX IF NOT EXISTS idx_transcripts_media_url_norm
  ON public.transcripts(media_url_normalized);

ALTER TABLE public.transcript_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transcript jobs"
  ON public.transcript_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transcript jobs"
  ON public.transcript_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transcript jobs"
  ON public.transcript_jobs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transcript jobs"
  ON public.transcript_jobs FOR DELETE
  USING (auth.uid() = user_id);
