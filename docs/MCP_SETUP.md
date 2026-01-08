# MCP (Model Context Protocol) Setup

This project uses MCP servers to enable AI assistants (like Cursor AI) to interact with the codebase, query the database, run build commands, and perform browser automation for extension testing.

## Primary Documentation

**For complete MCP setup instructions, see: [`tools/mcp/README.md`](../tools/mcp/README.md)**

The `tools/mcp/` directory contains:
- **Setup guides**: Step-by-step instructions for configuring MCP servers
- **Configuration files**: Templates and examples for MCP server configs
- **Usage guidelines**: Best practices for AI assistants using MCP servers
- **Troubleshooting**: Common issues and solutions

## Quick Start

1. **Install MCP servers**: Run `tools/mcp/scripts/install-mcp-servers.ps1` (Windows) or `install-mcp-servers.sh` (Linux)
2. **Configure MCP**: Copy `tools/mcp/config/mcp.json.template` to `.cursor/mcp.json` and update paths
3. **Set up environment**: Create `.env.local` with Supabase connection string (see `tools/mcp/SUPABASE_READONLY_SETUP.md`)
4. **Verify**: Check Cursor Settings → MCP Servers for connection status

## MCP Servers Configured

- **Filesystem**: Repository file access (read-only, path-restricted)
- **Git**: Git history, blame, diff (read-only)
- **Shell**: Build commands (PowerShell/Bash, sandboxed)
- **Playwright**: Extension E2E testing (whitelisted domains)
- **Fetch**: Backend API testing (localhost + Supabase)
- **Postgres**: Database queries (read-only, RLS-enforced)
- **Context7**: Up-to-date documentation for React, TypeScript, Supabase, Vite, Lexical (automatic, no config needed)

For detailed information about each server, security boundaries, and usage patterns, see [`tools/mcp/README.md`](../tools/mcp/README.md).
