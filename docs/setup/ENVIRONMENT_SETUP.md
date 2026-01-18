# 🔐 Environment Variables - Setup Guide

## 📋 Quick Start

### First-Time Setup

```bash
# 1. Navigate to backend directory
cd backend

# 2. Copy the template
cp .env.example .env

# 3. Edit .env with your real credentials
# Use your favorite editor (VS Code, nano, etc.)
code .env
```

### Required Variables (Development)

Fill in these values in your `backend/.env`:

```env
NODE_ENV=development

# Supabase (Development)
SUPABASE_URL_DEV=https://your-dev-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY_DEV=eyJ...your-dev-key...
SUPABASE_ANON_KEY_DEV=eyJ...your-dev-anon-key...

# Azure OpenAI (Required)
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT=text-embedding-3-small
AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT=whisper-1

# OpenAI Fallback (Optional but recommended)
OPENAI_API_KEY=sk-proj-...your-openai-key...
```

---

## 🎯 When to Run What

### Local Development (Daily Work)

```bash
# Start backend server (validates env on startup)
cd backend
npm start

# ✅ What happens:
# - Loads .env file
# - Validates required variables (fails fast if missing)
# - Starts server on port 3000
```

**Expected Output:**

```
✅ Environment validation passed
[INFO] Lock-in backend server running on port 3000
[INFO] Ready to help students learn!
```

### Docker Development (Testing Containerization)

```bash
# Build and run in Docker (uses backend/.env)
docker-compose up --build

# ✅ What happens:
# - Reads backend/.env for SUPABASE_URL_DEV, etc.
# - Builds Docker image
# - Starts container on port 3000
# - Health check: http://localhost:3000/health
```

**Use when:**

- Testing Docker build before Azure deployment
- Verifying containerized environment
- Debugging Docker-specific issues

### Production Deployment (Azure Container Apps)

```bash
# Deploy to Azure (uses Azure Key Vault, NOT .env)
cd scripts
.\azure-setup.ps1

# ✅ What happens:
# - Creates Azure resources
# - Stores secrets in Azure Key Vault
# - Deploys container with PROD environment variables
# - Sets NODE_ENV=production
```

**Environment Variables Set in Azure:**

- `SUPABASE_URL_PROD` (from Key Vault)
- `SUPABASE_SERVICE_ROLE_KEY_PROD` (from Key Vault)
- `AZURE_OPENAI_API_KEY` (from Key Vault)
- All other production configs

---

## 🔒 Security Best Practices

### ✅ DO

1. **Keep environments isolated**

   ```env
   # Development .env
   NODE_ENV=development
   SUPABASE_URL_DEV=https://dev-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY_DEV=eyJ...dev-key...
   ```

2. **Use Azure Key Vault for production**
   - Never commit production credentials to Git
   - Store in Azure Key Vault
   - Reference via Azure Container Apps environment variables

3. **Fail fast with validation**
   - Server validates environment on startup
   - Missing variables = immediate exit with clear error message

4. **Version control .env.example**
   - Template is tracked in Git
   - Real .env is gitignored
   - Team always has up-to-date template

### ❌ DON'T

1. **Never mix dev/prod credentials**

   ```env
   # ❌ BAD - Mixing environments
   NODE_ENV=development
   SUPABASE_URL_DEV=https://dev.supabase.co
   SUPABASE_URL_PROD=https://prod.supabase.co  # ❌ Risk of accidental prod writes!
   ```

2. **Never commit real .env files**
   - `.env` is in `.gitignore`
   - Only `.env.example` (template) is tracked

3. **Never use production credentials locally**
   - Local dev = DEV credentials only
   - Production = PROD credentials only
   - No exceptions

4. **Never bypass validation**
   - Don't remove validation checks
   - Fix the root cause (missing variables)

---

## 🚨 Troubleshooting

### Error: "Missing required variables"

```
❌ Environment Validation Failed
   Current environment: development

Missing required variables:
   ❌ SUPABASE_URL_DEV (Development Supabase URL) [DEV ONLY]
   ❌ AZURE_OPENAI_API_KEY (Azure OpenAI API key)
```

**Fix:**

1. Open `backend/.env`
2. Fill in the missing variables (see `.env.example`)
3. Restart server

### Warning: "Found legacy SUPABASE_URL"

```
⚠️  Environment Configuration Warnings:
   - Found legacy SUPABASE_URL. Use SUPABASE_URL_DEV or SUPABASE_URL_PROD instead.
```

**Fix:**

```env
# Old (legacy)
SUPABASE_URL=https://project.supabase.co

# New (environment-aware)
SUPABASE_URL_DEV=https://dev-project.supabase.co
```

### Warning: "NODE_ENV=development but SUPABASE_URL_PROD is set"

```
⚠️  Environment Configuration Warnings:
   - NODE_ENV=development but SUPABASE_URL_PROD is set. Risk of accidental prod writes!
```

**Fix:** Remove production variables from development `.env`:

```env
# ✅ Development .env should only have *_DEV vars
NODE_ENV=development
SUPABASE_URL_DEV=https://dev.supabase.co
SUPABASE_SERVICE_ROLE_KEY_DEV=eyJ...

# ❌ Remove these from dev .env
# SUPABASE_URL_PROD=...
# SUPABASE_SERVICE_ROLE_KEY_PROD=...
```

---

## 📂 File Structure

```
backend/
├── .env                    # Your local credentials (GITIGNORED)
├── .env.example            # Template (VERSION CONTROLLED)
├── config.js               # Reads environment variables
├── index.js                # Validates env on startup
└── utils/
    └── validateEnv.js      # Validation logic
```

---

## 🔄 Migration Guide (Legacy → New)

If you have an old `.env` with `SUPABASE_URL` (no suffix):

### Before (Legacy)

```env
NODE_ENV=development
SUPABASE_URL=https://uszxfuzauetcchwcgufe.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### After (New)

```env
NODE_ENV=development
SUPABASE_URL_DEV=https://uszxfuzauetcchwcgufe.supabase.co
SUPABASE_SERVICE_ROLE_KEY_DEV=eyJ...
```

**Steps:**

1. Add `_DEV` suffix to Supabase variables
2. Restart server
3. Warnings should disappear

---

## 📚 Reference

### Environment Values

| Value         | Description        | When to Use               |
| ------------- | ------------------ | ------------------------- |
| `development` | Local dev, testing | Default for local work    |
| `staging`     | Pre-prod testing   | CI/CD preview deployments |
| `production`  | Live users         | Azure Container Apps only |

### Variable Naming Convention

| Pattern           | Purpose                 | Example             |
| ----------------- | ----------------------- | ------------------- |
| `VAR_DEV`         | Development credentials | `SUPABASE_URL_DEV`  |
| `VAR_PROD`        | Production credentials  | `SUPABASE_URL_PROD` |
| `VAR` (no suffix) | Environment-agnostic    | `PORT`, `NODE_ENV`  |

### Validation Logic

Enforced by `utils/validateEnv.js`:

- **Development**: Requires `*_DEV` variables
- **Production**: Requires `*_PROD` variables
- **All environments**: Requires at least one AI provider
- **Warnings**: Detects legacy vars or mixed environments

---

## 💡 Tips

1. **Use a password manager** for secrets (1Password, LastPass, etc.)
2. **Rotate keys regularly** (every 90 days)
3. **Use separate Supabase projects** for dev/prod
4. **Enable Sentry** for error tracking (optional but recommended)
5. **Check validation output** after changing `.env`

---

## 🆘 Need Help?

- Check [backend/README.md](../backend/README.md) for architecture details
- Review [.env.example](../.env.example) for all available variables
- Check server startup logs for validation errors
- Ask team for credentials if missing

---

**Last Updated:** 2026-01-17  
**Maintainer:** Lock-in Team
