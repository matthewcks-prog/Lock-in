# MCP Server Setup for Lock-in

**This is the canonical reference for MCP setup and configuration in the Lock-in project.**

This directory contains documentation and configuration for Model Context Protocol (MCP) servers used in the Lock-in project.

## Overview

MCP servers enable Cursor AI to interact with the codebase, run commands, query the database, and perform browser automation for extension testing. This setup is designed to be production-grade, secure, and cross-platform (Windows + Ubuntu).

## Directory Structure

```
/tools/mcp/
  README.md          → This file (setup documentation)
  /scripts           → Custom MCP helper scripts (if needed)
  /config            → MCP server configs (backup, templates)
```

## MCP Servers Configured

### MUST (Core Productivity)

1. **Filesystem** (`@modelcontextprotocol/server-filesystem`)
   - Fast code navigation and file operations
   - Scoped to repo root directory only

2. **Git** (`@modelcontextprotocol/server-git`)
   - Git history, blame, diff, branch comparison
   - Read-only by default

3. **Shell** (`@modelcontextprotocol/server-powershell` / `@modelcontextprotocol/server-bash`)
   - Run build scripts, tests, backend server
   - Windows: PowerShell, Linux: Bash
   - Sandboxed to repo directory

4. **Playwright** (`@modelcontextprotocol/server-playwright`)
   - Extension debugging and E2E testing
   - Only allows whitelisted domains

5. **Fetch** (`@modelcontextprotocol/server-fetch`)
   - Test backend API endpoints
   - Only allows localhost:3000 and Supabase URLs

6. **Postgres** (`@modelcontextprotocol/server-postgres`)
   - Query Supabase PostgreSQL
   - **Dev environment only** - No MCP access to production
   - `dev_admin` user with full CRUD for development
   - See [docs/SUPABASE_DEV_ADMIN_SETUP.md](docs/SUPABASE_DEV_ADMIN_SETUP.md) for setup

7. **Context7** (`@modelcontextprotocol/server-context7`)
   - Up-to-date, version-specific documentation for libraries/frameworks
   - Provides latest React, TypeScript, Supabase, Vite, Lexical docs
   - Helps AI generate accurate code with current APIs
   - No configuration needed - automatically used when AI mentions libraries

## Configuration

### MCP Config Location

The main MCP configuration location depends on your IDE:

| IDE                | Config Location                                            |
| ------------------ | ---------------------------------------------------------- |
| **VS Code**        | `.vscode/mcp.json` (copy from `.vscode/mcp.json.template`) |
| **Cursor**         | `.cursor/mcp.json`                                         |
| **GitHub Copilot** | `.github/copilot/mcp.json`                                 |

### Environment Variables

Create `tools/mcp/.env.local` (gitignored) with:

```bash
# Development Supabase (full CRUD for MCP - dev only)
# Create dev_admin user: see docs/SUPABASE_DEV_ADMIN_SETUP.md
LOCKIN_DB_CONNECTION_STRING_DEV=postgresql://dev_admin:[PASSWORD]@db.uszxfuzauetcchwcgufe.supabase.co:5432/postgres
LOCKIN_DB_MAX_ROWS=1000
LOCKIN_DB_TIMEOUT_MS=5000
LOCKIN_DB_READONLY=false

# Development Supabase project
LOCKIN_SUPABASE_PROJECT_REF_DEV=uszxfuzauetcchwcgufe
LOCKIN_SUPABASE_URL_DEV=https://uszxfuzauetcchwcgufe.supabase.co

# Repository paths
LOCKIN_REPO_ROOT=C:/Users/matth/Lock-in
```

**Important:**

- **Never** add production credentials to MCP configuration
- MCP is for development environment only
- Production database access goes through backend API

## Security Boundaries

### Filesystem

- ✅ Scope: Repo root directory only
- ✅ Block: Access to `node_modules/`, `.git/` internals
- ✅ Allow: All source files, configs, docs

### Git

- ✅ Read-only by default (log, show, diff, blame)
- ⚠️ Write operations require explicit user confirmation
- ❌ Block: `git push --force`, `git reset --hard`

### Shell

- ✅ Working directory: Repo root (or subdirectories)
- ✅ Allowed: `npm`, `node`, `npx`, `cd`, `git` (read-only)
- ❌ Blocked: `rm -rf`, `del /s /q`, `git push --force`
- ⚠️ Production commands require confirmation

### Playwright

- ✅ Allowed domains: `localhost`, `learning.monash.edu`, `edstem.org`, `panopto.com`, `echo360.org`
- ❌ Block: External domains, file:// URLs
- ✅ Timeout: 30s per page load

### Fetch

- ✅ Allowed origins: `http://localhost:3000`, `https://*.supabase.co`
- ❌ Block: External APIs, production URLs
- ✅ Rate limit: 10 requests/minute

### Postgres

- ✅ Read-only mode: SELECT only
- ✅ Schema scope: `public` only (no `auth`, `extensions` schemas)
- ❌ Block: DROP, TRUNCATE, DELETE, UPDATE, CREATE, ALTER
- ⚠️ Write operations require explicit confirmation

## Agent Permission Policy

### Automatic (No Confirmation)

- ✅ Read operations (filesystem read, git log, database SELECT)
- ✅ Build/test commands (`npm run build`, `npm test`)
- ✅ Navigation/search operations
- ✅ Health checks (`GET /health`)

### Require Confirmation

- ⚠️ Write operations (git commit, git push, database INSERT/UPDATE/DELETE)
- ⚠️ Production deployments (`npm publish`, `git push origin main`)
- ⚠️ Destructive commands (`git reset --hard`, `rm -rf`)
- ⚠️ Extension installation/removal
- ⚠️ Environment variable changes (`.env` files)

### Never Allow

- ❌ Modify production database (use read-only connection)
- ❌ Push to main/master without PR
- ❌ Delete `node_modules/` or build artifacts
- ❌ Run commands outside repo directory
- ❌ Access files outside repo (except system temp dirs for Playwright)

## Setup Instructions

See **[SETUP.md](docs/SETUP.md)** for detailed step-by-step setup instructions.

Quick start:

1. **Install MCP servers** - Run `tools/mcp/scripts/install-mcp-servers.ps1` (Windows) or `install-mcp-servers.sh` (Linux)
2. **Create `.cursor/mcp.json`** - Copy template from `tools/mcp/config/mcp.json.template` and update paths
3. **Set up `.env.local`** - Copy `tools/mcp/config/env.local.template` to `.env.local` and fill in values
4. **Create Supabase read-only user** - See **[SUPABASE_READONLY_SETUP.md](docs/SUPABASE_READONLY_SETUP.md)** for detailed instructions
5. **Verify connections** in Cursor Settings → MCP Servers
6. **Run smoke tests** - See **[SMOKE_TESTS.md](docs/SMOKE_TESTS.md)** for 12 test prompts

## Adding New MCP Servers

1. **Evaluate need**: Does it support the core loop (Capture → Understand → Distil → Organise → Act)?
2. **Security review**: What permissions does it need? Can we scope it?
3. **Add to config**: Update `.cursor/mcp.json` with new server entry
4. **Test**: Run smoke test to verify connection
5. **Document**: Update this README

## Supabase Read-Only User Setup

See **[SUPABASE_READONLY_SETUP.md](docs/SUPABASE_READONLY_SETUP.md)** for detailed instructions on creating a read-only database user for MCP access.

## Troubleshooting

### MCP Server Not Connecting

- Check Cursor Settings → MCP Servers for error messages
- Verify paths in `.cursor/mcp.json` are correct for your OS
- Ensure MCP servers are installed (via npm or Cursor registry)

### Database Connection Fails

- Verify `.env.local` has correct `SUPABASE_READONLY_CONNECTION_STRING`
- Check read-only user has proper permissions
- Test connection string manually with `psql` or Supabase client

### Playwright Extension Loading Fails

- Verify `EXTENSION_PATH` in `.env.local` points to `extension/` directory
- Ensure extension is built (`npm run build`)
- Check Playwright can access the extension directory

## References

- [MCP Specification](https://modelcontextprotocol.io/)
- [Cursor MCP Documentation](https://docs.cursor.com/mcp)
- Main setup plan: See project root plan file
