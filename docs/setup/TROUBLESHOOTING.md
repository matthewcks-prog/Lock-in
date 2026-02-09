# Troubleshooting Guide

## Overview

This guide covers common issues when developing Lock-in locally and their solutions. Before reporting a bug, please check this guide first.

---

## Table of Contents

- [Supabase Issues](#supabase-issues)
- [Backend Issues](#backend-issues)
- [Extension Issues](#extension-issues)
- [Docker Issues](#docker-issues)
- [Database Issues](#database-issues)
- [Authentication Issues](#authentication-issues)
- [Network Issues](#network-issues)
- [Getting Help](#getting-help)

---

## Supabase Issues

### ❌ Supabase CLI Not Found

**Symptoms:**

```
npx: command not found: supabase
```

**Solution:**

```powershell
# Install Supabase CLI globally
npm install -g supabase

# Or use npx (no install needed)
npx supabase start
```

### ❌ Supabase Start Failed - Docker Not Running

**Symptoms:**

```
Error: Cannot connect to the Docker daemon
```

**Solution:**

1. Start Docker Desktop
2. Wait for Docker to fully start (whale icon in system tray)
3. Retry: `npx supabase start`

### ❌ Port Already in Use

**Symptoms:**

```
Error: Port 54321 is already allocated
```

**Solution:**

```powershell
# Stop Supabase
npx supabase stop

# If that fails, find and kill process
Get-NetTCPConnection -LocalPort 54321 | Select-Object OwningProcess
Stop-Process -Id <PID> -Force

# Restart
npx supabase start
```

### ❌ Supabase Status Shows "Unhealthy"

**Symptoms:**

```
npx supabase status
# Shows services as "unhealthy"
```

**Solution:**

```powershell
# Stop and restart
npx supabase stop --no-backup
npx supabase start

# If still failing, check Docker resources
# Docker Desktop > Settings > Resources
# Ensure at least 2GB RAM, 2 CPUs allocated
```

---

## Backend Issues

### ❌ Port 3000 Already in Use

**Symptoms:**

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**

```powershell
# Find process using port 3000
Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess

# Kill the process
Stop-Process -Id <PID> -Force

# Or use different port
$env:PORT=3001
npm run dev
```

### ❌ JWT Validation Failed

**Symptoms:**

```
Error: Supabase token validation failed: invalid JWT
Error: signing method ES256 is invalid
```

**Root Cause:** Supabase CLI v1.x+ uses ES256 (asymmetric) tokens, not HS256 (symmetric).

**Solution:**

```powershell
# 1. Get correct JWT format keys
npx supabase status -o env

# 2. Verify .env.local has JWT format keys (start with eyJ...)
# ❌ WRONG: SUPABASE_SERVICE_ROLE_KEY_DEV=sb_secret_...
# ✅ CORRECT: SUPABASE_SERVICE_ROLE_KEY_DEV=eyJhbGciOiJFUzI1NiIs...

# 3. Ensure JWT secret is set
echo $env:SUPABASE_JWT_SECRET

# 4. Restart backend
npm run dev
```

### ❌ Module Not Found

**Symptoms:**

```
Error: Cannot find module 'express'
```

**Solution:**

```powershell
# Clean install
rm -rf node_modules package-lock.json
npm install

# If still failing, check Node.js version
node --version  # Should be >= 18.0.0
```

### ❌ Supabase Client Error: "Invalid API Key"

**Symptoms:**

```
Error: Invalid API key format
```

**Solution:**

```powershell
# Check environment variables
cd backend
cat .env.local

# Must have:
# - SUPABASE_URL_DEV=http://127.0.0.1:54321
# - SUPABASE_SERVICE_ROLE_KEY_DEV=eyJ... (JWT format)

# Get keys from Supabase
npx supabase status -o env
```

---

## Extension Issues

### ❌ Extension Not Loading in Chrome

**Symptoms:**

- Extension icon doesn't appear
- "Failed to load extension" error

**Solution:**

1. Build extension: `npm run build:extension`
2. Chrome > `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `extension/` directory

### ❌ Content Script Not Injecting

**Symptoms:**

- Sidebar doesn't appear on Moodle
- Console error: "Refused to execute inline script"

**Solution:**

```javascript
// Check manifest.json content_scripts matches
{
  "matches": ["https://learning.monash.edu/*"],
  "js": ["contentScript.js"]
}

// Rebuild extension
npm run build:extension

// Reload extension in Chrome
```

### ❌ Chrome Storage Not Persisting

**Symptoms:**

- Settings reset after closing browser
- Auth token disappears

**Solution:**

```javascript
// Check chrome.storage.local permissions in manifest.json
{
  "permissions": ["storage"]
}

// Test storage access
chrome.storage.local.set({ test: "value" }, () => {
  console.log("Storage test:", chrome.runtime.lastError || "success");
});
```

---

## Docker Issues

### ❌ EADDRINUSE in Docker Container

**Symptoms:**

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Root Cause:** Local `npm run dev` is running alongside Docker.

**Solution:**

```powershell
# Stop local backend
# (Ctrl+C in terminal running npm run dev)

# Ensure only Docker is running
docker compose up
```

### ❌ Cannot Connect to Supabase from Docker

**Symptoms:**

```
Error: connect ECONNREFUSED 127.0.0.1:54321
```

**Solution:**

```yaml
# In docker-compose.yml, use host.docker.internal
environment:
  SUPABASE_URL_DEV: http://host.docker.internal:54321
  # NOT: http://127.0.0.1:54321
```

### ❌ Docker Build Fails - Permission Denied

**Symptoms:**

```
Error: EACCES: permission denied
```

**Solution (Windows):**

1. Docker Desktop > Settings > Resources > File Sharing
2. Add `C:\Users\<user>\Lock-in` to shared paths
3. Restart Docker Desktop

---

## Database Issues

### ❌ Schema Out of Sync

**Symptoms:**

```
Error: relation "public.notes" does not exist
Error: column "embedding" does not exist
```

**Solution:**

```powershell
# Reset database and apply all migrations
npx supabase db reset

# Verify schema in Studio
# http://127.0.0.1:54323
```

### ❌ Migration Failed

**Symptoms:**

```
Error: migration 20260101000001_note_assets.sql failed
```

**Solution:**

```powershell
# Check migration syntax
cat supabase/migrations/20260101000001_note_assets.sql

# Common issues:
# - Missing semicolons
# - Wrong table/column names
# - Constraint violations

# Fix SQL and retry
npx supabase db reset
```

### ❌ Row Level Security (RLS) Blocking Queries

**Symptoms:**

```
Error: new row violates row-level security policy
```

**Solution:**

```sql
-- Check RLS policies in Supabase Studio
-- Ensure policy allows operation:

-- Example: Allow users to insert own notes
CREATE POLICY "Users can create own notes"
  ON public.notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### ❌ Foreign Key Constraint Violation

**Symptoms:**

```
Error: insert or update on table "notes" violates foreign key constraint
```

**Solution:**

```sql
-- Ensure referenced record exists
-- Example: user_id must exist in auth.users

-- Check if user exists
SELECT id FROM auth.users WHERE id = '<uuid>';

-- Use service_role key for admin operations (bypass RLS)
```

---

## Authentication Issues

### ❌ Token Expired

**Symptoms:**

```
Error: JWT expired
```

**Solution:**

```javascript
// Tokens expire after 1 hour (default)
// Extension should refresh automatically

// Manual refresh:
const { data, error } = await supabase.auth.refreshSession();
```

### ❌ User Not Found

**Symptoms:**

```
Error: User not found (auth.users)
```

**Solution:**

```powershell
# Check if user exists in Supabase Studio
# http://127.0.0.1:54323 > Authentication > Users

# Create test user:
curl -X POST http://127.0.0.1:54321/auth/v1/signup \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### ❌ Invalid Credentials

**Symptoms:**

```
Error: Invalid login credentials
```

**Solution:**

1. Verify email/password are correct
2. Check user is confirmed (local Supabase auto-confirms)
3. Ensure RLS policies allow user to query own data

---

## Network Issues

### ❌ CORS Error

**Symptoms:**

```
Access to fetch at 'http://localhost:3000' from origin 'chrome-extension://...' has been blocked by CORS policy
```

**Solution:**

```javascript
// Backend: Ensure CORS middleware allows extension
// backend/app.js
app.use(
  cors({
    origin: ['chrome-extension://<extension-id>', 'http://localhost:3000'],
    credentials: true,
  }),
);
```

### ❌ Fetch Timeout

**Symptoms:**

```
Error: Request timeout after 30000ms
```

**Solution:**

```javascript
// Increase timeout for slow operations
const response = await fetch(url, {
  signal: AbortSignal.timeout(60000), // 60 seconds
});
```

### ❌ Network Error: ERR_CONNECTION_REFUSED

**Symptoms:**

```
net::ERR_CONNECTION_REFUSED
```

**Solution:**

1. Verify backend is running: `curl http://localhost:3000/health`
2. Check port is correct (3000 by default)
3. Ensure firewall allows local connections

---

## Common Development Patterns

### Clean Slate Reset

When things are completely broken:

```powershell
# 1. Stop everything
npx supabase stop --no-backup
docker compose down -v

# 2. Clean dependencies
cd backend
rm -rf node_modules package-lock.json
npm install

# 3. Restart Supabase
cd ..
npx supabase start
npx supabase db reset

# 4. Start backend
cd backend
npm run dev
```

### Verify Environment Setup

```powershell
# Check Node.js version
node --version  # >= 18.0.0

# Check npm version
npm --version   # >= 9.0.0

# Check Docker is running
docker ps

# Check Supabase status
npx supabase status

# Check backend health
curl http://localhost:3000/health
```

### Enable Debug Logging

```javascript
// Backend: Set LOG_LEVEL in .env.local
LOG_LEVEL = debug;

// Extension: Open DevTools
// Right-click extension icon > "Inspect popup"
// Console will show all logs
```

---

## Getting Help

### Before Opening an Issue

1. ✅ Check this troubleshooting guide
2. ✅ Search [existing issues](https://github.com/your-org/lock-in/issues)
3. ✅ Try [clean slate reset](#clean-slate-reset)
4. ✅ Enable debug logging

### When Opening an Issue

Include:

- **Environment**: OS, Node.js version, Docker version
- **Steps to reproduce**: Exact commands run
- **Error output**: Full error message and stack trace
- **Configuration**: Relevant .env values (redact secrets!)
- **Logs**: Backend logs, browser console logs

### Additional Resources

- [Local Development Guide](./LOCAL_DEVELOPMENT.md) - Setup instructions
- [Backend AGENTS](../../backend/AGENTS.md) - Architecture and patterns
- [Database Schema](../reference/DATABASE.md) - Schema reference
- [Migration Guide](../../supabase/migrations/README.md) - Database migrations
- [Contributing Guide](../../CONTRIBUTING_AI.md) - PR process

---

**Still stuck?** Open an issue with the details above, and we'll help you out!
