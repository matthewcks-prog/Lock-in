# MCP Setup Instructions

Follow these steps to set up MCP servers for the Lock-in project.

## Step 1: Install MCP Servers

MCP servers can be run via `npx` (recommended, no installation needed) or installed globally.

**Windows:**

```powershell
.\tools\mcp\scripts\install-mcp-servers.ps1
```

**Linux/Ubuntu:**

```bash
chmod +x tools/mcp/scripts/install-mcp-servers.sh
./tools/mcp/scripts/install-mcp-servers.sh
```

Or manually check availability:

```bash
npx -y @modelcontextprotocol/server-filesystem --version
npx -y @modelcontextprotocol/server-git --version
# ... etc
```

## Step 2: Create MCP Configuration

1. **Locate Cursor MCP config location:**
   - Check Cursor Settings → MCP Servers for the config path
   - Usually `.cursor/mcp.json` in repo root or `~/.cursor/mcp.json`

2. **Copy template:**
   - Windows: Copy `tools/mcp/config/mcp-config-windows.json`
   - Linux: Copy `tools/mcp/config/mcp-config-linux.json`
   - Or use `tools/mcp/config/mcp.json.template` and update paths

3. **Update paths:**
   - Replace `C:\Users\matth\.cursor\worktrees\Lock-in\hmg` with your actual repo path
   - On Linux, replace `/home/user/path/to/repo` with your actual path

4. **Save as `.cursor/mcp.json`** (or location specified by Cursor)

## Step 3: Set Up Environment Variables

1. **Copy template:**

   ```bash
   cp tools/mcp/config/env.local.template .env.local
   ```

2. **Create Supabase read-only user:**
   - Go to Supabase Dashboard → Database → Users
   - Create a new user (or use existing)
   - Grant read-only permissions:
     ```sql
     GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
     GRANT USAGE ON SCHEMA public TO readonly_user;
     ```

3. **Get connection string:**
   - Format: `postgresql://readonly_user:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres?sslmode=require`
   - Replace `[PASSWORD]` and `[PROJECT_REF]` with your values

4. **Update `.env.local`:**
   - Fill in `SUPABASE_READONLY_CONNECTION_STRING`
   - Update `EXTENSION_PATH` for your OS

## Step 4: Verify Connections

1. **Open Cursor Settings → MCP Servers**
2. **Check each server shows "Connected" status**
3. **Verify no errors in Cursor's MCP log**

## Step 5: Run Smoke Tests

See `tools/mcp/SMOKE_TESTS.md` for 12 test prompts to validate functionality.

## Troubleshooting

### MCP Server Not Connecting

- Check Cursor Settings → MCP Servers for error messages
- Verify paths in `.cursor/mcp.json` are correct for your OS
- Ensure MCP servers are available via `npx` (run install script)

### Database Connection Fails

- Verify `.env.local` has correct `SUPABASE_READONLY_CONNECTION_STRING`
- Check read-only user has proper permissions (SELECT on public schema)
- Test connection string manually with `psql` or Supabase client

### Playwright Extension Loading Fails

- Verify `EXTENSION_PATH` in `.env.local` points to `extension/` directory
- Ensure extension is built (`npm run build`)
- Check Playwright can access the extension directory

## Next Steps

- Read `tools/mcp/README.md` for detailed documentation
- Review security boundaries and agent permission policy
- Run smoke tests to validate setup
