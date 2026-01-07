# Supabase Read-Only User Setup

This guide explains how to create a read-only database user for MCP Postgres server access.

## Why Read-Only?

The MCP Postgres server should use a read-only connection to prevent accidental data modification. This provides defense-in-depth security even if MCP server configuration has issues.

## Step 1: Create Read-Only User in Supabase

1. **Open Supabase Dashboard**
   - Go to your project: https://supabase.com/dashboard
   - Navigate to **Database → Users**

2. **Create New User** (or use existing)
   - Click "New User" or use SQL Editor
   - Username: `mcp_readonly` (or your preferred name)
   - Password: Generate a strong password (save it securely)

3. **Grant Read-Only Permissions**

   Open **SQL Editor** and run:

   ```sql
   -- Grant usage on public schema
   GRANT USAGE ON SCHEMA public TO mcp_readonly;

   -- Grant SELECT on all existing tables
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_readonly;

   -- Grant SELECT on future tables (so new tables are automatically accessible)
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT SELECT ON TABLES TO mcp_readonly;
   ```

## Step 2: Get Connection String

1. **Find Your Project Reference**
   - Go to **Settings → Database**
   - Look for "Connection string" or "Connection pooling"
   - Your project ref is in the URL: `https://[PROJECT_REF].supabase.co`

2. **Build Connection String**
   ```
   postgresql://mcp_readonly:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres?sslmode=require
   ```

   Replace:
   - `[PASSWORD]` with the password you set for the read-only user
   - `[PROJECT_REF]` with your Supabase project reference

3. **Example:**
   ```
   postgresql://mcp_readonly:MySecurePassword123@uszxfuzauetcchwcgufe.supabase.co:5432/postgres?sslmode=require
   ```

## Step 3: Add to .env.local

1. **Open `.env.local`** in repo root (create if it doesn't exist)

2. **Add connection string:**
   ```bash
   SUPABASE_READONLY_CONNECTION_STRING=postgresql://mcp_readonly:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres?sslmode=require
   ```

3. **Verify `.env.local` is gitignored:**
   - Check `.gitignore` includes `.env.local`
   - Never commit this file

## Step 4: Test Connection

1. **Via psql** (if installed):
   ```bash
   psql "postgresql://mcp_readonly:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres?sslmode=require"
   ```

2. **Via Supabase Client:**
   ```javascript
   const { createClient } = require('@supabase/supabase-js');
   const supabase = createClient(SUPABASE_URL, READONLY_KEY);
   const { data } = await supabase.from('notes').select('count');
   ```

3. **Via MCP:**
   - In Cursor, try: "SELECT COUNT(*) FROM notes"
   - Should return a count (or 0 if no data)

## Security Notes

- ✅ Read-only user can only SELECT (no INSERT, UPDATE, DELETE, DROP, etc.)
- ✅ Scoped to `public` schema only (no `auth` schema access)
- ✅ MCP server configured with `READ_ONLY_MODE: "true"`
- ✅ Connection string stored in `.env.local` (gitignored)
- ⚠️ If you need write access for debugging, use a separate connection string (not in MCP config)

## Troubleshooting

### "Permission denied" errors
- Verify user has `USAGE` on `public` schema
- Check `GRANT SELECT` was run for all tables
- Ensure `ALTER DEFAULT PRIVILEGES` was run for future tables

### Connection fails
- Verify password is correct
- Check project reference in connection string
- Ensure `sslmode=require` is included
- Test connection string manually with `psql` or Supabase client

### Can't see tables
- Verify `GRANT SELECT ON ALL TABLES` was run
- Check you're querying `public` schema (not `auth` or `extensions`)
- List tables: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`

