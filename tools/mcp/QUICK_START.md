# MCP Quick Start

Get MCP servers running in under 5 minutes.

## Prerequisites

- Node.js 18+ installed
- AI IDE with MCP support (Cursor, Copilot, VS Code, etc.)

## Steps

### 1. Copy Template to IDE Config

**Cursor (recommended):**

```powershell
mkdir .cursor -ErrorAction SilentlyContinue
Copy-Item tools\mcp\config\mcp.json.template .cursor\mcp.json
```

### 2. Edit Config with Your Path

Open `.cursor/mcp.json` and replace `{{REPO_ROOT}}`:

```json
"args": ["-y", "@modelcontextprotocol/server-filesystem", "C:\\Users\\YOUR_NAME\\Lock-in"]
```

### 3. Restart IDE

Close and reopen Cursor.

### 4. Test

Ask the AI: "List files in the core folder"

## Optional: Database Access

To query Supabase directly:

1. Create a read-only database user (see `docs/SUPABASE_READONLY_SETUP.md`)
2. Update the postgres section in your mcp.json with your connection string
3. Restart IDE
4. Test: "Query the notes table"

## Troubleshooting

- **Path not found**: Check your path uses double backslashes on Windows
- **Config not loading**: Ensure valid JSON syntax
- **Database fails**: Check connection string and that Supabase project isn't paused

See `docs/TROUBLESHOOTING.md` for more help.
