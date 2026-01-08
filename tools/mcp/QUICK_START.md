# MCP Quick Start Guide

Get MCP servers up and running in 5 minutes.

## Prerequisites

- Node.js and npm installed
- Cursor IDE
- Supabase project access

## Steps

### 1. Install MCP Servers (2 min)

**Windows:**

```powershell
.\tools\mcp\scripts\install-mcp-servers.ps1
```

**Linux:**

```bash
chmod +x tools/mcp/scripts/install-mcp-servers.sh
./tools/mcp/scripts/install-mcp-servers.sh
```

### 2. Configure MCP (2 min)

1. Copy `tools/mcp/config/mcp.json.template` to `.cursor/mcp.json`
2. Update paths in the config file:
   - Windows: Replace `C:\Users\matth\.cursor\worktrees\Lock-in\hmg` with your repo path
   - Linux: Replace `/home/user/path/to/repo` with your repo path

### 3. Set Up Environment (1 min)

1. Copy `tools/mcp/config/env.local.template` to `.env.local` in repo root
2. Follow `SUPABASE_READONLY_SETUP.md` to create read-only user
3. Fill in `SUPABASE_READONLY_CONNECTION_STRING` in `.env.local`

### 4. Verify (30 sec)

1. Open Cursor Settings → MCP Servers
2. Check all servers show "Connected"
3. Run quick test: "List files in core/transcripts/providers"

## Next Steps

- Read `SETUP.md` for detailed instructions
- Run `SMOKE_TESTS.md` to validate functionality
- Review `README.md` for security boundaries

## Troubleshooting

- **Server not connecting?** Check paths in `.cursor/mcp.json`
- **Database fails?** Verify read-only user permissions (see `SUPABASE_READONLY_SETUP.md`)
- **Need help?** See `README.md` troubleshooting section
