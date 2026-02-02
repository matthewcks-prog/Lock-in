# Local Development Quick Reference

## 🚀 Quick Start (One Command)

```powershell
.\scripts\dev\setup-local.ps1
cd backend
npm run dev
```

## 📋 Manual Setup

```powershell
# 1. Start Supabase
npx supabase start

# 2. Setup environment
cd backend
cp .env.local.example .env.local

# 3. Apply migrations
npx supabase db reset

# 4. Install dependencies
npm install

# 5. Start backend
npm run dev
```

## 🔧 Common Commands

| Command                             | Description                       |
| ----------------------------------- | --------------------------------- |
| `npx supabase start`                | Start local Supabase              |
| `npx supabase stop`                 | Stop local Supabase               |
| `npx supabase status`               | Show connection info              |
| `npx supabase db reset`             | Reset database (apply migrations) |
| `npm run dev`                       | Start backend (hot-reload)        |
| `docker compose up`                 | Start backend (containerized)     |
| `curl http://localhost:3000/health` | Test backend health               |

## 🌐 Local URLs

| Service             | URL                                                     |
| ------------------- | ------------------------------------------------------- |
| **Backend API**     | http://localhost:3000                                   |
| **Supabase Studio** | http://127.0.0.1:54323                                  |
| **Supabase API**    | http://127.0.0.1:54321                                  |
| **PostgreSQL**      | postgresql://postgres:postgres@127.0.0.1:54322/postgres |

## 🔑 Default Credentials (Local Only)

**These are safe to use for local development:**

```bash
SUPABASE_URL_DEV=http://127.0.0.1:54321
SUPABASE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long

# Service Role Key (full access)
SUPABASE_SERVICE_ROLE_KEY_DEV=eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MjA4NTMwODA5Nn0.KduYn6XMH_Tu2Bp0UsQyTM_z-kVnvCBfYILEX-VV5uaYRt7G6QrYEVLvzU7FtlzB2zVjDTph8gJCMuXgVeeGUg

# Anon Key (row-level security applies)
SUPABASE_ANON_KEY_DEV=eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjIwODUzMDgwOTZ9.HqNZ2YyQTAAiovOShRXF9D2YLjQEqz1fFJJi6-fXlinz-GcqsrnuMWkFsE80R80nSCEqbjEzkWhdsMsNggphFg
```

⚠️ **Never use these in staging/production!**

## 🐛 Troubleshooting

### JWT Validation Failed

```bash
# Ensure JWT secret is set
echo $env:SUPABASE_JWT_SECRET

# Restart backend
npm run dev
```

### Connection Refused (Docker)

```bash
# Check local Supabase is running
npx supabase status

# Verify URL uses host.docker.internal
# In docker-compose.yml:
SUPABASE_URL_DEV=http://host.docker.internal:54321
```

### Port 3000 Already in Use

```bash
# Find and kill process
Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess
Stop-Process -Id <PID>
```

### Database Schema Out of Sync

```bash
# Reset database (applies all migrations)
npx supabase db reset

# Or apply specific migration
npx supabase migration up
```

## 📚 Documentation

| Topic                | File                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| **Full Setup Guide** | [docs/setup/LOCAL_DEVELOPMENT.md](../setup/LOCAL_DEVELOPMENT.md)     |
| **Backend Rules**    | [backend/AGENTS.md](../../backend/AGENTS.md)                         |
| **Database Schema**  | [docs/reference/DATABASE.md](./DATABASE.md)                          |
| **Migration Guide**  | [supabase/migrations/README.md](../../supabase/migrations/README.md) |
| **Contributing**     | [CONTRIBUTING_AI.md](../../CONTRIBUTING_AI.md)                       |

## 🔄 Daily Workflow

```powershell
# Morning: Start services
npx supabase start
cd backend
npm run dev

# Development: Make changes, test
# (Backend auto-reloads on file changes)

# Check database
# Visit http://127.0.0.1:54323

# Evening: Stop services (optional)
npx supabase stop
```

## 🧪 Testing

```powershell
# Run all tests
npm test

# Test specific file
npm test -- --test-only validators.test.js

# Test health endpoint
curl http://localhost:3000/health
```

## 🔧 Advanced

### Custom Migrations

```powershell
# Create migration
npx supabase migration new add_feature

# Edit: supabase/migrations/<timestamp>_add_feature.sql
# Apply
npx supabase db reset
```

### View Logs

```powershell
# Supabase logs
npx supabase logs

# Backend logs (Docker)
docker logs lock-in-backend -f

# Backend logs (npm)
# (Already visible in terminal)
```

### Reset Everything

```powershell
# Nuclear option: Complete reset
npx supabase stop --no-backup
npx supabase start
npx supabase db reset
cd backend
npm install
npm run dev
```

## 🆘 Get Help

1. Check [Troubleshooting Guide](../setup/TROUBLESHOOTING.md)
2. Review [Local Development Guide](../setup/LOCAL_DEVELOPMENT.md)
3. Search [GitHub Issues](https://github.com/your-repo/issues)
4. Ask in team chat

---

**Last Updated:** February 1, 2026  
**Version:** 1.0.0
