# Database Migrations

## Overview

This directory contains **Supabase database migrations** for Lock-in. Migrations define the database schema evolution over time, ensuring all environments (local, staging, production) stay synchronized.

## Migration Naming Convention

```
<timestamp>_<description>.sql

Example:
20260101000000_foundation.sql
20260101000001_note_assets.sql
```

- **Timestamp**: `YYYYMMDDHHMMSS` format ensures chronological ordering
- **Description**: Snake_case description of what the migration does
- **Extension**: Always `.sql`

## Current Migrations

| File                                     | Description                       | Status    |
| ---------------------------------------- | --------------------------------- | --------- |
| `20260101000000_foundation.sql`          | Core tables (users, notes, chats) | ✅ Active |
| `20260101000001_note_assets.sql`         | Note attachments and assets       | ✅ Active |
| `20260101000002_chat_message_assets.sql` | Chat message assets               | ✅ Active |
| `20260101000003_feedback.sql`            | User feedback system              | ✅ Active |
| `20260101000004_transcripts.sql`         | Transcript storage                | ✅ Active |
| `20260101000005_idempotency.sql`         | Idempotency keys                  | ✅ Active |

## Migration Workflow

### 1. Creating a New Migration

```powershell
# Generate migration file with timestamp
npx supabase migration new <description>

# Example:
npx supabase migration new add_assignments_table
```

This creates: `supabase/migrations/<timestamp>_add_assignments_table.sql`

### 2. Writing Migration SQL

```sql
-- Migration: Add assignments table
-- Description: Store assignment metadata and student submissions

-- Create assignments table
CREATE TABLE IF NOT EXISTS public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ,
    unit_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_assignments_user_id ON public.assignments(user_id);
CREATE INDEX idx_assignments_due_date ON public.assignments(due_date);

-- Enable Row Level Security
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own assignments"
    ON public.assignments FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own assignments"
    ON public.assignments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assignments"
    ON public.assignments FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own assignments"
    ON public.assignments FOR DELETE
    USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER set_assignments_updated_at
    BEFORE UPDATE ON public.assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
```

### 3. Applying Migrations

#### Local Development

```powershell
# Reset database and apply all migrations
npx supabase db reset

# This will:
# 1. Drop existing database
# 2. Apply all migrations in order
# 3. Run seed.sql (if exists)
```

#### Staging/Production

```powershell
# Deploy to specific environment
npx supabase db push --linked

# Verify migration status
npx supabase migration list
```

### 4. Testing Migration

```powershell
# 1. Apply migration
npx supabase db reset

# 2. Verify schema in Studio
# Visit http://127.0.0.1:54323

# 3. Test with backend
cd backend
npm run dev

# 4. Run tests
npm test
```

## Migration Best Practices

### ✅ DO

- **Use transactions** for multi-statement migrations
- **Add indexes** for frequently queried columns
- **Enable RLS** on all tables containing user data
- **Create policies** for SELECT, INSERT, UPDATE, DELETE
- **Use CASCADE** for foreign key deletions
- **Add comments** explaining complex logic
- **Test rollback** scenarios
- **Version control** all migrations

### ❌ DON'T

- **Modify existing migrations** after they've been deployed
- **Delete migrations** unless absolutely necessary
- **Skip timestamps** in migration names
- **Hardcode IDs** or environment-specific values
- **Forget indexes** on foreign keys
- **Leave RLS disabled** on user data tables
- **Mix DDL and DML** in the same migration (use seed.sql for data)

## Migration Patterns

### Adding a Column

```sql
-- Add column with default value (non-breaking)
ALTER TABLE public.notes
ADD COLUMN status TEXT DEFAULT 'draft' NOT NULL;

-- Add index if needed
CREATE INDEX idx_notes_status ON public.notes(status);
```

### Renaming a Column (Breaking)

```sql
-- Step 1: Add new column
ALTER TABLE public.notes
ADD COLUMN new_name TEXT;

-- Step 2: Copy data
UPDATE public.notes SET new_name = old_name;

-- Step 3: Drop old column (in next migration after backend updated)
-- ALTER TABLE public.notes DROP COLUMN old_name;
```

### Adding a Table with Relations

```sql
BEGIN;

-- Parent table
CREATE TABLE public.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL
);

-- Child table with foreign key
CREATE TABLE public.assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE,
    title TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_assignments_unit_id ON public.assignments(unit_id);

-- RLS
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

COMMIT;
```

### Adding a Function

```sql
-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to table
CREATE TRIGGER set_notes_updated_at
    BEFORE UPDATE ON public.notes
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
```

## Troubleshooting

### Migration Failed

```powershell
# Check migration status
npx supabase migration list

# View detailed error
npx supabase db reset --debug

# Common issues:
# - Syntax error: Check SQL syntax
# - Constraint violation: Existing data conflicts with new constraints
# - Missing dependencies: Ensure migrations run in order
```

### Schema Out of Sync

```powershell
# Get current schema diff
npx supabase db diff

# Generate migration from diff
npx supabase db diff -f <migration_name>

# Review and apply
npx supabase db reset
```

### Rollback Migration (Local Only)

```powershell
# Remove migration file
rm supabase/migrations/<timestamp>_<name>.sql

# Reset database
npx supabase db reset
```

> **⚠️ Warning**: Never rollback migrations in staging/production. Write a new migration to revert changes.

## Related Documentation

- [Local Development Setup](../../docs/setup/LOCAL_DEVELOPMENT.md) - Environment setup
- [Database Schema](../../docs/reference/DATABASE.md) - Current schema reference
- [Backend AGENTS](../../backend/AGENTS.md) - Repository patterns for data access
- [Supabase CLI Docs](https://supabase.com/docs/guides/cli) - Official CLI reference

## Schema Management Philosophy

Our migration strategy follows these principles:

1. **Forward-only migrations** - Never modify deployed migrations
2. **Idempotent operations** - Use `IF NOT EXISTS` and `IF EXISTS`
3. **Zero-downtime** - Add before remove, use feature flags
4. **Row-level security** - Enable RLS by default, whitelist access
5. **Auditable** - Every schema change is versioned and reviewable

---

**Questions?** Check [Troubleshooting Guide](../../docs/setup/TROUBLESHOOTING.md) or open an issue.
