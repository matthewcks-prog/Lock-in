# Supabase MCP Admin User Setup (Development Environment ONLY)

**⚠️ CRITICAL: This guide is for DEVELOPMENT ENVIRONMENT ONLY**

This creates a `dev_admin` database user with full CRUD access (CREATE, READ, UPDATE, DELETE) for MCP servers in **local development**. This user should **NEVER** be created in production.

---

## Security Model

| Environment     | MCP User    | Permissions                             | Use Case                               |
| --------------- | ----------- | --------------------------------------- | -------------------------------------- |
| **Development** | `dev_admin` | Full CRUD (INSERT/UPDATE/DELETE/SELECT) | Local testing, AI-assisted development |
| **Production**  | None        | No MCP access to prod database          | Security boundary                      |

**Why full CRUD for dev?**

- AI assistants can help create test data, seed databases, clean up test records
- Faster iteration: Create notes/chats/transcripts without manual SQL or API calls
- Safe environment: Dev database contains no real user data
- Auto-approve safe operations (B): INSERT notes/chats auto-approved, DELETE requires confirmation

**Why no MCP in production?**

- Production database contains real user data
- All writes must go through backend API (audit trail, validation, rate limiting)
- Prevents accidental data deletion or corruption
- If MCP credentials leak, blast radius is zero (no prod access)

---

## Prerequisites

- **Development Supabase project**: `uszxfuzauetcchwcgufe` (NOT production)
- Access to Supabase SQL Editor
- Confirmed this is NOT the production database

---

## Step 1: Verify Environment

**Before proceeding, confirm you're in the DEVELOPMENT project:**

1. Go to Supabase dashboard: https://supabase.com/dashboard
2. Check project reference: Should be `uszxfuzauetcchwcgufe` (dev)
3. If you see `vtuflatvllpldohhimao` → **STOP, this is production!**

---

## Step 2: Create Dev Admin Role

**Run this SQL in the DEV Supabase SQL Editor:**

```sql
-- =============================================================================
-- DEV ENVIRONMENT ONLY: Create MCP admin user with full CRUD permissions
-- =============================================================================

-- Create dev_admin role with login
CREATE ROLE dev_admin WITH LOGIN PASSWORD 'your_secure_dev_password_here';

-- Grant CONNECT privilege
GRANT CONNECT ON DATABASE postgres TO dev_admin;

-- Grant USAGE on public schema
GRANT USAGE ON SCHEMA public TO dev_admin;

-- Grant ALL privileges on all Lock-in tables (full CRUD)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO dev_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chats TO dev_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO dev_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_assets TO dev_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_message_assets TO dev_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transcripts TO dev_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transcript_jobs TO dev_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback TO dev_admin;

-- Grant USAGE on sequences (needed for INSERT to auto-increment IDs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dev_admin;

-- Set Row Level Security behavior
-- Note: RLS policies still apply, but dev_admin operates in authenticated context
ALTER ROLE dev_admin SET row_security = on;

-- Grant execute on functions (if any)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO dev_admin;

-- IMPORTANT: Do NOT grant access to auth schema (even in dev)
-- IMPORTANT: Do NOT grant TRUNCATE, DROP, or ALTER permissions
```

**What this does:**

- Creates `dev_admin` user with full CRUD permissions on Lock-in tables
- Grants INSERT/UPDATE/DELETE (in addition to SELECT)
- Grants sequence usage (auto-incrementing IDs work)
- RLS still enforced (user-scoped data access)
- Does NOT grant DDL permissions (cannot drop tables, alter schema)
- Does NOT grant auth table access (user credentials still protected)

**Password Security:**

- Replace `your_secure_dev_password_here` with a strong password
- Store in `tools/mcp/.env.local` only (gitignored)
- Different password from production (dev password can be shared with team)

---

## Step 3: Verify Permissions

**Check granted privileges:**

```sql
-- Check dev_admin privileges
SELECT
  table_schema,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'dev_admin'
  AND table_schema = 'public'
ORDER BY table_name, privilege_type;
```

**Expected output:**

```
table_schema | table_name           | privilege_type
-------------|----------------------|---------------
public       | chats                | DELETE
public       | chats                | INSERT
public       | chats                | SELECT
public       | chats                | UPDATE
public       | chat_messages        | DELETE
public       | chat_messages        | INSERT
public       | chat_messages        | SELECT
public       | chat_messages        | UPDATE
public       | notes                | DELETE
public       | notes                | INSERT
public       | notes                | SELECT
public       | notes                | UPDATE
... (similar for other tables)
```

**Verify NO dangerous permissions:**

```sql
-- Should return ZERO rows (dev_admin cannot drop tables or alter schema)
SELECT
  table_schema,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'dev_admin'
  AND privilege_type IN ('DROP', 'TRUNCATE', 'REFERENCES', 'TRIGGER');
```

---

## Step 4: Test Connection

**Generate connection string:**

```
postgresql://dev_admin:YOUR_PASSWORD@db.uszxfuzauetcchwcgufe.supabase.co:5432/postgres
```

**Replace:**

- `YOUR_PASSWORD` → The password you set in Step 2
- `uszxfuzauetcchwcgufe` → Your dev project reference

**Test with psql (optional):**

```bash
psql "postgresql://dev_admin:YOUR_PASSWORD@db.uszxfuzauetcchwcgufe.supabase.co:5432/postgres"
```

**Test SELECT:**

```sql
SELECT id, title, created_at FROM notes LIMIT 5;
```

**Test INSERT:**

```sql
INSERT INTO notes (user_id, title, content, course_code, week_number)
VALUES ('00000000-0000-0000-0000-000000000000', 'MCP Test Note', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Created by MCP"}]}]}', 'TEST101', 1)
RETURNING id, title;
```

**Test DELETE:**

```sql
DELETE FROM notes WHERE title = 'MCP Test Note';
```

---

## Step 5: Configure MCP Environment Variables

**Edit `tools/mcp/.env.local`:**

```bash
# Development Supabase Admin (Full CRUD for MCP)
LOCKIN_DB_CONNECTION_STRING_DEV=postgresql://dev_admin:YOUR_PASSWORD@db.uszxfuzauetcchwcgufe.supabase.co:5432/postgres
LOCKIN_DB_MAX_ROWS=1000
LOCKIN_DB_TIMEOUT_MS=5000
LOCKIN_DB_READONLY=false  # CRITICAL: Set to false for write access

# Supabase Project Reference (Dev)
LOCKIN_SUPABASE_PROJECT_REF=uszxfuzauetcchwcgufe
LOCKIN_SUPABASE_URL=https://uszxfuzauetcchwcgufe.supabase.co
```

**Important:**

- `LOCKIN_DB_READONLY=false` enables write operations
- Connection string uses `dev_admin` user (not `readonly_user`)
- Only for dev environment (no prod connection string)

---

## Step 6: Update VS Code MCP Configuration

**Edit `.vscode/mcp.json`:**

```json
{
  "mcpServers": {
    "lockin-db-dev": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://dev_admin:YOUR_PASSWORD@db.uszxfuzauetcchwcgufe.supabase.co:5432/postgres"
      ],
      "description": "Lock-in dev database (full CRUD)",
      "autoApprove": ["query"]
    }
  }
}
```

**Auto-Approval Policy:**

- `query` auto-approved: SELECT statements execute without confirmation
- INSERT/UPDATE/DELETE: Require user confirmation (safety measure)
- DROP/TRUNCATE: Blocked entirely (not in dev_admin permissions)

---

## Step 7: Restart VS Code

**MCP servers load on IDE startup:**

1. Close VS Code completely
2. Reopen workspace
3. VS Code MCP should detect `lockin-db-dev` server
4. Test with AI: "Query the notes table and show me the 5 most recent notes"

---

## Security Checklist

- [ ] Confirmed this is the **dev** Supabase project (`uszxfuzauetcchwcgufe`)
- [ ] Did NOT create `dev_admin` in production (`vtuflatvllpldohhimao`)
- [ ] Used strong password (20+ characters, random)
- [ ] Connection string stored in `.env.local` (gitignored)
- [ ] `LOCKIN_DB_READONLY=false` set in `.env.local`
- [ ] Tested SELECT, INSERT, DELETE operations
- [ ] Verified NO access to auth schema
- [ ] VS Code MCP configuration updated
- [ ] Documented password in secure password manager

---

## Troubleshooting

### Permission Denied on INSERT

**Symptom:** `ERROR: permission denied for table notes`

**Solution:**

```sql
-- Re-grant permissions
GRANT INSERT, UPDATE, DELETE ON public.notes TO dev_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dev_admin;
```

### RLS Policy Blocks Query

**Symptom:** `SELECT` returns 0 rows, but data exists

**Solution:** RLS policies require `user_id` match. Test with a valid user ID:

```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'notes';

-- Query with specific user (replace with real user_id from auth.users)
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "YOUR_USER_ID"}';
SELECT * FROM notes;
```

### Cannot Connect from MCP

**Symptom:** `connection refused` or `password authentication failed`

**Check:**

1. Connection string format: `postgresql://dev_admin:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres`
2. Password has no special characters that need URL encoding
3. Supabase project is NOT paused (reactivate in dashboard)
4. Firewall/network allows port 5432 outbound

---

## Comparison: Read-Only vs Dev Admin

| Feature               | `readonly_user` | `dev_admin`               |
| --------------------- | --------------- | ------------------------- |
| **SELECT**            | ✅ Yes          | ✅ Yes                    |
| **INSERT**            | ❌ No           | ✅ Yes                    |
| **UPDATE**            | ❌ No           | ✅ Yes                    |
| **DELETE**            | ❌ No           | ✅ Yes                    |
| **RLS Enforced**      | ✅ Yes          | ✅ Yes                    |
| **Auth Table Access** | ❌ No           | ❌ No                     |
| **DROP/TRUNCATE**     | ❌ No           | ❌ No                     |
| **Environment**       | Dev (optional)  | Dev only                  |
| **Use Case**          | Query-only MCP  | Full CRUD MCP for testing |

---

## Related Documentation

- [tools/mcp/README.md](../README.md) - MCP server setup and configuration
- [tools/mcp/docs/SUPABASE_READONLY_SETUP.md](./SUPABASE_READONLY_SETUP.md) - Read-only user setup
- [DATABASE.md](../../../docs/reference/DATABASE.md) - Lock-in database schema and RLS policies
- [docs/architecture/ARCHITECTURE.md](/docs/architecture/ARCHITECTURE.md) - Environment separation strategy

---

## Next Steps

1. ✅ Dev admin user created with full CRUD
2. ⏭️ Configure MCP environment variables in `tools/mcp/.env.local`
3. ⏭️ Update VS Code MCP configuration in `.vscode/mcp.json`
4. ⏭️ Test MCP queries with AI assistant
5. ⏭️ Set up local Supabase CLI for database migrations (optional)

---

**Remember: This user is for DEVELOPMENT ONLY. Never create `dev_admin` in production.**
