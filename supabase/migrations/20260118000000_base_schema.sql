-- Migration: 000_base_schema.sql
-- Description: Base Lock-in tables for local Supabase
-- Date: January 2026

-- Ensure extensions schema and pgvector are available
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    CREATE EXTENSION vector WITH SCHEMA extensions;
  ELSE
    IF EXISTS (
      SELECT 1
      FROM pg_extension e
      JOIN pg_namespace n ON e.extnamespace = n.oid
      WHERE e.extname = 'vector' AND n.nspname <> 'extensions'
    ) THEN
      ALTER EXTENSION vector SET SCHEMA extensions;
    END IF;
  END IF;
END $$;

SET search_path = public, extensions;

-- Chats table
CREATE TABLE IF NOT EXISTS public.chats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz DEFAULT now(),
  CONSTRAINT chats_pkey PRIMARY KEY (id),
  CONSTRAINT chats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  mode text,
  source text,
  input_text text,
  output_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id),
  CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Notes table
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  content_json jsonb NOT NULL,
  editor_version text NOT NULL DEFAULT 'lexical_v1',
  content_plain text,
  source_selection text,
  source_url text,
  course_code text,
  note_type text,
  tags text[] DEFAULT '{}'::text[],
  embedding extensions.vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notes_pkey PRIMARY KEY (id),
  CONSTRAINT notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Folders table
CREATE TABLE IF NOT EXISTS public.folders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT folders_pkey PRIMARY KEY (id),
  CONSTRAINT folders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- AI requests table
CREATE TABLE IF NOT EXISTS public.ai_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mode text NOT NULL,
  tokens_in integer,
  tokens_out integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_requests_pkey PRIMARY KEY (id),
  CONSTRAINT ai_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
