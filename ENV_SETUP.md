# Environment Variables Setup Guide

## Quick Start

1. **Copy the template:**

   ```bash
   cp .env.example .env.local
   ```

2. **Fill in your actual credentials in `.env.local`:**
   - Supabase URL and keys
   - OpenAI API key
   - Sentry DSN (optional)

3. **Build the extension:**
   ```bash
   npm run build
   ```

## File Structure & Loading Order

Vite loads environment files in this order (later overrides earlier):

1. **`.env`** - Committed to git, safe defaults only
2. **`.env.development`** or **`.env.production`** - Mode-specific defaults
3. **`.env.local`** - **YOUR ACTUAL SECRETS** (gitignored, never commit!)

## File Purposes

### `.env.example`

- **Purpose:** Comprehensive template showing all available variables
- **Audience:** Developers setting up the project for the first time
- **Git Status:** Committed to git
- **Contents:** Placeholder values with documentation

### `.env`

- **Purpose:** Safe default values that work for basic setup
- **Audience:** All environments (development, CI/CD, production)
- **Git Status:** Committed to git
- **Contents:** Non-sensitive placeholders only

### `.env.development`

- **Purpose:** Development mode defaults (loaded with `--mode development`)
- **Audience:** Development environment
- **Git Status:** Committed to git
- **Contents:** Dev-specific defaults (e.g., permissive rate limits)

### `.env.production`

- **Purpose:** Production mode defaults (loaded with `--mode production`)
- **Audience:** Production builds
- **Git Status:** Committed to git
- **Contents:** Prod-specific defaults (e.g., stricter rate limits)

### `.env.local` (YOUR SECRETS)

- **Purpose:** Your actual API keys and credentials
- **Audience:** YOU (local development only)
- **Git Status:** **GITIGNORED** - never committed
- **Contents:** Real secrets, overrides all other env files

### `.env.example.local`

- **Purpose:** Extended template for backend-specific variables
- **Audience:** Backend developers needing full AI services config
- **Git Status:** Committed to git
- **Contents:** Template for Azure OpenAI, Speech, etc.

## Variable Prefixes

### `VITE_` prefix (Extension Build)

- **Usage:** Variables embedded in the extension bundle at build time
- **Access:** Available in frontend code via `import.meta.env.VITE_*`
- **Examples:**
  - `VITE_SUPABASE_URL_DEV`
  - `VITE_SUPABASE_ANON_KEY_DEV`
  - `VITE_BACKEND_URL_DEV`

### No prefix (Backend Server)

- **Usage:** Variables used by Node.js backend at runtime
- **Access:** Available via `process.env.*`
- **Examples:**
  - `SUPABASE_SERVICE_ROLE_KEY_DEV`
  - `OPENAI_API_KEY`
  - `NODE_ENV`

## Common Tasks

### Build Extension for Development

```bash
npm run build
# Reads: .env.local > .env.development > .env
# Uses: VITE_SUPABASE_URL_DEV, VITE_SUPABASE_ANON_KEY_DEV, etc.
```

### Build Extension for Production

```bash
npm run build:prod
# Reads: .env.local > .env.production > .env
# Uses: VITE_SUPABASE_URL_PROD, VITE_SUPABASE_ANON_KEY_PROD, etc.
```

### Run Backend Server

```bash
cd backend
npm start
# Reads: ../.env.local > ../.env
# Uses: SUPABASE_SERVICE_ROLE_KEY_DEV, OPENAI_API_KEY, etc.
```

## Security Best Practices

✅ **DO:**

- Keep real secrets in `.env.local` only
- Commit `.env.example` as documentation
- Use Azure Key Vault for production deployments
- Use different Supabase projects for dev/prod
- Rotate keys regularly

❌ **DON'T:**

- Commit `.env.local` to git
- Put real API keys in `.env` or `.env.development`
- Share `.env.local` in Slack/Discord
- Use production keys in development
- Hardcode secrets in source code

## Troubleshooting

### Error: "Configure VITE_SUPABASE_URL_DEV and VITE_SUPABASE_ANON_KEY_DEV"

**Cause:** Missing or invalid variables in `.env.local`

**Fix:**

1. Ensure `.env.local` exists (copy from `.env.example`)
2. Fill in real Supabase credentials in `.env.local`:
   ```
   VITE_SUPABASE_URL_DEV=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY_DEV=eyJhbGc...
   ```
3. Rebuild the extension:
   ```bash
   npm run build
   ```

### Variables Not Loading

**Check file loading order:**

```bash
# In your project root
ls -la .env*
```

**Verify file contents:**

```bash
# Should contain your actual keys (gitignored)
cat .env.local

# Should contain safe placeholders (committed)
cat .env
```

**Verify build output:**

```bash
npm run build -- --mode development
# Check console output for loaded env files
```

## Environment Variable Reference

### Extension (VITE\_ prefix)

| Variable                      | Required        | Default                 | Description                      |
| ----------------------------- | --------------- | ----------------------- | -------------------------------- |
| `VITE_SUPABASE_URL_DEV`       | ✅              | -                       | Development Supabase project URL |
| `VITE_SUPABASE_ANON_KEY_DEV`  | ✅              | -                       | Development Supabase anon key    |
| `VITE_BACKEND_URL_DEV`        | ✅              | `http://localhost:3000` | Development backend URL          |
| `VITE_SUPABASE_URL_PROD`      | Production only | -                       | Production Supabase project URL  |
| `VITE_SUPABASE_ANON_KEY_PROD` | Production only | -                       | Production Supabase anon key     |
| `VITE_BACKEND_URL_PROD`       | Production only | -                       | Production backend URL           |
| `VITE_SENTRY_DSN`             | Optional        | -                       | Sentry error tracking DSN        |
| `VITE_DEBUG`                  | Optional        | `false`                 | Enable debug logging             |

### Backend (No prefix)

| Variable                        | Required | Default       | Description                  |
| ------------------------------- | -------- | ------------- | ---------------------------- |
| `NODE_ENV`                      | ✅       | `development` | Environment mode             |
| `PORT`                          | ✅       | `3000`        | Backend server port          |
| `SUPABASE_URL_DEV`              | ✅       | -             | Development Supabase URL     |
| `SUPABASE_SERVICE_ROLE_KEY_DEV` | ✅       | -             | Development service role key |
| `SUPABASE_ANON_KEY_DEV`         | ✅       | -             | Development anon key         |
| `OPENAI_API_KEY`                | ✅       | -             | OpenAI API key               |
| `OPENAI_MODEL`                  | Optional | `gpt-4o-mini` | OpenAI model to use          |
| `SENTRY_DSN`                    | Optional | -             | Sentry DSN for backend       |
| `DAILY_REQUEST_LIMIT`           | Optional | `100`         | Daily API request limit      |

## Need Help?

- Check [`.env.example`](.env.example) for the full template
- Check [`.env.example.local`](.env.example.local) for backend-specific config
- See [docs/setup/](docs/setup/) for detailed setup guides
- Ask in Discord/Slack if you're stuck
