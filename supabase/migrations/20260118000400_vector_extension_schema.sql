-- Migration: 004_vector_extension_schema.sql
-- Purpose: Fix pgvector extension after moving it from public to extensions schema
-- Date: December 2024
--
-- BACKGROUND:
-- The pgvector extension was moved from public schema to extensions schema using:
--   CREATE SCHEMA IF NOT EXISTS extensions;
--   ALTER EXTENSION vector SET SCHEMA extensions;
--
-- This caused "type public.vector does not exist" errors because:
-- 1. Functions were looking for vector types in the public schema
-- 2. The embedding column was defined with the old public.vector type
--
-- SOLUTION:
-- 1. Update search_path for all roles to include extensions schema
-- 2. Recreate the embedding column with the correct type reference

-- =====================================================
-- STEP 1: Fix search_path for all database roles
-- =====================================================

-- Set the search_path for the current session (immediate effect)
SET search_path = public, extensions;

-- Make the search_path persistent for all Supabase roles:
-- (Run these in Supabase SQL Editor)
ALTER ROLE authenticator SET search_path = public, extensions;
ALTER ROLE anon SET search_path = public, extensions;
ALTER ROLE authenticated SET search_path = public, extensions;
ALTER ROLE service_role SET search_path = public, extensions;

-- =====================================================
-- STEP 2: Recreate embedding column with correct type
-- =====================================================
-- WARNING: This drops existing embeddings! 
-- If you need to preserve them, export first.

-- Drop the old embedding column (if it exists with wrong type)
ALTER TABLE public.notes DROP COLUMN IF EXISTS embedding;

-- Add embedding column with explicit extensions schema reference
ALTER TABLE public.notes ADD COLUMN embedding extensions.vector(1536);

-- =====================================================
-- STEP 3: Recreate the vector similarity index
-- =====================================================

-- Drop old index if exists
DROP INDEX IF EXISTS idx_notes_embedding;

-- Create new index with correct operator class reference
CREATE INDEX idx_notes_embedding ON public.notes 
  USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);

-- =====================================================
-- STEP 4: Recreate match_notes function (if it exists)
-- =====================================================
-- The function needs to use the correct vector type from extensions schema

-- Drop existing function if it exists (may fail if doesn't exist - that's ok)
DROP FUNCTION IF EXISTS match_notes(extensions.vector, integer, uuid);
DROP FUNCTION IF EXISTS public.match_notes(extensions.vector, integer, uuid);

-- Recreate with explicit extensions.vector type
CREATE OR REPLACE FUNCTION match_notes(
  query_embedding extensions.vector(1536),
  match_count integer,
  in_user_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  content_plain text,
  source_url text,
  course_code text,
  note_type text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.title,
    n.content_plain,
    n.source_url,
    n.course_code,
    n.note_type,
    1 - (n.embedding <=> query_embedding) AS similarity
  FROM notes n
  WHERE n.user_id = in_user_id
    AND n.embedding IS NOT NULL
  ORDER BY n.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =====================================================
-- VERIFICATION QUERIES (run to confirm setup)
-- =====================================================

-- Check that vector extension is in extensions schema:
-- SELECT extname, nspname 
-- FROM pg_extension e 
-- JOIN pg_namespace n ON e.extnamespace = n.oid 
-- WHERE extname = 'vector';

-- Check the embedding column type:
-- SELECT column_name, udt_schema, udt_name 
-- FROM information_schema.columns 
-- WHERE table_name = 'notes' AND column_name = 'embedding';
