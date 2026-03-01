# Local Development Setup Guide

## Overview

This guide helps you set up **Lock-in** for local development using **local Supabase**. This approach ensures:

- ✅ **No conflicts** between developers writing to the same database
- ✅ **Fast iteration** without network latency
- ✅ **Isolated testing** without affecting staging/production
- ✅ **Cost efficiency** (no cloud resources during development)
- ✅ **Offline development** capability

## Architecture: Environment Isolation

```
┌─────────────────────────────────────────────────────────────┐
│                    ENVIRONMENT STRATEGY                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Development (Local)        Staging              Production │
│  ───────────────────        ───────              ────────── │
│  • Local Supabase           • Cloud Supabase     • Cloud    │
│  • 127.0.0.1:54321          • Dev project        • Prod     │
│  • JWT secret validation    • JWT via SDK        • JWT SDK  │
│  • No external dependencies • Shared with team   • Isolated │
│  • Fast feedback loop       • Pre-prod testing   • Stable   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Docker Desktop** (for containerized backend)
- **Supabase CLI** (automatically installed via npx)

## Step 1: Start Local Supabase

```powershell
# From project root
npx supabase start
```

**What this does:**

- Starts PostgreSQL database on port 54322
- Starts Supabase Studio on port 54323
- Starts API server on port 54321
- Creates default JWT secrets for authentication

**Expected output:**

```
Started supabase local development setup.

╭──────────────────────────────────────╮
│ 🔧 Development Tools                 │
├─────────┬────────────────────────────┤
│ Studio  │ http://127.0.0.1:54323     │
╰─────────┴────────────────────────────╯

╭──────────────────────────────────────────────────────╮
│ 🌐 APIs                                              │
├────────────────┬─────────────────────────────────────┤
│ Project URL    │ http://127.0.0.1:54321              │
╰────────────────┴─────────────────────────────────────╯
```

> **💡 Tip:** Visit http://127.0.0.1:54323 to access Supabase Studio UI

## Step 2: Configure Backend Environment

### Get Supabase Keys (CRITICAL)

After starting Supabase, get the **JWT format** keys:

```powershell
npx supabase status -o env
```

**Expected output:**

```
ANON_KEY="eyJhbGciOiJFUzI1NiIs..."  # JWT format (3 parts with dots)
SERVICE_ROLE_KEY="eyJhbGciOiJFUzI1NiIs..."  # JWT format
...
```

> **⚠️ CRITICAL:** Use the `SERVICE_ROLE_KEY` and `ANON_KEY` (JWT format starting with `eyJ...`), NOT the short format keys (`sb_secret_...` or `sb_publishable_...`). The Supabase JS client and PostgREST require JWT format tokens.

### Create `.env.local` (Root Directory)

Create a `.env.local` file in the **project root** (not backend/) with the JWT keys:

```bash
# Copy values from 'npx supabase status -o env' output
# IMPORTANT: Use JWT format keys, NOT short format (sb_secret_/sb_publishable_)

VITE_SUPABASE_URL_DEV=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY_DEV=<ANON_KEY from above>
VITE_BACKEND_URL_DEV=http://localhost:3000

SUPABASE_URL_DEV=http://127.0.0.1:54321
SUPABASE_ANON_KEY_DEV=<ANON_KEY from above>
SUPABASE_SERVICE_ROLE_KEY_DEV=<SERVICE_ROLE_KEY from above>

# AI Provider (at least one required)
OPENAI_API_KEY=<your-openai-key>
OPENAI_MODEL=gpt-4o-mini
```

> **⚠️ Important:** JWT keys may change when Supabase restarts. If you get JWT errors, re-copy keys from `npx supabase status -o env`.

## Step 3: Run Migrations

Apply database schema to local Supabase:

```powershell
npx supabase db reset
```

This will:

- Drop existing database (if any)
- Apply all migrations from `supabase/migrations/`
- Run seed data from `supabase/seed.sql`

## Step 4: Start the Backend

### Option A: Run with npm (Hot-reload)

```powershell
cd backend
npm run dev
```

**Advantages:**

- Faster startup
- Direct access to logs
- Easier debugging

### Option B: Run with Docker Compose (Production-like)

```powershell
# From project root - IMPORTANT: use --env-file flag
docker compose --env-file .env.local up
```

**Advantages:**

- Tests containerized environment
- Matches Azure deployment setup
- Validates Dockerfile configuration

**How it works:**

- Backend container connects to Supabase on **host machine**
- Uses `host.docker.internal` DNS name (Docker networking)
- Mounts backend folder for hot-reload
- Preserves node_modules in container

> **⚠️ Important:** Always use `--env-file .env.local` to load secrets properly. Without this flag, Docker Compose won't have access to your Supabase keys.

## Step 5: Verify Setup

Test the backend is running:

```powershell
curl http://localhost:3000/health
```

**Expected response:**

```json
{
  "status": "healthy",
  "timestamp": "2026-02-01T12:00:00.000Z",
  "uptime": 10.5,
  "database": "connected"
}
```

## Architecture: JWT Validation Strategy

The backend automatically detects local vs cloud Supabase and uses the appropriate JWT validation method:

```javascript
// Pseudocode: backend/middleware/authMiddleware.js

if (SUPABASE_IS_LOCAL) {
  // Local Supabase: Manual JWT validation
  jwt.verify(token, SUPABASE_JWT_SECRET, { algorithms: ['ES256', 'HS256'] });
} else {
  // Cloud Supabase: SDK validation
  supabase.auth.getUser(token);
}
```

**Why this approach?**

- **Local Supabase** uses a simple JWT secret (`HS256` or `ES256`)
- **Cloud Supabase** uses asymmetric keys with key rotation
- Automatic detection via URL pattern (`127.0.0.1` → local)

## Troubleshooting

### Error: "Expected 3 parts in JWT; got 1" (PGRST301)

**Cause:** Using short format Supabase keys (`sb_secret_...` or `sb_publishable_...`) instead of JWT format

**Solution:**

1. Run `npx supabase status -o env`
2. Copy the `SERVICE_ROLE_KEY` and `ANON_KEY` values (they start with `eyJ...`)
3. Update your `.env.local` with the JWT format keys
4. If using Docker: `docker compose --env-file .env.local down && docker compose --env-file .env.local up`
5. If running directly: restart the backend

### Error: "JWT validation failed"

**Cause:** Backend trying to use cloud JWT validation with local Supabase

**Solution:**

1. Verify `SUPABASE_URL_DEV` is `http://127.0.0.1:54321`
2. Verify `SUPABASE_JWT_SECRET` is set
3. Restart backend

### Error: "Connection refused" when using Docker

**Cause:** Backend container can't reach local Supabase

**Solution:**

1. Ensure local Supabase is running: `npx supabase status`
2. Verify `extra_hosts` in docker-compose.yml includes `host.docker.internal`
3. Check firewall isn't blocking Docker → Host communication

### Error: "Unable to resolve nonexistent table"

**Cause:** Migrations not applied to local database

**Solution:**

```powershell
npx supabase db reset
```

### Error: "Port 3000 already in use"

**Cause:** Another process (local `npm run dev`) is using port 3000

**Solution:**

```powershell
# Stop local dev server
# THEN start Docker
docker compose up
```

## Best Practices

### 1. **Environment Separation**

| Environment    | Supabase Instance    | Purpose                | Who Uses              |
| -------------- | -------------------- | ---------------------- | --------------------- |
| **Local**      | 127.0.0.1:54321      | Development, testing   | Individual developers |
| **Staging**    | Cloud (Dev project)  | Pre-production testing | Team                  |
| **Production** | Cloud (Prod project) | Live users             | End users             |

### 2. **Git Workflow**

```bash
# .gitignore already excludes:
backend/.env        # Developer-specific config
backend/.env.local  # Local Supabase config

# Safe to commit:
backend/.env.local.example  # Local Supabase template
backend/.env.example        # Cloud Supabase template
```

### 3. **Migration Workflow**

```powershell
# 1. Create migration
npx supabase migration new add_notes_table

# 2. Write SQL in supabase/migrations/<timestamp>_add_notes_table.sql

# 3. Apply locally
npx supabase db reset

# 4. Test changes

# 5. Commit migration file (version controlled)
git add supabase/migrations/
git commit -m "feat: add notes table"
```

### 4. **Testing Against Cloud Supabase**

When ready to test against staging:

```powershell
# Update .env
SUPABASE_URL_DEV=https://your-staging-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY_DEV=<your-staging-key>
# Remove SUPABASE_JWT_SECRET (SDK will handle validation)

# Restart backend
npm run dev
```

## Clean Architecture Principles (SOLID)

### Single Responsibility Principle (SRP)

- **Config layer** (`backend/config/index.js`): Environment-aware configuration ONLY
- **Auth middleware** (`backend/middleware/authMiddleware.js`): JWT validation ONLY
- **Supabase client** (`backend/db/supabaseClient.js`): Client instantiation ONLY

### Open/Closed Principle (OCP)

- **Extensible:** Add new auth methods (API keys, OAuth) without modifying existing JWT logic
- **Closed for modification:** JWT validation logic unchanged when adding new auth types

### Dependency Inversion Principle (DIP)

- **Abstraction:** Auth middleware depends on `config` interface, not concrete `process.env`
- **Testability:** Can mock config in tests without changing middleware code

## Scalability & Reliability

### Scalability Strategy

1. **Local Development (Current)**
   - Single developer instance
   - No load concerns
   - Fast iteration

2. **Staging (Future)**
   - Shared team instance
   - Connection pooling via Supavisor
   - Rate limiting enabled

3. **Production (Future)**
   - Multi-region read replicas
   - Connection pooling (required)
   - Caching layer (Redis)
   - CDN for static assets

### Reliability Features

**Already Implemented:**

- ✅ Health check endpoint (`/health`)
- ✅ Centralized error handling
- ✅ Retry logic for transient failures
- ✅ Graceful degradation (AI providers fallback)
- ✅ Request rate limiting
- ✅ JWT validation with fallback

**Future Enhancements:**

- 🔄 Circuit breakers for external services
- 🔄 Distributed tracing (OpenTelemetry)
- 🔄 Prometheus metrics
- 🔄 Blue-green deployments

## Next Steps

1. **Read** [`docs/reference/DATABASE.md`](../reference/DATABASE.md) for schema details
2. **Read** [`supabase/migrations/README.md`](../../supabase/migrations/README.md) for migration workflow
3. **Review** [`backend/AGENTS.md`](../../backend/AGENTS.md) for backend architecture rules
4. **Follow** [`CONTRIBUTING_AI.md`](../../CONTRIBUTING_AI.md) for contribution guidelines
5. **Explore** Supabase Studio at http://127.0.0.1:54323

## Quick Reference

### Supabase Commands

| Command                         | Description                          |
| ------------------------------- | ------------------------------------ |
| `npx supabase start`            | Start local Supabase                 |
| `npx supabase stop`             | Stop local Supabase (preserves data) |
| `npx supabase stop --no-backup` | Stop and wipe all local data         |
| `npx supabase status`           | Show connection details and keys     |
| `npx supabase status -o env`    | Output keys in env format (for .env) |

### Database Commands

| Command                           | Description                                   |
| --------------------------------- | --------------------------------------------- |
| `npx supabase db reset`           | Reset database + apply all migrations         |
| `npx supabase db push`            | Push migrations to remote project             |
| `npx supabase db pull`            | Pull schema from remote (generates migration) |
| `npx supabase db diff`            | Diff local vs remote schema                   |
| `npx supabase migration new NAME` | Create a new migration file                   |
| `npx supabase migration list`     | List all migrations                           |

### Backend Commands

| Command                                   | Description                   |
| ----------------------------------------- | ----------------------------- |
| `npm run dev`                             | Start backend (hot-reload)    |
| `docker compose --env-file .env.local up` | Start backend (containerized) |
| `docker compose down`                     | Stop backend container        |

### NPM Script Shortcuts

| Command             | Description                             |
| :------------------ | :-------------------------------------- |
| `npm run db:start`  | Start local Supabase services           |
| `npm run db:stop`   | Stop local services                     |
| `npm run db:reset`  | Reset database (migrations + seed)      |
| `npm run db:push`   | Push local migrations to remote project |
| `npm run db:status` | Check status of local services          |

---

**Need help?** Check the troubleshooting section above or open an issue.
