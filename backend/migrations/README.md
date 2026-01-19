# Database Migrations (Deprecated Location)

This directory previously held SQL migrations for the Lock-in Supabase database.
The canonical migration source of truth is now `supabase/migrations/` via the
Supabase CLI. Keep these files for historical reference only.

## Migration Overview

| Migration | Purpose | Key Changes |
|-----------|---------|-------------|
| `001_note_assets.sql` | Note file attachments | `note_assets` table, indexes, RLS |
| `002_performance_indexes.sql` | Query performance | Indexes on all tables for scale |
| `003_row_level_security.sql` | Multi-tenant security | RLS policies for data isolation |
| `004_vector_extension_schema.sql` | pgvector fix | Fix search_path after extension move |
| `005_starred_notes.sql` | Starred notes | `is_starred` column + partial index |
| `006_transcripts.sql` | Transcript system | `transcripts`, `transcript_jobs` tables |
| `007_transcripts_hardening.sql` | State machine | Status constraints, chunk tracking |
| `008_transcript_privacy_hardening.sql` | Privacy | 90-day TTL, URL redaction, cleanup |
| `009_feedback.sql` | User feedback | `feedback` table for bug reports |
| `010_chat_assets.sql` | Chat attachments | `chat_message_assets` table |
| `011_chat_assets_cleanup.sql` | Orphan cleanup | Cleanup function for unlinked assets |

## Running Migrations (Current Workflow)

Use the Supabase CLI and the migrations in `supabase/migrations/`. Do not
manually edit schemas in Supabase Dashboard.

### Local (Source of Truth)

```bash
supabase start
supabase db reset
```

### Dev/Prod (Apply migrations)

```bash
supabase db push --project-ref <project-ref>
```

## Writing New Migrations

### Naming Convention

Supabase CLI uses timestamp-based names:

```
YYYYMMDDHHMMSS_descriptive_name.sql
```

### Best Practices

1. **Idempotent Operations**
   - Use `CREATE TABLE IF NOT EXISTS`
   - Use `CREATE INDEX IF NOT EXISTS`
   - Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
   - Use `DROP POLICY IF EXISTS` before `CREATE POLICY`

2. **Include Header Comment**
   ```sql
   -- Migration: NNN_descriptive_name.sql
   -- Description: What this migration does
   -- Date: Month YYYY
   ```

3. **RLS Policies**
   - Always enable RLS on new tables: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
   - Create policies for SELECT, INSERT, UPDATE, DELETE as needed
   - Use `auth.uid() = user_id` pattern for user isolation

4. **Transactions** (for multi-step migrations)
   ```sql
   BEGIN;
   -- ... operations ...
   COMMIT;
   ```

5. **Comments**
   - Add `COMMENT ON TABLE/COLUMN` for documentation
   - Explain non-obvious design decisions

### Example Migration Template

```sql
-- Migration: 012_example_feature.sql
-- Description: Add example feature table and supporting structures
-- Date: January 2026

-- Create table
CREATE TABLE IF NOT EXISTS public.example_feature (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_example_feature_user_id 
  ON public.example_feature(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.example_feature ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own example_feature" ON public.example_feature;
CREATE POLICY "Users can view own example_feature"
  ON public.example_feature FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own example_feature" ON public.example_feature;
CREATE POLICY "Users can insert own example_feature"
  ON public.example_feature FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own example_feature" ON public.example_feature;
CREATE POLICY "Users can delete own example_feature"
  ON public.example_feature FOR DELETE
  USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE public.example_feature IS 'Description of what this table stores';
```

## Verification

After running migrations, verify with:

```sql
-- Check all tables exist
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check policies
SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- Check indexes
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';
```

## Rollback

Currently, migrations are forward-only. For rollbacks:

1. Write a new migration that reverses the changes
2. Test thoroughly in development first
3. Never drop data in production without backup

## Related Documentation

- [DATABASE.md](../../DATABASE.md) - Full schema documentation
- [docs/setup/LOCAL_SUPABASE_SETUP.md](../../docs/setup/LOCAL_SUPABASE_SETUP.md) - Local workflow
- [AZURE_DEPLOYMENT.md](../../docs/setup/AZURE_DEPLOYMENT.md) - Deployment guide
