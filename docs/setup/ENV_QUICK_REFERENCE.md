# 🎯 Environment Variables - Quick Reference

## 📋 Variable Naming Convention

| Pattern    | Purpose                 | Example             |
| ---------- | ----------------------- | ------------------- |
| `VAR_DEV`  | Development credentials | `SUPABASE_URL_DEV`  |
| `VAR_PROD` | Production credentials  | `SUPABASE_URL_PROD` |
| `VAR`      | Environment-agnostic    | `PORT`, `NODE_ENV`  |

## 🔑 Required Variables

### Development (Local)

```env
NODE_ENV=development
SUPABASE_URL_DEV=https://your-dev-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY_DEV=eyJ...
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o-mini
```

### Production (Azure)

```env
NODE_ENV=production
SUPABASE_URL_PROD=https://your-prod-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY_PROD=eyJ...
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o-mini
```

## 🎬 Commands

| Task            | Command                                      | Description                   |
| --------------- | -------------------------------------------- | ----------------------------- |
| First setup     | `cp backend/.env.example backend/.env`       | Copy template                 |
| Start server    | `npm start`                                  | Validates env + starts server |
| Docker dev      | `docker-compose up --build`                  | Run in container              |
| Test validation | `SHOW_ENV_VALIDATION_SUCCESS=true npm start` | Show validation output        |
| Deploy prod     | `.\scripts\azure-setup.ps1`                  | Azure deployment              |

## ⚠️ Security Rules

### ✅ DO

- Keep dev/prod environments separate
- Use Azure Key Vault for production
- Version control `.env.example` (no secrets)
- Validate on every startup

### ❌ DON'T

- Mix dev/prod credentials in same .env
- Commit real .env files to Git
- Use prod credentials locally
- Skip validation

## 🚨 Validation Errors

### Missing Required Variable

```bash
❌ SUPABASE_URL_DEV (Development Supabase URL) [DEV ONLY]
```

**Fix:** Add variable to `backend/.env`

### Legacy Variable Warning

```bash
⚠️  Found legacy SUPABASE_URL. Use SUPABASE_URL_DEV instead.
```

**Fix:** Rename `SUPABASE_URL` → `SUPABASE_URL_DEV`

### Mixed Environment Warning

```bash
⚠️  NODE_ENV=development but SUPABASE_URL_PROD is set.
```

**Fix:** Remove `*_PROD` vars from dev `.env`

## 📁 File Structure

```
backend/
├── .env                    # Your local credentials (gitignored)
├── .env.example            # Template (version controlled)
├── config.js               # Reads environment variables
├── index.js                # Validates on startup
└── utils/
    └── validateEnv.js      # Validation logic
```

## 🔗 Full Documentation

- **Setup:** [docs/setup/ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)
- **Migration:** [backend/MIGRATION_CHECKLIST.md](../../backend/MIGRATION_CHECKLIST.md)
- **Security Fixes:** [docs/setup/ENV_SECURITY_FIXES.md](./ENV_SECURITY_FIXES.md)
