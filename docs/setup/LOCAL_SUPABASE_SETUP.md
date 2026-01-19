# Local Supabase CLI Setup Guide

This guide walks through setting up Supabase CLI for local development, allowing you to run a complete Supabase stack locally (PostgreSQL, Auth, Storage, etc.) without internet dependency.

---

## Why Local Supabase?

**Benefits:**

- **Offline development**: Work without internet connection
- **Faster iteration**: No network latency, instant database access
- **Safe testing**: Experiment without affecting dev/prod databases
- **Consistent environments**: Team uses identical local setup
- **Schema migrations**: Version control database changes with SQL files
- **Cost savings**: No API calls to remote Supabase (free local compute)

**Use Cases:**

- Developing database schema changes locally before pushing to dev
- Testing RLS policies without risking dev data
- Running integration tests against fresh database
- Onboarding new developers (no Supabase account needed initially)

---

## Prerequisites

- **Docker Desktop** installed and running
- **Node.js** 18+ installed
- **Git** installed
- Lock-in repository cloned locally

---

## Step 1: Install Supabase CLI

### Windows (PowerShell)

```powershell
# Using Scoop package manager (recommended)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# OR using NPM (alternative)
npm install -g supabase
```

### macOS

```bash
# Using Homebrew
brew install supabase/tap/supabase

# OR using NPM
npm install -g supabase
```

### Linux

```bash
# Using NPM
npm install -g supabase
```

**Verify installation:**

```bash
supabase --version
# Should output: 1.x.x or higher
```

---

## Step 2: Initialize Supabase in Lock-in Project

**Navigate to project root:**

```bash
cd <repo-root>
```

**Initialize Supabase (only needed if `supabase/config.toml` is missing):**

```bash
supabase init
```

**Expected output:**

```
✔ Port for Supabase local DB: · 54326
✔ Port for Supabase API: · 54331
✔ Port for Supabase Studio: · 54335
Finished supabase init.
```

**What this creates (already in this repo):**

```
Lock-in/
└── supabase/
    ├── config.toml           # Supabase local configuration
    ├── seed.sql              # Initial data seed (optional)
    └── migrations/           # SQL migration files (version controlled)
```

---

## Step 3: Link to Remote Supabase Project (Optional)

**Link local CLI to dev Supabase project:**

```bash
supabase link --project-ref uszxfuzauetcchwcgufe
```

**You'll be prompted for:**

1. **Supabase access token**: Generate at https://supabase.com/dashboard/account/tokens
2. **Database password**: Your dev project's database password

**Why link?**

- Pull existing schema from dev database
- Push local migrations to dev database
- Sync changes between local and dev environments

---

## Step 4: Pull Existing Schema from Dev

**Download dev database schema to local:**

```bash
supabase db pull
```

**What this does:**

- Connects to dev Supabase (`uszxfuzauetcchwcgufe`)
- Generates SQL migration file from current schema
- Saves to `supabase/migrations/YYYYMMDDHHMMSS_remote_schema.sql`
- Includes tables, RLS policies, functions, triggers

**Review generated migration:**

```bash
ls supabase/migrations/
# 20260117000000_remote_schema.sql
```

---

## Step 5: Start Local Supabase

**Start all Supabase services (Docker containers):**

```bash
npm run supabase:start
```

**What runs:**

- PostgreSQL database (port 54326)
- PostgREST API (port 54331)
- Supabase Studio UI (port 54335)
- GoTrue auth server
- Storage server
- Realtime server

**Expected output:**

```
Started supabase local development setup.

         API URL: http://127.0.0.1:54331
          DB URL: postgresql://postgres:postgres@127.0.0.1:54326/postgres
      Studio URL: http://127.0.0.1:54335
    Inbucket URL: http://127.0.0.1:54334
   Publishable key: sb_publishable_xxx
        Secret key: sb_secret_xxx
```

**Save these credentials** - you'll need them for local development.

---

## Step 6: Access Supabase Studio (Local Web UI)

**Open in browser:**

```
http://127.0.0.1:54335
```

**What you can do:**

- View/edit tables (SQL Editor)
- Test RLS policies
- Browse storage buckets
- View auth users
- Test API endpoints

**No authentication needed** - local Studio has no login.

---

## Step 7: Configure Backend for Local Supabase

**Option A: Environment-specific .env file (recommended)**

Create `.env` in `backend/`:

```bash
cd backend

# Local Supabase Configuration
NODE_ENV=development
SUPABASE_ENV=local
SUPABASE_URL_LOCAL=http://127.0.0.1:54331
SUPABASE_ANON_KEY_LOCAL=sb_publishable_xxx  # From supabase start output
SUPABASE_SERVICE_ROLE_KEY_LOCAL=sb_secret_xxx  # From supabase start output

# OpenAI (still needs remote API)
OPENAI_API_KEY=sk-your-api-key-here

# Server
PORT=3000
```

**Option B: Temporary override**

```bash
# Set for current terminal session only
export SUPABASE_ENV=local
export SUPABASE_URL_LOCAL=http://127.0.0.1:54331
export SUPABASE_ANON_KEY_LOCAL=sb_publishable_xxx
export SUPABASE_SERVICE_ROLE_KEY_LOCAL=sb_secret_xxx

# Run backend
npm run dev
```

---

## Step 8: Configure Extension for Local Supabase

**Generate `extension/config.js` (for local testing only):**

```bash
LOCKIN_APP_ENV=local npm run extension:config
```

**Important:**

- Do NOT commit generated secrets
- Only for local extension testing
- Revert before building for deployment

---

## Step 9: Seed Local Database with Test Data

**Create seed file: `supabase/seed.sql`**

```sql
-- ============================================================================
-- Lock-in Local Development Seed Data
-- ============================================================================

-- Create test user
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'test@lockin.dev',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
);

-- Create test notes
INSERT INTO public.notes (user_id, title, content, course_code, week_number) VALUES
('00000000-0000-0000-0000-000000000001', 'Test Note 1', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Sample note content"}]}]}', 'TEST101', 1),
('00000000-0000-0000-0000-000000000001', 'Test Note 2', '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Another note"}]}]}', 'TEST101', 2);

-- Create test chat
INSERT INTO public.chats (user_id, title, course_code, week_number) VALUES
('00000000-0000-0000-0000-000000000001', 'Test Chat', 'TEST101', 1);
```

**Run seed:**

```bash
supabase db reset
```

**What this does:**

- Drops all data
- Re-runs migrations
- Runs seed.sql
- Fresh database with test data

---

## Step 10: Create Database Migrations

**When you change schema locally:**

```bash
# Create new migration file
npm run supabase:migration:new -- add_tags_to_notes

# Opens: supabase/migrations/YYYYMMDDHHMMSS_add_tags_to_notes.sql
```

**Edit migration file:**

```sql
-- Add tags column to notes table
ALTER TABLE public.notes ADD COLUMN tags TEXT[];

-- Create index for tag searches
CREATE INDEX idx_notes_tags ON public.notes USING GIN (tags);
```

**Apply migration locally:**

```bash
supabase db reset
```

---

## Step 11: Push Migrations to Dev Supabase

**After testing locally, push to dev:**

```bash
npm run supabase:push:dev
```

Requires `SUPABASE_PROJECT_REF_DEV` in your environment (and `supabase login` or `SUPABASE_ACCESS_TOKEN`).

**What this does:**

- Compares local migrations with dev database
- Applies new migrations to dev Supabase
- Updates migration history table
- Idempotent (safe to run multiple times)

---

## Common Commands

### Start/Stop Local Supabase

```bash
# Start all services
npm run supabase:start

# Stop all services (preserves data)
npm run supabase:stop

# Stop and remove all data
supabase stop --no-backup

# Restart services
supabase restart
```

### Database Management

```bash
# Reset database (re-run migrations + seed)
supabase db reset

# Open psql shell to local database
supabase db shell

# Run SQL file against local database
supabase db execute --file path/to/file.sql

# Diff local vs dev database
npm run supabase:migration:diff -- -f remote_schema
```

### Migration Management

```bash
# Create new migration
npm run supabase:migration:new -- migration_name

# List migrations
supabase migration list

# Apply migrations up to specific version
supabase migration up --version 20260117000000

# Push migrations to remote (dev/prod)
npm run supabase:push:dev
npm run supabase:push:prod
```

### Status & Logs

```bash
# Check service status
npm run supabase:status

# View logs
supabase logs
supabase logs --db
supabase logs --api
```

---

## Typical Development Workflow

### Day-to-Day Development

```bash
# 1. Start local Supabase
npm run supabase:start

# 2. Run backend pointing to local
cd backend
npm run dev

# 3. Generate extension config + load unpacked extension
LOCKIN_APP_ENV=local npm run extension:config
# Open Chrome -> Load unpacked -> extension/

# 4. Develop features, test locally

# 5. Stop local Supabase when done
npm run supabase:stop
```

### Schema Change Workflow

```bash
# 1. Create migration for schema change
npm run supabase:migration:new -- add_new_feature

# 2. Edit generated SQL file
# supabase/migrations/YYYYMMDDHHMMSS_add_new_feature.sql

# 3. Apply locally and test
supabase db reset

# 4. Test backend with new schema
cd backend
npm run dev

# 5. If all works, push to dev
npm run supabase:push:dev

# 6. Commit migration file to git
git add supabase/migrations/
git commit -m "Add new feature schema"
git push
```

---

## Troubleshooting

### Docker Not Running

**Symptom:** `Error: Cannot connect to Docker daemon`

**Solution:**

```bash
# Windows: Start Docker Desktop
# macOS: Start Docker Desktop
# Linux: sudo systemctl start docker
```

### Port Already in Use

**Symptom:** `Error: port 54331 already allocated`

**Solution:**

```bash
# Check what's using the port
netstat -ano | findstr :54331  # Windows
lsof -i :54331                 # macOS/Linux

# Kill the process or change port in supabase/config.toml
[api]
port = 54331  # Change to another unused port
```

### Migration Conflict

**Symptom:** `Error: migration conflict detected`

**Solution:**

```bash
# Pull latest migrations from dev
supabase db pull

# Reset local database
supabase db reset
```

### Database Connection Refused

**Symptom:** Backend cannot connect to local Supabase

**Check:**

1. `supabase status` shows all services running
2. `.env` has correct `SUPABASE_URL_LOCAL=http://127.0.0.1:54331`
3. Anon key matches output from `supabase start`
4. The backend is running from `backend/` so it loads the correct `.env`

---

## Environment Comparison

| Environment | Database | URL | Use Case |
|-------------|----------|-----|----------|
| **Local** | Local Docker | `127.0.0.1:54331` | Offline dev, schema changes, testing |
| **Dev/Staging** | `uszxfuzauetcchwcgufe` | `https://uszxfuzauetcchwcgufe.supabase.co` | Team testing, integration tests |
| **Production** | `vtuflatvllpldohhimao` | `https://vtuflatvllpldohhimao.supabase.co` | Real users, real data |

**Best Practice:**

1. Develop schema changes locally
2. Test locally with seed data
3. Push migrations to dev
4. Team tests on dev environment
5. Deploy to prod after validation

---

## Security Notes

- **Local Supabase uses default credentials** - Never use in production
- **Local Studio has no auth** - Only accessible on localhost
- **JWT secrets are fixed** - Fine for local dev, but don't expose publicly
- **Seed data is public** - Don't put real user data in `seed.sql`

---

## Next Steps

- [ ] Install Supabase CLI
- [ ] Initialize Supabase in project
- [ ] Link to dev project
- [ ] Pull existing schema
- [ ] Start local Supabase
- [ ] Configure backend for local
- [ ] Create seed data
- [ ] Test schema migration workflow

---

## Related Documentation

- [Supabase CLI Reference](https://supabase.com/docs/guides/cli)
- [Local Development Guide](https://supabase.com/docs/guides/cli/local-development)
- [Database Migrations](https://supabase.com/docs/guides/cli/migrations)
- [Lock-in DATABASE.md](/DATABASE.md) - Schema documentation
- [Lock-in MCP Setup](./README.md) - MCP configuration

---

**Happy local development! 🚀**
