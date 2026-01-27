# Supabase Read-Only User Setup

This guide walks through creating a read-only database user for Lock-in's MCP server. This enforces security boundaries: MCP can query data but cannot modify it.

---

## Why Read-Only?

**Security Benefits:**

- **Prevents accidental writes:** AI assistants can't INSERT/UPDATE/DELETE data
- **Enforces RLS:** Row Level Security policies still apply (users only see their own data)
- **Limits blast radius:** If credentials leak, attacker can only read (not modify)
- **Audit trail:** All writes go through normal API (logged and tracked)

**Use Case:**

- AI assistants need to query notes, chats, transcripts for context
- MCP server should NOT modify database (writes go through backend API)
- Read-only user + RLS = secure, minimal-privilege access

---

## Prerequisites

- Supabase project created (you should have one already for Lock-in)
- Access to Supabase SQL Editor
- Database connection details from project settings

---

## Step 1: Connect to SQL Editor

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your Lock-in project
3. Click **SQL Editor** in left sidebar
4. Click **New query** button

---

## Step 2: Create Read-Only Role

**Run this SQL to create a `readonly_user` role:**

```sql
-- Create read-only role
CREATE ROLE readonly_user WITH LOGIN PASSWORD 'your_secure_password_here';

-- Grant CONNECT privilege
GRANT CONNECT ON DATABASE postgres TO readonly_user;

-- Grant USAGE on public schema
GRANT USAGE ON SCHEMA public TO readonly_user;

-- Grant SELECT on specific tables (Lock-in tables only)
GRANT SELECT ON public.notes TO readonly_user;
GRANT SELECT ON public.chats TO readonly_user;
GRANT SELECT ON public.chat_messages TO readonly_user;
GRANT SELECT ON public.note_assets TO readonly_user;
GRANT SELECT ON public.transcripts TO readonly_user;

-- IMPORTANT: Do NOT grant INSERT, UPDATE, DELETE
-- IMPORTANT: Do NOT grant SELECT on auth tables (supabase.auth.users)
```

**What this does:**

- Creates a user named `readonly_user` with a password
- Grants LOGIN (can connect to database)
- Grants USAGE on `public` schema (can see tables)
- Grants SELECT on Lock-in tables (can query, but not modify)
- Does NOT grant write permissions (INSERT/UPDATE/DELETE)

**Security Notes:**

- Replace `your_secure_password_here` with a strong password (20+ chars, random)
- Do NOT use your Supabase admin password
- Do NOT grant SELECT on `supabase.auth.users` (contains sensitive user data)

---

## Step 3: Verify Role Permissions

**Check what the role can do:**

```sql
-- Check granted privileges
SELECT
  table_schema,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'readonly_user'
ORDER BY table_name;
```

**Expected output:**

```
table_schema | table_name     | privilege_type
-------------|----------------|----------------
public       | notes          | SELECT
public       | chats          | SELECT
public       | chat_messages  | SELECT
public       | note_assets    | SELECT
public       | transcripts    | SELECT
```

**If you see INSERT, UPDATE, or DELETE, something is wrong. Revoke those permissions:**

```sql
REVOKE INSERT, UPDATE, DELETE ON public.notes FROM readonly_user;
REVOKE INSERT, UPDATE, DELETE ON public.chats FROM readonly_user;
REVOKE INSERT, UPDATE, DELETE ON public.chat_messages FROM readonly_user;
REVOKE INSERT, UPDATE, DELETE ON public.note_assets FROM readonly_user;
REVOKE INSERT, UPDATE, DELETE ON public.transcripts FROM readonly_user;
```

---

## Step 4: Enable Row Level Security (RLS)

**Ensure RLS is enabled on all tables:**

```sql
-- Enable RLS on Lock-in tables
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

-- Check RLS status
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('notes', 'chats', 'chat_messages', 'note_assets', 'transcripts');
```

**Expected output:**

```
schemaname | tablename      | rowsecurity
-----------|----------------|-------------
public     | notes          | t
public     | chats          | t
public     | chat_messages  | t
public     | note_assets    | t
public     | transcripts    | t
```

**RLS Policies:**

- Lock-in should already have RLS policies set up
- These policies restrict users to their own data (filtered by `user_id`)
- The `readonly_user` will inherit these policies (can only see data user has access to)

**If RLS policies are missing, create them:**

```sql
-- Example: Users can only SELECT their own notes
CREATE POLICY "Users can view their own notes"
ON public.notes
FOR SELECT
USING (auth.uid() = user_id);

-- Example: Users can only SELECT their own chats
CREATE POLICY "Users can view their own chats"
ON public.chats
FOR SELECT
USING (auth.uid() = user_id);
```

See [DATABASE.md](../../../docs/reference/DATABASE.md) for full RLS policy definitions.

---

## Step 5: Generate Connection String

**Format:**

```
postgresql://readonly_user:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
```

**Replace placeholders:**

- `PASSWORD` - The password you set for `readonly_user`
- `PROJECT_REF` - Your Supabase project reference (e.g., `uszxfuzauetcchwcgufe`)

**Find your project reference:**

1. Go to Supabase dashboard
2. Click **Settings** (gear icon)
3. Click **Database** tab
4. Look for **Connection string** section
5. Copy the host: `db.XXXXX.supabase.co` (XXXXX is your project ref)

**Example:**

```
postgresql://readonly_user:my_secure_p@ssw0rd@db.uszxfuzauetcchwcgufe.supabase.co:5432/postgres
```

**Security Note:**

- This connection string contains a password
- Store in `.env.local` (NOT committed to git)
- Do NOT share in Slack, email, or public docs

---

## Step 6: Test Connection

**Test from Lock-in setup script:**

```powershell
cd c:\path\to\Lock-in\tools\mcp\scripts
.\setup-env-local.ps1
```

When prompted, paste your connection string.

**Test with psql (optional):**

If you have `psql` installed:

```bash
psql "postgresql://readonly_user:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"
```

**Run a test query:**

```sql
SELECT COUNT(*) FROM notes;
```

**Try a write (should fail):**

```sql
INSERT INTO notes (title, content, user_id) VALUES ('Test', 'Test', 'test-user-id');
-- ERROR: permission denied for table notes
```

**Success!** If the write fails, your read-only user is configured correctly.

---

## Step 7: Update Lock-in MCP Setup

**Run the setup scripts:**

```powershell
cd c:\path\to\Lock-in\tools\mcp\scripts

# Step 1: Configure environment (paste connection string when prompted)
.\setup-env-local.ps1

# Step 2: Generate server configs
.\setup-mcp-configs.ps1

# Step 3: Validate setup
.\validate-mcp-setup.ps1
```

**Check `.env.local`:**

```powershell
Get-Content ..\\.env.local | Select-String "CONNECTION_STRING"
```

Should show:

```
LOCKIN_DB_CONNECTION_STRING=postgresql://readonly_user:...@db.xxxxx.supabase.co:5432/postgres
```

---

## Step 8: Security Checklist

Before using the read-only user in production, verify:

- ✅ Role has SELECT permission only (no INSERT/UPDATE/DELETE)
- ✅ Role cannot access auth tables (supabase.auth.users)
- ✅ RLS is enabled on all Lock-in tables
- ✅ RLS policies restrict users to their own data
- ✅ Connection string is in `.env.local` (not committed to git)
- ✅ Password is strong (20+ chars, random)
- ✅ Test query succeeded
- ✅ Test write failed (permission denied)

---

## Troubleshooting

### "Permission denied for table X"

**Cause:** Role doesn't have SELECT permission on that table.

**Fix:** Grant SELECT permission:

```sql
GRANT SELECT ON public.X TO readonly_user;
```

### "Role 'readonly_user' already exists"

**Cause:** You already ran the CREATE ROLE command.

**Fix:** Either:

1. Drop and recreate:
   ```sql
   DROP ROLE readonly_user;
   -- Then run CREATE ROLE again
   ```
2. Or just grant permissions to existing role:
   ```sql
   GRANT SELECT ON public.notes TO readonly_user;
   ```

### "Connection refused" or "Connection timeout"

**Cause:** Firewall or wrong host.

**Fix:**

1. Check project reference in connection string
2. Verify database is not paused (Supabase free tier auto-pauses)
3. Check Supabase status page: https://status.supabase.com/

### "Password authentication failed"

**Cause:** Wrong password in connection string.

**Fix:**

1. Reset password:
   ```sql
   ALTER ROLE readonly_user WITH PASSWORD 'new_secure_password';
   ```
2. Update `.env.local` with new password
3. Re-run `.\validate-mcp-setup.ps1`

### RLS blocks all queries

**Cause:** RLS policies require `auth.uid()`, but direct database connections don't set this.

**Fix:** This is expected for MCP use case. The read-only user will only see data if:

1. RLS policies allow SELECT without `auth.uid()` check, OR
2. You query via Supabase API (which sets `auth.uid()`), OR
3. You create a policy specifically for `readonly_user`:

```sql
-- Example: Allow readonly_user to see all notes (if needed)
CREATE POLICY "Readonly user can view all notes"
ON public.notes
FOR SELECT
TO readonly_user
USING (true);
```

**Warning:** This bypasses user isolation. Only do this if MCP needs cross-user data access.

---

## Alternative: Service Role Key

**If you don't want to create a custom role, you can use Supabase's service role key:**

**Pros:**

- No SQL setup required
- Bypasses RLS (can see all data)

**Cons:**

- Full database access (can write, delete, drop tables)
- Much larger blast radius if key leaks
- Not recommended for MCP (too much power)

**How to use:**

1. Get service role key from Supabase dashboard → Settings → API
2. Use with Supabase client (not raw SQL connection)
3. Set `LOCKIN_DB_SERVICE_ROLE_KEY` in `.env.local`

**We recommend the custom read-only role approach for better security.**

---

## Next Steps

- **Configure MCP:** Run `setup-env-local.ps1` with your connection string
- **Test Queries:** Use MCP `lockin-db` server to query notes, chats
- **Review Limits:** Check `db-server-config.json` for rate limits (30/min)
- **Monitor Usage:** Check Supabase dashboard for query patterns

---

## Further Reading

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL GRANT Documentation](https://www.postgresql.org/docs/current/sql-grant.html)
- [Lock-in DATABASE.md](../../../docs/reference/DATABASE.md) - Schema and RLS policies
- [MCP README.md](../README.md) - Full MCP setup guide
