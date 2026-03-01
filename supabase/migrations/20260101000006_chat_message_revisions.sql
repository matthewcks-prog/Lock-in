-- Migration: 20260101000006_chat_message_revisions.sql
-- Description: Add revision tracking and canonical timeline support for chat message editing
-- Date: February 2026
--
-- Implements "truncate-on-edit" pattern (see ADR-002):
-- When a user edits message M, M is marked non-canonical and a new revision row
-- is inserted. All messages after M in the chat are marked non-canonical.
-- The LLM is then re-invoked with canonical history up to (and including) the edit.
--
-- New columns on chat_messages:
--   edited_at        — when the message was superseded by a revision
--   revision_of      — points to the original message this row revises
--   is_canonical     — only canonical rows appear in the default timeline
--   status           — per-message delivery status: sending | sent | failed

-- ============================================================================
-- ADD COLUMNS
-- ============================================================================

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS revision_of uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_canonical boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sending', 'sent', 'failed'));

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN public.chat_messages.edited_at
  IS 'Timestamp when this message was superseded by a revision (NULL = current)';
COMMENT ON COLUMN public.chat_messages.revision_of
  IS 'If this row is a revision, points to the original message ID it replaces';
COMMENT ON COLUMN public.chat_messages.is_canonical
  IS 'Whether this message is part of the current canonical timeline';
COMMENT ON COLUMN public.chat_messages.status
  IS 'Delivery status: sending (in-flight), sent (persisted), failed (error)';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Fast canonical timeline retrieval (the default chat view query)
CREATE INDEX IF NOT EXISTS idx_chat_messages_canonical_timeline
  ON public.chat_messages (chat_id, is_canonical, created_at ASC)
  WHERE is_canonical = true;

-- Lookup revisions of a specific message
CREATE INDEX IF NOT EXISTS idx_chat_messages_revision_of
  ON public.chat_messages (revision_of)
  WHERE revision_of IS NOT NULL;
