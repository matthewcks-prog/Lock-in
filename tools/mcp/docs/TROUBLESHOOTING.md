# MCP Troubleshooting Guide

Common issues and solutions for Lock-in's MCP server setup.

---

## Setup Issues

### Issue: "Repository structure validation failed"

**Symptom:**

```
✗ Missing required path: core
✗ Missing required path: api
```

**Cause:**

- Running setup script from wrong directory
- Incomplete Lock-in repository clone

**Fix:**

1. Check current directory:

   ```powershell
   Get-Location
   # Should be: C:\path\to\Lock-in\tools\mcp\scripts
   ```

2. Navigate to correct directory:

   ```powershell
   cd c:\path\to\Lock-in\tools\mcp\scripts
   ```

3. Verify repository structure:

   ```powershell
   Get-ChildItem c:\path\to\Lock-in
   # Should see: core, api, extension, docs folders
   ```

4. If folders missing, re-clone repository

---

### Issue: "Could not extract SUPABASE_URL from config.js"

**Symptom:**

```
✗ Could not extract SUPABASE_URL from config.js
```

**Cause:**

- `extension/config.js` is missing or malformed
- Supabase URL format changed

**Fix:**

1. Check if `extension/config.js` exists:

   ```powershell
   Test-Path c:\path\to\Lock-in\extension\config.js
   ```

2. If missing, restore from git:

   ```powershell
   git checkout -- extension/config.js
   ```

3. Verify content:

   ```powershell
   Get-Content extension\config.js | Select-String "SUPABASE_URL"
   ```

4. Expected format:
   ```javascript
   SUPABASE_URL: "https://xxxxx.supabase.co",
   ```

---

### Issue: "Connection string format invalid"

**Symptom:**

```
⚠ Connection string format may be invalid. Expected: postgresql://user:pass@host:port/db
```

**Cause:**

- Missing parts in connection string
- Wrong format (not PostgreSQL connection string)

**Fix:**

1. Verify connection string format:

   ```
   postgresql://readonly_user:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
   ```

2. Check each part:
   - Protocol: `postgresql://`
   - User: `readonly_user` (or your custom user)
   - Password: `PASSWORD` (no special escaping needed)
   - Host: `db.PROJECT_REF.supabase.co` (replace PROJECT_REF)
   - Port: `5432` (default PostgreSQL port)
   - Database: `postgres` (default Supabase database)

3. Example valid connection string:

   ```
   postgresql://readonly_user:my_p@ssw0rd_123@db.uszxfuzauetcchwcgufe.supabase.co:5432/postgres
   ```

4. Get correct connection string from Supabase:
   - Go to Supabase dashboard → Settings → Database
   - Copy connection string
   - Replace user/password with your read-only user

---

### Issue: ".env.local contains placeholder"

**Symptom:**

```
⚠ .env.local contains placeholder: your_password
```

**Cause:**

- Used default connection string without replacing password

**Fix:**

1. Edit `.env.local`:

   ```powershell
   notepad tools\mcp\.env.local
   ```

2. Find `LOCKIN_DB_CONNECTION_STRING`

3. Replace `your_password` with actual password:

   ```
   Before: postgresql://readonly_user:your_password@db...
   After:  postgresql://readonly_user:actual_secure_password@db...
   ```

4. Save and re-run validation:
   ```powershell
   .\validate-mcp-setup.ps1
   ```

---

### Issue: "Path not accessible"

**Symptom:**

```
✗ LOCKIN_CORE_PATH path not accessible: C:\\Users\\user\\Lock-in\\core
```

**Cause:**

- Path doesn't exist (typo or wrong repo location)
- Path escaping issue (Windows backslashes)

**Fix:**

1. Verify path exists:

   ```powershell
   Test-Path "C:\Users\user\Lock-in\core"
   ```

2. If path wrong, re-run setup:

   ```powershell
   .\setup-env-local.ps1 -Force
   ```

3. If path escaping issue, edit `.env.local`:
   ```
   Correct: C:\\Users\\user\\Lock-in\\core (double backslashes)
   Wrong:   C:\Users\user\Lock-in\core (single backslashes)
   ```

---

## Database Issues

### Issue: "Permission denied for table X"

**Symptom:**

```
ERROR: permission denied for table notes
```

**Cause:**

- Read-only user doesn't have SELECT permission on that table

**Fix:**

1. Connect to Supabase SQL Editor

2. Grant SELECT permission:

   ```sql
   GRANT SELECT ON public.notes TO readonly_user;
   ```

3. Verify permissions:

   ```sql
   SELECT table_name, privilege_type
   FROM information_schema.table_privileges
   WHERE grantee = 'readonly_user';
   ```

4. See [SUPABASE_READONLY_SETUP.md](SUPABASE_READONLY_SETUP.md) for full setup

---

### Issue: "Max rows exceeded"

**Symptom:**

```
ERROR: Query returned more than 1000 rows
```

**Cause:**

- Query result set too large (server limit: 1000 rows)

**Fix:**

1. Add LIMIT clause:

   ```sql
   SELECT * FROM notes LIMIT 100;
   ```

2. Add WHERE clause to reduce results:

   ```sql
   SELECT * FROM notes
   WHERE course_code = 'FIT3170'
   LIMIT 100;
   ```

3. If you need more rows, paginate:
   ```sql
   -- Page 1
   SELECT * FROM notes ORDER BY created_at DESC LIMIT 100 OFFSET 0;
   -- Page 2
   SELECT * FROM notes ORDER BY created_at DESC LIMIT 100 OFFSET 100;
   ```

---

### Issue: "Query timeout"

**Symptom:**

```
ERROR: Query exceeded 5 second timeout
```

**Cause:**

- Query too complex (large joins, aggregations)
- Missing database indexes

**Fix:**

1. Simplify query:

   ```sql
   -- Instead of complex JOIN
   SELECT * FROM notes n
   JOIN chats c ON n.user_id = c.user_id;

   -- Do two separate queries
   SELECT * FROM notes WHERE user_id = 'xxx';
   SELECT * FROM chats WHERE user_id = 'xxx';
   ```

2. Add indexes (if you have admin access):

   ```sql
   CREATE INDEX idx_notes_user_id ON notes(user_id);
   CREATE INDEX idx_notes_course_code ON notes(course_code);
   ```

3. Use EXPLAIN to see query plan:
   ```sql
   EXPLAIN SELECT * FROM notes WHERE user_id = 'xxx';
   ```

---

### Issue: "Password authentication failed"

**Symptom:**

```
ERROR: password authentication failed for user "readonly_user"
```

**Cause:**

- Wrong password in connection string
- User doesn't exist

**Fix:**

1. Verify user exists:

   ```sql
   -- Run in Supabase SQL Editor (as admin)
   SELECT rolname FROM pg_roles WHERE rolname = 'readonly_user';
   ```

2. If user missing, create it:

   ```sql
   CREATE ROLE readonly_user WITH LOGIN PASSWORD 'your_secure_password';
   ```

3. Reset password:

   ```sql
   ALTER ROLE readonly_user WITH PASSWORD 'new_secure_password';
   ```

4. Update `.env.local` with new password

5. Re-run validation:
   ```powershell
   .\validate-mcp-setup.ps1
   ```

---

### Issue: "Connection refused"

**Symptom:**

```
ERROR: could not connect to server: Connection refused
```

**Cause:**

- Supabase project paused (free tier auto-pauses)
- Wrong host in connection string
- Firewall blocking connection

**Fix:**

1. Check Supabase project status:
   - Go to Supabase dashboard
   - If paused, click "Resume project"

2. Verify host in connection string:

   ```powershell
   Get-Content tools\mcp\.env.local | Select-String "CONNECTION_STRING"
   ```

3. Expected host format:

   ```
   db.PROJECT_REF.supabase.co
   ```

4. Check firewall:
   ```powershell
   Test-NetConnection -ComputerName db.uszxfuzauetcchwcgufe.supabase.co -Port 5432
   ```

---

## File Access Issues

### Issue: "Path not allowed"

**Symptom:**

```
ERROR: Path not allowed: node_modules/some-package/index.js
```

**Cause:**

- Tried to read excluded path (server config denies it)

**Fix:**

1. Check allowed paths in server config:

   ```powershell
   Get-Content tools\mcp\config\files-server-config.json | Select-String "allowed_paths"
   ```

2. Only read from allowed paths:

   ```
   ✅ core/**/*.ts
   ✅ api/**/*.ts
   ✅ docs/**/*.md
   ❌ node_modules/** (excluded)
   ❌ dist/** (excluded)
   ```

3. If you need a specific path, edit `files-server-config.json`:
   ```json
   "allowed_paths": [
     "core/**/*.ts",
     "your/new/path/**/*.ts"
   ]
   ```

---

### Issue: "File too large"

**Symptom:**

```
ERROR: File exceeds max size (1MB): transcript-full.json (5MB)
```

**Cause:**

- File larger than 1MB limit

**Fix:**

1. Read metadata instead of full content:

   ```
   Instead of: transcript-full.json (5MB)
   Read:       transcript-metadata.json (10KB)
   ```

2. Use database for large content:

   ```sql
   SELECT id, video_url, status FROM transcripts
   WHERE id = 'xxx';
   ```

3. If you must read large file, increase limit in config:
   ```json
   "security": {
     "max_file_size_bytes": 5242880  // 5MB
   }
   ```

---

### Issue: "Binary file rejected"

**Symptom:**

```
ERROR: Binary file rejected: icon.png
```

**Cause:**

- Tried to read image, PDF, or other binary file

**Fix:**

1. Only read text files:

   ```
   ✅ .ts, .js, .tsx, .jsx (source code)
   ✅ .md, .txt (documentation)
   ✅ .json (configuration)
   ❌ .png, .jpg (images)
   ❌ .pdf (documents)
   ❌ .zip (archives)
   ```

2. For image metadata, read manifest.json:
   ```json
   {
     "icons": {
       "16": "icons/icon-16.png",
       "48": "icons/icon-48.png"
     }
   }
   ```

---

## Build Issues

### Issue: "Command not allowed"

**Symptom:**

```
ERROR: Command not allowed: npm install
```

**Cause:**

- Tried to run command not in allow-list

**Fix:**

1. Check allowed commands:

   ```powershell
   Get-Content tools\mcp\config\build-server-config.json | Select-String "allowed_commands"
   ```

2. Use only allowed commands:

   ```
   ✅ npm run type-check
   ✅ npm run lint
   ✅ npm run test
   ✅ npm run build
   ❌ npm install (modifies node_modules)
   ❌ npm publish (deploys to npm)
   ```

3. If you need a new command, add to config:
   ```json
   "allowed_commands": [
     {
       "name": "your-command",
       "command": "npm run your-command",
       "timeout_ms": 60000
     }
   ]
   ```

---

### Issue: "Command timeout"

**Symptom:**

```
ERROR: Command exceeded timeout (60 seconds): npm run type-check
```

**Cause:**

- Command took longer than configured timeout
- Build is slow (large codebase, slow machine)

**Fix:**

1. Check timeout in config:

   ```json
   {
     "name": "type-check",
     "timeout_ms": 60000 // 60 seconds
   }
   ```

2. Increase timeout if needed:

   ```json
   {
     "name": "type-check",
     "timeout_ms": 120000 // 120 seconds
   }
   ```

3. Optimize build:
   - Use incremental compilation (`tsc --incremental`)
   - Split into smaller tasks
   - Cache build outputs

---

### Issue: "Rate limit exceeded"

**Symptom:**

```
ERROR: Rate limit exceeded: 20 commands per hour
```

**Cause:**

- Too many build commands in short time

**Fix:**

1. Check rate limit:

   ```json
   "rate_limit": {
     "commands_per_hour": 20
   }
   ```

2. Reduce build frequency:

   ```
   Instead of: Run build after each file change
   Do:         Batch changes, run build once
   ```

3. Wait for rate limit to reset (1 hour)

4. If you need higher limit, edit config:
   ```json
   "rate_limit": {
     "commands_per_hour": 50
   }
   ```

---

## Validation Issues

### Issue: "validate-mcp-setup.ps1 fails"

**Symptom:**

```
✗ Validation failed with 3 error(s)
```

**Cause:**

- Missing files, invalid configs, or inaccessible paths

**Fix:**

1. Run validation with verbose output:

   ```powershell
   .\validate-mcp-setup.ps1 -Verbose
   ```

2. Check each error:

   ```
   ✗ .env.local not found
   → Run: .\setup-env-local.ps1

   ✗ Config file not found: db-server-config.json
   → Run: .\setup-mcp-configs.ps1

   ✗ LOCKIN_CORE_PATH path not accessible
   → Re-run: .\setup-env-local.ps1 -Force
   ```

3. Fix each issue and re-run validation

---

### Issue: "Validation passed with warnings"

**Symptom:**

```
⚠ Validation passed with 2 warning(s)
```

**Cause:**

- Non-critical issues (e.g., missing optional docs)

**Fix:**

1. Check warnings:

   ```
   ⚠ Documentation missing: TROUBLESHOOTING.md
   ```

2. Warnings don't block setup (exit code 0)

3. Fix warnings if desired:
   ```powershell
   # Create missing doc
   New-Item -ItemType File -Path tools\mcp\docs\TROUBLESHOOTING.md
   ```

---

## General Troubleshooting

### Enable Verbose Logging

Add `-Verbose` flag to any script:

```powershell
.\setup-env-local.ps1 -Verbose
.\setup-mcp-configs.ps1 -Verbose
.\validate-mcp-setup.ps1 -Verbose
```

### Check Script Execution Policy

If scripts won't run:

```powershell
# Check current policy
Get-ExecutionPolicy

# Set to allow scripts (run as Admin)
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Force Overwrite

Re-run setup with `-Force` to overwrite existing files:

```powershell
.\setup-env-local.ps1 -Force
```

### Check File Paths

Verify all paths use Windows backslashes:

```powershell
# Check .env.local paths
Get-Content tools\mcp\.env.local | Select-String "PATH"

# Should see double backslashes: C:\\Users\\user\\Lock-in
```

### Test Connection String Manually

If database connection fails, test with psql:

```bash
psql "postgresql://readonly_user:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres"
```

If psql connects but MCP doesn't, issue is with MCP config (not connection string).

---

## Getting Help

**1. Check documentation:**

- [README.md](../README.md) - Setup guide
- [USAGE_GUIDELINES.md](./USAGE_GUIDELINES.md) - Best practices
- [SUPABASE_READONLY_SETUP.md](SUPABASE_READONLY_SETUP.md) - Database setup

**2. Run validation:**

```powershell
.\validate-mcp-setup.ps1 -Verbose
```

**3. Check server configs:**

```powershell
Get-Content tools\mcp\config\*.json
```

**4. Review Lock-in docs:**

- [AGENTS.md](../../../AGENTS.md) - Architecture principles
- [STATUS.md](../../../docs/tracking/STATUS.md) - Current status

**5. Check Supabase status:**

- https://status.supabase.com/

---

## Common Error Messages

| Error                                    | Cause                       | Fix                                        |
| ---------------------------------------- | --------------------------- | ------------------------------------------ |
| "Repository structure validation failed" | Wrong directory             | Navigate to `tools/mcp/scripts`            |
| "Connection string format invalid"       | Malformed connection string | Use `postgresql://user:pass@host:port/db`  |
| ".env.local contains placeholder"        | Didn't replace password     | Edit `.env.local`, replace `your_password` |
| "Permission denied for table X"          | Missing SELECT grant        | Run `GRANT SELECT ON X TO readonly_user`   |
| "Max rows exceeded"                      | Query returned > 1000 rows  | Add LIMIT and WHERE clauses                |
| "Query timeout"                          | Query took > 5 seconds      | Simplify query, add indexes                |
| "Path not allowed"                       | Reading excluded path       | Read from allowed paths only               |
| "File too large"                         | File > 1MB                  | Read metadata or increase limit            |
| "Command not allowed"                    | Running denied command      | Use allowed commands only                  |
| "Rate limit exceeded"                    | Too many requests           | Reduce frequency, batch requests           |

---

## Exit Codes

Scripts use standard exit codes for CI integration:

| Exit Code | Meaning           | Action                |
| --------- | ----------------- | --------------------- |
| 0         | Success           | Continue              |
| 1         | Validation failed | Fix errors and re-run |
| 2         | Missing files     | Run setup scripts     |

**Check last exit code:**

```powershell
$LASTEXITCODE
```

---

## Next Steps

- **Setup:** [README.md](../README.md) - Full setup guide
- **Usage:** [USAGE_GUIDELINES.md](./USAGE_GUIDELINES.md) - Best practices
- **Database:** [SUPABASE_READONLY_SETUP.md](SUPABASE_READONLY_SETUP.md) - Database setup
- **Lock-in:** [../../AGENTS.md](../../../AGENTS.md) - Architecture principles
