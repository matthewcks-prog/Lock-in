# Lock-in MCP Server Setup Guide

**Production-Grade Model Context Protocol Server Architecture**

This guide covers the complete setup and usage of Lock-in's MCP server infrastructure, designed with security boundaries, validation, and integration with Lock-in's existing workflows.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Quick Start](#quick-start)
3. [Multi-Server Architecture](#multi-server-architecture)
4. [Setup Instructions](#setup-instructions)
5. [Server Configurations](#server-configurations)
6. [Security Model](#security-model)
7. [Integration with Lock-in](#integration-with-lock-in)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Design Principles

Lock-in's MCP architecture follows the project's core principles:

- **Extension-first, web-app-friendly**: MCP servers provide context for both extension and future web app development
- **Separation of concerns**: Each server has a single responsibility (database, files, build, docs)
- **No Chrome dependencies**: All MCP server logic runs in Node.js context (pure JavaScript/TypeScript)
- **Security boundaries**: Read-only by default, explicit permissions, rate limits

### Why Multi-Server?

**Single concern per server:**

- `lockin-db`: Database queries (read-only, RLS-enforced)
- `lockin-files`: Repository file access (read-only, path-restricted)
- `lockin-build`: Safe build commands (type-check, lint, test only)
- `lockin-docs`: Documentation search (indexed markdown files)

**Benefits:**

- Minimal permissions per server (principle of least privilege)
- Easier auditing (each server has clear boundaries)
- Better rate limiting (per-server limits prevent abuse)
- Extensible (add new servers without touching existing ones)

---

## Quick Start

### Prerequisites

- Windows PowerShell 5.1+
- Node.js 18+
- Lock-in repository cloned locally
- Supabase project with read-only database user (see [SUPABASE_READONLY_SETUP.md](SUPABASE_READONLY_SETUP.md))

### Three-Step Setup

1. **Generate environment configuration:**

   ```powershell
   cd tools\mcp\scripts
   .\setup-env-local.ps1
   ```

   This creates `.env.local` with Supabase connection string and repository paths.

2. **Generate server config files:**

   ```powershell
   .\setup-mcp-configs.ps1
   ```

   This creates JSON configs for each MCP server in `tools\mcp\config\`.

3. **Validate setup:**
   ```powershell
   .\validate-mcp-setup.ps1
   ```
   This checks all configs, paths, and connection strings.

### Verification

After setup, you should have:

- ✅ `tools\mcp\.env.local` - Environment variables
- ✅ `tools\mcp\config\db-server-config.json` - Database server config
- ✅ `tools\mcp\config\files-server-config.json` - Files server config
- ✅ `tools\mcp\config\build-server-config.json` - Build server config
- ✅ `tools\mcp\config\docs-server-config.json` - Docs server config

---

## Multi-Server Architecture

### Server Separation

```
┌─────────────────────────────────────────────────────────────┐
│                        MCP Servers                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  lockin-db   │  │ lockin-files │  │ lockin-build │     │
│  │              │  │              │  │              │     │
│  │ Read-only    │  │ Read-only    │  │ Safe commands│     │
│  │ Supabase     │  │ Repository   │  │ only         │     │
│  │ (RLS)        │  │ files        │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│  ┌──────────────┐                                          │
│  │ lockin-docs  │                                          │
│  │              │                                          │
│  │ Documentation│                                          │
│  │ search       │                                          │
│  └──────────────┘                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    Supabase            Repository           npm scripts
    (RLS user)          (read-only)         (validated)
```

### Server Responsibilities

| Server           | Purpose                                     | Permissions                | Rate Limits            |
| ---------------- | ------------------------------------------- | -------------------------- | ---------------------- |
| **lockin-db**    | Query Supabase tables (notes, chats, etc.)  | Read-only SELECT           | 30/min, max 1000 rows  |
| **lockin-files** | Read repository files (code, configs)       | Read-only, path-restricted | 60/min, max 1MB files  |
| **lockin-build** | Run build commands (type-check, lint, test) | Execute-only (allow list)  | 20/hour, 5min timeout  |
| **lockin-docs**  | Search documentation (AGENTS.md, etc.)      | Read-only, markdown only   | 30/min, max 50 results |

---

## Setup Instructions

### Step 1: Create Supabase Read-Only User

**Why read-only?**

- Prevents accidental data modification via MCP
- Enforces RLS (Row Level Security) policies
- Limits blast radius if credentials leak

**See [SUPABASE_READONLY_SETUP.md](SUPABASE_READONLY_SETUP.md) for detailed steps:**

1. Connect to Supabase SQL Editor
2. Create `readonly_user` role
3. Grant SELECT on specific tables
4. Generate connection string

### Step 2: Run Setup Script

```powershell
cd c:\path\to\Lock-in\tools\mcp\scripts
.\setup-env-local.ps1
```

**What it does:**

1. Validates Lock-in repository structure
2. Extracts Supabase URL from `extension\config.js`
3. Prompts for read-only connection string
4. Generates `.env.local` with all paths (escaped for Windows)

**Interactive prompts:**

```
Enter Supabase connection string:
Default: postgresql://readonly_user:your_password@db.xxxxx.supabase.co:5432/postgres
Connection string: [paste your connection string]
```

### Step 3: Generate Server Configs

```powershell
.\setup-mcp-configs.ps1
```

**What it does:**

1. Creates `tools\mcp\config\` directory
2. Generates 4 JSON config files with security boundaries
3. Sets allowed/denied operations per server
4. Configures rate limits and timeouts

**Output:**

```
✓ Database server config: db-server-config.json
✓ Files server config: files-server-config.json
✓ Build server config: build-server-config.json
✓ Docs server config: docs-server-config.json
```

### Step 4: Validate Setup

```powershell
.\validate-mcp-setup.ps1
```

**What it checks:**

- ✅ `.env.local` exists and has no placeholders
- ✅ Connection string format is valid
- ✅ Server config files exist and are valid JSON
- ✅ Repository paths are accessible
- ✅ Documentation files exist

**Exit codes for CI:**

- `0` - All validations passed
- `1` - Validation failed (errors found)
- `2` - Missing required files

---

## Server Configurations

### Database Server (`lockin-db`)

**Purpose:** Read-only access to Supabase tables for querying notes, chats, transcripts.

**Config file:** `tools\mcp\config\db-server-config.json`

**Security boundaries:**

```json
{
  "security": {
    "readonly": true,
    "rls_enforced": true,
    "max_rows": 1000,
    "timeout_ms": 5000,
    "rate_limit": {
      "requests_per_minute": 30,
      "concurrent_queries": 3
    }
  },
  "allowed_operations": ["SELECT"],
  "allowed_tables": ["notes", "chats", "chat_messages", "note_assets", "transcripts"]
}
```

**What to query:**

- Recent notes for a specific course
- Chat history for context
- Transcript metadata (not full transcripts - those are large!)

**What NOT to query:**

- Full table scans (`SELECT * FROM notes` - use WHERE clauses)
- Unbounded joins (limit result set)
- Sensitive auth tables (not granted SELECT permission)

### Files Server (`lockin-files`)

**Purpose:** Read repository source files for code analysis, type definitions, config review.

**Config file:** `tools\mcp\config\files-server-config.json`

**Security boundaries:**

```json
{
  "security": {
    "readonly": true,
    "max_file_size_bytes": 1048576, // 1MB
    "rate_limit": {
      "requests_per_minute": 60,
      "files_read_per_minute": 100
    }
  },
  "allowed_paths": [
    "core/**/*.ts",
    "api/**/*.ts",
    "extension/**/*.js",
    "docs/**/*.md",
    "package.json",
    "tsconfig.json"
  ],
  "excluded_paths": ["**/*.min.js", "**/node_modules/**", "**/dist/**", "**/.env*"]
}
```

**What to read:**

- Source code for understanding types, interfaces, services
- Configuration files (package.json, tsconfig.json)
- Documentation files (AGENTS.md, CODE_OVERVIEW.md)

**What NOT to read:**

- `.env` files (credentials)
- `node_modules` (too large, vendor code)
- `dist` or `build` outputs (generated, not source)

### Build Server (`lockin-build`)

**Purpose:** Run safe build commands for validation (type-check, lint, test).

**Config file:** `tools\mcp\config\build-server-config.json`

**Security boundaries:**

```json
{
  "security": {
    "allowed_commands_only": true,
    "timeout_ms": 300000, // 5 minutes
    "rate_limit": {
      "commands_per_hour": 20,
      "concurrent_commands": 1
    }
  },
  "allowed_commands": [
    {
      "name": "type-check",
      "command": "npm run type-check",
      "timeout_ms": 60000
    },
    {
      "name": "lint",
      "command": "npm run lint",
      "timeout_ms": 60000
    },
    {
      "name": "test",
      "command": "npm run test",
      "timeout_ms": 120000
    }
  ],
  "denied_commands": ["rm", "del", "format", "clean", "install", "publish"]
}
```

**What to run:**

- `type-check` - Verify TypeScript types
- `lint` - Check code style
- `test` - Run unit/integration tests
- `verify-build` - Full build validation

**What NOT to run:**

- `npm install` (modifies node_modules)
- `npm publish` (deploys to npm)
- `git` commands (modifies repo state)
- Arbitrary shell commands (security risk)

### Docs Server (`lockin-docs`)

**Purpose:** Search and retrieve documentation context (architecture, patterns, conventions).

**Config file:** `tools\mcp\config\docs-server-config.json`

**Security boundaries:**

```json
{
  "security": {
    "readonly": true,
    "max_results": 50,
    "max_context_chars": 5000,
    "rate_limit": {
      "searches_per_minute": 30
    }
  },
  "indexed_paths": [
    "docs/**/*.md",
    "AGENTS.md",
    "CODE_OVERVIEW.md",
    "DATABASE.MD",
    "extension/AGENTS.md"
  ]
}
```

**What to search:**

- Architecture principles (AGENTS.md)
- Current implementation patterns (CODE_OVERVIEW.md)
- Database schema (DATABASE.MD)
- Folder-specific conventions (extension/AGENTS.md)

**What NOT to search:**

- Node modules docs (excluded)
- Binary files (excluded)
- Git history (not indexed)

---

## Security Model

### Read-Only by Default

**All servers are read-only except `lockin-build` (execute-only):**

- Database: No INSERT/UPDATE/DELETE
- Files: No file writes
- Docs: No content modification

**Why?**

- Prevents accidental data corruption
- Limits blast radius of credential leaks
- Forces explicit write operations (via UI or API)

### Explicit Permissions

**Allowed/Denied Lists:**

- Database: Only SELECT on specific tables
- Files: Glob patterns for allowed/excluded paths
- Build: Allow-list of safe commands
- Docs: Indexed markdown files only

**Why?**

- Principle of least privilege
- Clear audit trail (what can each server access?)
- Easier security reviews

### Rate Limits

**Per-server limits prevent abuse:**

- Database: 30 requests/min, max 1000 rows
- Files: 60 requests/min, 100 files/min
- Build: 20 commands/hour
- Docs: 30 searches/min

**Why?**

- Prevent accidental infinite loops
- Protect backend resources
- Enforce efficient query patterns

### Timeouts

**All operations have timeouts:**

- Database queries: 5 seconds
- File reads: 10 seconds (1MB max)
- Build commands: 5 minutes (varies by command)
- Doc searches: 10 seconds

**Why?**

- Prevent hanging requests
- Encourage optimized queries
- Free resources for other operations

---

## Integration with Lock-in

### Workflow Integration

**MCP servers fit into Lock-in's development workflow:**

1. **Development:**
   - AI assistant uses `lockin-files` to read source code
   - AI assistant uses `lockin-docs` to understand architecture
   - Developer reviews AI suggestions, makes changes

2. **Validation:**
   - Run `validate-mcp-setup.ps1` before commit (pre-commit hook)
   - AI assistant uses `lockin-build` to run type-check, lint
   - Developer fixes any issues before pushing

3. **Deployment:**
   - CI runs `validate-mcp-setup.ps1` to check setup
   - Build process uses same npm scripts as `lockin-build`
   - Extension deployed to Chrome Web Store

### AI Assistant Best Practices

**See [USAGE_GUIDELINES.md](USAGE_GUIDELINES.md) for detailed patterns:**

- **DO:** Query specific notes by course code
- **DO:** Read source files for understanding types
- **DO:** Search docs for architecture principles
- **DO:** Run type-check after code changes

- **DON'T:** Query full tables without WHERE clauses
- **DON'T:** Read minified or vendor files
- **DON'T:** Search docs with overly broad queries
- **DON'T:** Run build commands in tight loops

### CI Integration

**Add validation to GitHub Actions:**

```yaml
# .github/workflows/validate.yml
- name: Validate MCP Setup
  run: |
    cd tools\mcp\scripts
    .\validate-mcp-setup.ps1 -CI
  continue-on-error: false # Fail build if validation fails
```

**Exit codes:**

- `0` - Validation passed
- `1` - Validation failed (block merge)

---

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed issue resolution.

### Common Issues

**1. Connection string format invalid**

```
Expected: postgresql://user:pass@host:port/db
Check: Supabase project reference, user/pass correct?
```

**2. Path not accessible**

```
Fix: Ensure .env.local has correct escaped Windows paths
Example: C:\\Users\\user\\Lock-in (double backslashes)
```

**3. Server config missing**

```
Fix: Run setup-mcp-configs.ps1 to generate configs
```

**4. Rate limit exceeded**

```
Fix: Reduce query frequency, batch requests
Check: Server config for current limits
```

### Getting Help

1. Run `validate-mcp-setup.ps1 -Verbose` for detailed diagnostics
2. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for specific errors
3. Review server config JSON files for current limits
4. See Lock-in's [AGENTS.md](../../AGENTS.md) for architecture principles

---

## Next Steps

- **Review:** [USAGE_GUIDELINES.md](USAGE_GUIDELINES.md) - Best practices for AI assistants
- **Setup Database:** [SUPABASE_READONLY_SETUP.md](SUPABASE_READONLY_SETUP.md) - Create read-only user
- **Troubleshoot:** [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues and fixes
- **Extend:** Add new servers (types, tests, perf) following same pattern

---

## Appendix: Environment Variables

**Generated by `setup-env-local.ps1` in `tools\mcp\.env.local`:**

### Database Server

- `LOCKIN_DB_CONNECTION_STRING` - Supabase connection string (read-only user)
- `LOCKIN_DB_MAX_ROWS` - Max rows per query (default: 1000)
- `LOCKIN_DB_TIMEOUT_MS` - Query timeout (default: 5000)
- `LOCKIN_DB_READONLY` - Enforce read-only mode (default: true)

### Files Server

- `LOCKIN_REPO_ROOT` - Repository root path (escaped Windows path)
- `LOCKIN_EXTENSION_PATH` - Extension folder path
- `LOCKIN_CORE_PATH` - Core folder path
- `LOCKIN_API_PATH` - API folder path
- `LOCKIN_DOCS_PATH` - Docs folder path
- `LOCKIN_INTEGRATIONS_PATH` - Integrations folder path

### Build Server

- `LOCKIN_BUILD_TIMEOUT_MS` - Build command timeout (default: 300000 = 5min)
- `LOCKIN_BUILD_MAX_OUTPUT_BYTES` - Max output size (default: 1MB)

### Docs Server

- `LOCKIN_DOCS_INDEX_PATH` - Docs folder for indexing

### Supabase Project

- `LOCKIN_SUPABASE_PROJECT_REF` - Project reference (e.g., `uszxfuzauetcchwcgufe`)
- `LOCKIN_SUPABASE_URL` - Full Supabase URL

---

**Security Note:** Never commit `.env.local` to version control. Add to `.gitignore`.
