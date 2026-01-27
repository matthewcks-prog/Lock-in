# 🔧 Your Current .env Migration Checklist

## Current State Analysis

Your current `backend/.env` file has **legacy variable names** that need updating.

### ⚠️ Issues Found:

1. **Using legacy `SUPABASE_URL` instead of `SUPABASE_URL_DEV`**
2. **Using legacy `SUPABASE_SERVICE_ROLE_KEY` instead of `SUPABASE_SERVICE_ROLE_KEY_DEV`**
3. **No `SUPABASE_ANON_KEY_DEV`** (optional but recommended)
4. **No Azure OpenAI credentials** (required for primary AI provider)

---

## 📋 Migration Steps

### Step 1: Backup Current .env

```bash
cd backend
cp .env .env.backup
```

### Step 2: Update Variable Names

Edit `backend/.env` and change:

#### Before (Current - Legacy):

```env
OPENAI_API_KEY=sk-proj-4brL...
PORT=3000
SUPABASE_URL=https://uszxfuzauetcchwcgufe.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
DAILY_REQUEST_LIMIT=100
SENTRY_DSN=https://9e5552b8...
SENTRY_ENABLED=false
```

#### After (New - Environment-Aware):

```env
# =============================================================================
# Lock-in Backend - Development Environment
# =============================================================================

NODE_ENV=development

# Supabase (Development)
SUPABASE_URL_DEV=https://uszxfuzauetcchwcgufe.supabase.co
SUPABASE_SERVICE_ROLE_KEY_DEV=eyJhbGc...  # (your existing key)
SUPABASE_ANON_KEY_DEV=eyJ...  # Get from Supabase dashboard if needed

# Azure OpenAI (Primary - REQUIRED)
AZURE_OPENAI_API_KEY=your-azure-key-here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT=text-embedding-3-small
AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT=whisper-1

# OpenAI (Fallback - Optional)
OPENAI_API_KEY=sk-proj-4brL...  # (your existing key)

# Server
PORT=3000

# Sentry (Optional)
SENTRY_DSN=https://9e5552b8...  # (your existing DSN)
SENTRY_ENABLED=false

# Rate Limiting (Optional)
DAILY_REQUEST_LIMIT=100
```

### Step 3: Get Missing Credentials

#### Azure OpenAI (Required)

You need Azure OpenAI credentials. Options:

**Option A: Get Azure OpenAI Credentials**

1. Go to [Azure Portal](https://portal.azure.com)
2. Create Azure OpenAI resource (or use existing)
3. Get API key from "Keys and Endpoint" section
4. Copy endpoint URL
5. Note your deployment names

**Option B: Use OpenAI Only (Not Recommended)**
If you don't have Azure OpenAI, you can temporarily use OpenAI only by keeping your current `OPENAI_API_KEY`. However, the server will show warnings.

#### Supabase Anon Key (Optional)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `uszxfuzauetcchwcgufe`
3. Settings → API
4. Copy "anon" / "public" key
5. Add as `SUPABASE_ANON_KEY_DEV`

### Step 4: Test the New Configuration

```bash
# Navigate to backend
cd backend

# Start server (will validate environment)
npm start
```

#### Expected Output (Success):

```
[INFO] Lock-in backend server running on port 3000
[INFO] Ready to help students learn!
```

#### Expected Output (If Missing Azure):

```
⚠️  Environment Configuration Warnings:
   - At least one AI provider required

[INFO] Lock-in backend server running on port 3000
```

#### Expected Output (If Missing Required):

```
❌ Environment Validation Failed
   Current environment: development

Missing required variables:
   ❌ SUPABASE_URL_DEV (Development Supabase URL) [DEV ONLY]

💡 Fix:
   1. Copy backend/.env.example to backend/.env
   2. Fill in the required values
   3. Restart the server
```

---

## ✅ Verification Checklist

After migration, verify:

- [ ] Server starts without errors
- [ ] No validation warnings about legacy vars
- [ ] Can make API requests to `/health` endpoint
- [ ] Extension can connect to backend
- [ ] No production credentials in `.env`

---

## 🆘 Troubleshooting

### "Missing required variables: SUPABASE_URL_DEV"

**Fix:** You renamed the variable but the server still expects `_DEV` suffix:

```env
# ❌ Wrong
SUPABASE_URL=https://...

# ✅ Correct
SUPABASE_URL_DEV=https://...
```

### "Warning: Found legacy SUPABASE_URL"

**Fix:** You have both old and new variables. Remove the old one:

```env
# Remove this line:
# SUPABASE_URL=https://...

# Keep this:
SUPABASE_URL_DEV=https://...
```

### Server starts but AI requests fail

**Fix:** Check Azure OpenAI configuration:

1. Verify `AZURE_OPENAI_API_KEY` is correct
2. Verify `AZURE_OPENAI_ENDPOINT` URL
3. Verify deployment names match your Azure deployments

---

## 📝 Notes

- **Your existing credentials are safe** - We're just renaming variables
- **OpenAI key still works** - It's now a fallback provider
- **Sentry is optional** - Can leave disabled during development
- **Production credentials** - Will be handled separately via Azure Key Vault

---

**Need help?** Check [docs/deployment/ENVIRONMENTS.md](../docs/deployment/ENVIRONMENTS.md) for the canonical guide.
