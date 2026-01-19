# Environment Configuration Guide

Complete guide for Lock-in environment configuration, variables, and deployment strategy.

## Environment Overview

Lock-in uses **two separate Supabase projects** for environment isolation:

| Environment     | Supabase Project       | Container App     | Use Case              |
| --------------- | ---------------------- | ----------------- | --------------------- |
| **Development** | `uszxfuzauetcchwcgufe` | N/A (local)       | Local dev             |
| **Staging**     | `uszxfuzauetcchwcgufe` | `lock-in-dev`     | Feature testing       |
| **Production**  | `vtuflatvllpldohhimao` | `lock-in-backend` | Real users, real data |

### Key Principles

- ✅ Production credentials stored in Azure Key Vault ONLY (never in .env files)
- ✅ Development credentials can be in local .env files (gitignored)
- ✅ Environment variables use `_DEV` and `_PROD` suffixes
- ✅ `NODE_ENV` determines which Supabase project to use
- ✅ Use separate resource groups for staging and production (recommended)

## Development Workflow

### Branch Strategy (GitFlow-inspired)

```
main (protected)           ← Production deployments (lock-in-backend)
  ↑
  │ PR with review
  │
develop                    ← Staging deployments (lock-in-dev)
  ↑
  │ PR or direct push
  │
feature/xyz                ← Your feature branches
```

### Day-to-Day Development

#### 1. Start New Feature

```bash
# Always branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/my-feature
```

#### 2. Local Development

```bash
# Extension (with hot reload)
npm run dev

# Backend (separate terminal)
cd backend
npm run dev
```

#### 3. Test in Staging

```bash
# Commit and push to develop
git add .
git commit -m "feat: implement feature XYZ"
git push origin feature/my-feature

# Create PR to develop
gh pr create --base develop --head feature/my-feature

# After merge, staging auto-deploys
```

#### 4. Deploy to Production

```bash
# Create PR from develop to main
gh pr create --base main --head develop --title "Release: $(date +%Y-%m-%d)"

# After approval and merge, production auto-deploys
```

## Environment Variables

### File Structure & Loading Order

Vite/Node.js loads environment files in this order (later overrides earlier):

1. **`.env`** - Committed to git, safe defaults only
2. **`.env.development`** or **`.env.production`** - Mode-specific defaults
3. **`.env.local`** - **YOUR ACTUAL SECRETS** (gitignored, never commit!)

### Visual Hierarchy

```
┌───────────────────────────────────────────────────────────┐
│  .env.local                                    HIGHEST    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   PRIORITY   │
│  YOUR ACTUAL SECRETS                                      │
│  • Real Supabase URLs and keys                            │
│  • Real OpenAI API key                                    │
│  • Real Sentry DSN                                        │
│                                                            │
│  🔒 GITIGNORED - Never committed to git                  │
└───────────────────────────────────────────────────────────┘
                                ▲
                                │
                          OVERRIDES
                                │
┌───────────────────────────┴───────────────────────────────┐
│  .env.development  |  .env.production                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                │
│  MODE-SPECIFIC DEFAULTS                                   │
│  • Dev: Permissive rate limits                            │
│  • Prod: Strict rate limits                               │
│  • Placeholder URLs/keys                                  │
│                                                            │
│  ✅ Committed to git - Safe defaults only                │
└───────────────────────────────────────────────────────────┘
                                ▲
                                │
                          OVERRIDES
                                │
┌───────────────────────────┴───────────────────────────────┐
│  .env                                           LOWEST    │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   PRIORITY   │
│  SHARED DEFAULTS                                          │
│  • Placeholder Supabase URLs                              │
│  • Placeholder API keys                                   │
│  • Default port (3000)                                    │
│                                                            │
│  ✅ Committed to git - Safe defaults only                │
└───────────────────────────────────────────────────────────┘
```

### File Purposes

#### `.env.example`

- **Purpose:** Comprehensive template showing all available variables
- **Audience:** Developers setting up the project for the first time
- **Git Status:** Committed to git
- **Contents:** Placeholder values with documentation

#### `.env`

- **Purpose:** Safe default values that work for basic setup
- **Audience:** All environments (development, CI/CD, production)
- **Git Status:** Committed to git
- **Contents:** Non-sensitive placeholders only

#### `.env.development`

- **Purpose:** Development mode defaults (loaded with `--mode development`)
- **Audience:** Development environment
- **Git Status:** Committed to git
- **Contents:** Dev-specific defaults (e.g., permissive rate limits)

#### `.env.production`

- **Purpose:** Production mode defaults (loaded with `--mode production`)
- **Audience:** Production environment
- **Git Status:** Committed to git
- **Contents:** Prod-specific defaults (e.g., strict rate limits)

#### `.env.local`

- **Purpose:** **YOUR ACTUAL SECRETS**
- **Audience:** Local development only
- **Git Status:** **GITIGNORED** - Never commit!
- **Contents:** Real Supabase URLs, API keys, Sentry DSN

### Variable Naming Conventions

All environment variables use suffixes to indicate their target environment:

| Suffix  | Environment | Example             |
| ------- | ----------- | ------------------- |
| `_DEV`  | Development | `SUPABASE_URL_DEV`  |
| `_PROD` | Production  | `SUPABASE_URL_PROD` |
| (none)  | Shared      | `PORT`, `NODE_ENV`  |

### Backend Configuration

The backend (`backend/config.js`) automatically selects the correct Supabase project based on `NODE_ENV`:

```javascript
// Simplified example
const supabaseUrl =
  process.env.NODE_ENV === 'production'
    ? process.env.SUPABASE_URL_PROD
    : process.env.SUPABASE_URL_DEV;

const supabaseKey =
  process.env.NODE_ENV === 'production'
    ? process.env.SUPABASE_SERVICE_ROLE_KEY_PROD
    : process.env.SUPABASE_SERVICE_ROLE_KEY_DEV;
```

**Key Points:**

- `NODE_ENV=development` → Uses `SUPABASE_URL_DEV`, `SUPABASE_SERVICE_ROLE_KEY_DEV`
- `NODE_ENV=production` → Uses `SUPABASE_URL_PROD`, `SUPABASE_SERVICE_ROLE_KEY_PROD`
- Staging (`lock-in-dev`) uses development Supabase project
- Production (`lock-in-backend`) uses production Supabase project

## Azure Architecture

### Recommended: Separate Resource Groups

Complete isolation for staging and production environments:

```
Azure Subscription
├── Resource Group: lock-in-staging
│   ├── Container App: lock-in-dev
│   ├── Container Registry: lockinacrstaging (or shared)
│   ├── Key Vault: lock-in-kv-staging
│   ├── App Insights: lock-in-insights-staging
│   ├── Log Analytics: lock-in-logs-staging
│   └── Container Environment: lock-in-env-staging
│
└── Resource Group: lock-in-production
    ├── Container App: lock-in-backend
    ├── Container Registry: lockinacrprod (or shared)
    ├── Key Vault: lock-in-kv-prod
    ├── App Insights: lock-in-insights-prod
    ├── Log Analytics: lock-in-logs-prod
    └── Container Environment: lock-in-env-prod
```

**Benefits:**

- ✅ Complete resource isolation
- ✅ Independent RBAC and access policies
- ✅ Separate billing and cost tracking
- ✅ Can delete staging without affecting production
- ✅ Different scaling/performance tiers per environment

**Cost Considerations:**

- More resources = higher cost
- Can use lower tiers for staging (e.g., Consumption tier for Container Apps)
- Container Registry can be shared if needed (use separate repositories)

### Alternative: Shared Resource Group (Not Recommended)

Single resource group with environment suffixes:

```
Azure Subscription
└── Resource Group: lock-in
    ├── Container App: lock-in-dev (staging)
    ├── Container App: lock-in-backend (production)
    ├── Container Registry: lockincr (shared)
    ├── Key Vault: lock-in-kv-staging
    ├── Key Vault: lock-in-kv-prod
    └── Container Environment: lock-in-env (shared)
```

**Drawbacks:**

- ❌ Less isolation (all resources in one RG)
- ❌ Harder to manage RBAC
- ❌ Risk of accidentally affecting production

## Local Development Setup

### First-Time Setup

1. **Copy the template:**

   ```bash
   cp .env.example .env.local
   ```

2. **Fill in your actual credentials in `.env.local`:**

   ```env
   # Supabase Development Project (uszxfuzauetcchwcgufe)
   VITE_SUPABASE_URL_DEV=https://uszxfuzauetcchwcgufe.supabase.co
   VITE_SUPABASE_ANON_KEY_DEV=eyJhbGc... (real key)

   # Supabase Production Project (vtuflatvllpldohhimao) - optional for local dev
   VITE_SUPABASE_URL_PROD=https://vtuflatvllpldohhimao.supabase.co
   VITE_SUPABASE_ANON_KEY_PROD=eyJhbGc... (real key)

   # OpenAI
   VITE_OPENAI_API_KEY=sk-proj-... (real key)

   # Sentry (optional)
   VITE_SENTRY_DSN=https://... (real DSN)
   ```

3. **Build the extension:**

   ```bash
   npm run build
   ```

4. **Run backend locally:**

   ```bash
   cd backend
   npm install
   npm run dev
   ```

### Verification Checklist

#### 1. File Structure

```bash
ls -la .env*
```

**Expected files:**

- ✅ `.env` - Safe defaults (committed)
- ✅ `.env.example` - Template (committed)
- ✅ `.env.development` - Dev mode defaults (committed)
- ✅ `.env.production` - Prod mode defaults (committed)
- ✅ `.env.local` - **YOUR SECRETS** (gitignored)

#### 2. Git Status Check

```bash
git status | Select-String "\.env"
```

**Expected:**

- ✅ `.env`, `.env.development`, `.env.production` - Can be committed
- ✅ `.env.local` - Should NOT appear (gitignored)

#### 3. Security Verification

Check that `.env` has NO real secrets:

```bash
cat .env | Select-String "sk-proj-|eyJhbGc"
```

**Expected:** No matches (safe to commit)

Check that `.env.local` has your real secrets:

```bash
cat .env.local | Select-String "VITE_SUPABASE_ANON_KEY_DEV"
```

**Expected:** Shows your real Supabase anon key

## Deployment Environment Variables

### Azure Container Apps Configuration

Environment variables in Azure Container Apps are set via:

1. **Azure Portal**: Container App > Settings > Containers > Environment variables
2. **Azure CLI**: `az containerapp update --set-env-vars KEY=VALUE`
3. **IaC (Bicep/Terraform)**: In deployment templates

### Required Variables for Staging (lock-in-dev)

```bash
NODE_ENV=development
SUPABASE_URL_DEV=https://uszxfuzauetcchwcgufe.supabase.co
SUPABASE_SERVICE_ROLE_KEY_DEV=<from-key-vault>
SUPABASE_ANON_KEY_DEV=<from-key-vault>
AZURE_OPENAI_API_KEY=<from-key-vault>
AZURE_OPENAI_ENDPOINT=<from-key-vault>
OPENAI_API_KEY=<from-key-vault> # Optional fallback
SENTRY_DSN=<from-key-vault>      # Optional
```

### Required Variables for Production (lock-in-backend)

```bash
NODE_ENV=production
SUPABASE_URL_PROD=https://vtuflatvllpldohhimao.supabase.co
SUPABASE_SERVICE_ROLE_KEY_PROD=<from-key-vault>
SUPABASE_ANON_KEY_PROD=<from-key-vault>
AZURE_OPENAI_API_KEY=<from-key-vault>
AZURE_OPENAI_ENDPOINT=<from-key-vault>
OPENAI_API_KEY=<from-key-vault> # Optional fallback
SENTRY_DSN=<from-key-vault>      # Optional
```

### Using Azure Key Vault References

Instead of storing secrets directly in environment variables, reference Key Vault:

```bash
# Set Key Vault reference (Azure Portal or CLI)
SUPABASE_SERVICE_ROLE_KEY_PROD=@Microsoft.KeyVault(SecretUri=https://lock-in-kv-prod.vault.azure.net/secrets/supabase-service-role-key-prod/)
```

**Benefits:**

- ✅ Secrets never stored in plaintext
- ✅ Centralized secret management
- ✅ Automatic secret rotation
- ✅ Audit logs

## Troubleshooting

### Wrong Supabase Project Used

**Symptom**: Local dev connects to production Supabase.

**Solution**: Check `NODE_ENV` in backend:

```bash
cd backend
cat .env | Select-String "NODE_ENV"
```

Should be `NODE_ENV=development` for local dev.

### Environment Variables Not Loading

**Symptom**: Backend shows "Missing required environment variable".

**Solution**:

1. Check file order: `.env.local` should override `.env`
2. Restart backend: `cd backend; npm run dev`
3. Verify file exists: `ls -la backend/.env.local`

### Production Using Wrong Credentials

**Symptom**: Production Container App uses development Supabase.

**Solution**: Check `NODE_ENV` in Azure Container App:

```bash
az containerapp show \
  --name lock-in-backend \
  --resource-group lock-in-prod \
  --query "properties.template.containers[0].env[?name=='NODE_ENV'].value"
```

Should return `["production"]`.

## Best Practices

### DO

- ✅ Use `.env.local` for all local secrets
- ✅ Commit `.env`, `.env.development`, `.env.production` with safe defaults
- ✅ Use Azure Key Vault for production secrets
- ✅ Use separate Supabase projects for dev and prod
- ✅ Use separate resource groups for staging and production
- ✅ Set `NODE_ENV` correctly in each environment
- ✅ Test in staging before deploying to production

### DON'T

- ❌ Commit `.env.local` to git
- ❌ Store real secrets in `.env`, `.env.development`, `.env.production`
- ❌ Use production Supabase project for local dev
- ❌ Share Supabase projects between staging and production
- ❌ Hardcode secrets in code
- ❌ Use same API keys for dev and prod

## Related Documentation

- [CI/CD Pipeline](./CICD.md) - Automated deployment
- [Azure Deployment](./AZURE.md) - Azure setup guide
- [Rollback](./ROLLBACK.md) - Emergency rollback procedures
