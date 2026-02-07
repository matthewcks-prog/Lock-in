-- Migration: 20260101000003_chat_message_assets_processing.sql
-- Description: Add processing metadata for chat message assets
-- Depends on: 20260101000002_chat_message_assets.sql

ALTER TABLE public.chat_message_assets
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS processing_error text,
  ADD COLUMN IF NOT EXISTS processed_text text,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_updated_at timestamptz;

-- Set existing assets to ready if they predate processing metadata
UPDATE public.chat_message_assets
SET processing_status = 'ready'
WHERE processing_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_message_assets_processing_status
  ON public.chat_message_assets(processing_status);