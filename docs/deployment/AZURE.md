# Lock-in Backend - Azure Container Apps Deployment Guide

## Overview

This guide walks through deploying the Lock-in backend to Azure Container Apps with production-grade configuration including secrets management, monitoring, and CI/CD.

## Environment Strategy

Lock-in uses **two separate Supabase projects** for environment isolation:

| Environment     | Supabase Project       | Use Case                    |
| --------------- | ---------------------- | --------------------------- |
| **Development** | `uszxfuzauetcchwcgufe` | Local dev, staging, testing |
| **Production**  | `vtuflatvllpldohhimao` | Real users, real data       |

**Key Principles:**

- Production credentials stored in Azure Key Vault ONLY (never in .env files)
- Development credentials can be in local .env files (gitignored)
- Environment variables use `_DEV` and `_PROD` suffixes
- `NODE_ENV` determines which Supabase project to use

**Backend Configuration:**

The backend automatically selects the correct Supabase project based on `NODE_ENV`:

- `NODE_ENV=development` → Uses `SUPABASE_URL_DEV`, `SUPABASE_SERVICE_ROLE_KEY_DEV`
- `NODE_ENV=production` → Uses `SUPABASE_URL_PROD`, `SUPABASE_SERVICE_ROLE_KEY_PROD`

## Prerequisites

- [ ] Azure CLI installed and logged in (`az login`)
- [ ] Docker Desktop installed (for local testing)
- [ ] Supabase projects created (dev AND prod)
- [ ] Azure OpenAI resource + deployments (gpt-4o-mini, text-embedding-3-small, whisper-1)
- [ ] OpenAI API key (optional fallback)
- [ ] Sentry account (optional but recommended)

---

## Phase 1: Pre-Deployment Setup

### 1.1 Database Migrations

Push migrations to production using Supabase CLI:

```bash
# Link to production project (one-time)
npx supabase link --project-ref vtuflatvllpldohhimao

# Push all migrations to production
npx supabase db push

# Migrations location: supabase/migrations/
# 001_note_assets.sql          - Note attachments table + RLS
# 002_performance_indexes.sql  - Query performance indexes
# 003_row_level_security.sql   - RLS policies for all tables
# 004_vector_extension_schema.sql  - pgvector schema fix
# 005_starred_notes.sql        - Starred notes feature
# 006_transcripts.sql          - Transcript tables + RLS
# 007_transcripts_hardening.sql    - State machine + chunk tracking
# 008_transcript_privacy_hardening.sql  - Privacy: TTL + URL redaction
# 009_feedback.sql             - User feedback table
# 010_chat_assets.sql          - Chat message attachments
# 011_chat_assets_cleanup.sql  - Orphan cleanup function
# 012_transcript_storage_and_limits.sql - Transcript durability
```

> **Note**: All migrations are idempotent and safe to re-run. They use
> `IF NOT EXISTS`, `DROP POLICY IF EXISTS`, and conditional blocks.

**Critical**: After running migrations, verify pgvector extension:

```sql
-- Verify pgvector is installed
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Set search_path for all roles
ALTER ROLE authenticator SET search_path = public, extensions;
ALTER ROLE anon SET search_path = public, extensions;
ALTER ROLE authenticated SET search_path = public, extensions;
ALTER ROLE service_role SET search_path = public, extensions;
```

### 1.2 Create Supabase Storage Buckets

In Supabase Dashboard → Storage:

1. Create bucket: `note-assets` (private)
2. Create bucket: `chat-assets` (private)
3. Configure RLS policies for user isolation

### 1.3 Azure OpenAI Setup (Portal or CLI)

Create an Azure OpenAI resource and deployments for the models used by Lock-in:

**Required deployments:**

- `gpt-4o-mini` (chat)
- `text-embedding-3-small` (embeddings)
- `whisper-1` (transcription)

**Portal (recommended):**

1. Create an Azure OpenAI resource in your target region.
2. Open the resource and create deployments for the three models above.
3. Record the deployment names you choose (used in env vars).

**CLI (example):**

```bash
OPENAI_RG="lock-in-prod"
OPENAI_NAME="lock-in-openai"
OPENAI_LOCATION="australiaeast"

az cognitiveservices account create \
  --name "$OPENAI_NAME" \
  --resource-group "$OPENAI_RG" \
  --location "$OPENAI_LOCATION" \
  --kind OpenAI \
  --sku S0 \
  --custom-domain "$OPENAI_NAME"

# List available model versions in your region:
az cognitiveservices account list-models \
  --name "$OPENAI_NAME" \
  --resource-group "$OPENAI_RG" \
  --query "[].{name:name,version:version}" -o table

# Deploy models (replace <MODEL_VERSION> with available versions)
az cognitiveservices account deployment create \
  --name "$OPENAI_NAME" \
  --resource-group "$OPENAI_RG" \
  --deployment-name "gpt-4o-mini" \
  --model-name "gpt-4o-mini" \
  --model-version "<MODEL_VERSION>" \
  --model-format OpenAI

az cognitiveservices account deployment create \
  --name "$OPENAI_NAME" \
  --resource-group "$OPENAI_RG" \
  --deployment-name "text-embedding-3-small" \
  --model-name "text-embedding-3-small" \
  --model-version "<MODEL_VERSION>" \
  --model-format OpenAI

az cognitiveservices account deployment create \
  --name "$OPENAI_NAME" \
  --resource-group "$OPENAI_RG" \
  --deployment-name "whisper-1" \
  --model-name "whisper-1" \
  --model-version "<MODEL_VERSION>" \
  --model-format OpenAI
```

### 1.4 Gather Required Values

Collect these values for **EACH ENVIRONMENT**:

**Development Supabase (uszxfuzauetcchwcgufe):**

| Variable                        | Where to Get It                                        |
| ------------------------------- | ------------------------------------------------------ |
| `SUPABASE_URL_DEV`              | Supabase Dashboard → Settings → API (dev project)      |
| `SUPABASE_ANON_KEY_DEV`         | Supabase Dashboard → Settings → API (anon key)         |
| `SUPABASE_SERVICE_ROLE_KEY_DEV` | Supabase Dashboard → Settings → API (service_role key) |

**Production Supabase (vtuflatvllpldohhimao):**

| Variable                         | Where to Get It                                        |
| -------------------------------- | ------------------------------------------------------ |
| `SUPABASE_URL_PROD`              | Supabase Dashboard → Settings → API (prod project)     |
| `SUPABASE_ANON_KEY_PROD`         | Supabase Dashboard → Settings → API (anon key)         |
| `SUPABASE_SERVICE_ROLE_KEY_PROD` | Supabase Dashboard → Settings → API (service_role key) |

**Azure OpenAI (primary provider):**

| Variable                                | Where to Get It                                            |
| --------------------------------------- | ---------------------------------------------------------- |
| `AZURE_OPENAI_API_KEY`                  | Azure OpenAI resource → Keys and Endpoint                  |
| `AZURE_OPENAI_ENDPOINT`                 | Azure OpenAI resource → Keys and Endpoint                  |
| `AZURE_OPENAI_API_VERSION`              | Use `2024-02-01` unless your resource requires a newer API |
| `AZURE_OPENAI_CHAT_DEPLOYMENT`          | Deployment name for `gpt-4o-mini`                          |
| `AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT`    | Deployment name for `text-embedding-3-small`               |
| `AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT` | Deployment name for `whisper-1`                            |

**Shared Credentials:**

| Variable         | Where to Get It                                      |
| ---------------- | ---------------------------------------------------- |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys (fallback only) |
| `SENTRY_DSN`     | Sentry Dashboard → Project → Settings → Client Keys  |

---

## Phase 2: Local Testing

### 2.1 Test Docker Build Locally

```powershell
# Navigate to project root
cd C:\Users\matth\Lock-in

# Create .env file from template
cp backend/.env.example .env
# Edit .env with your actual values

# Build and run with docker-compose
docker-compose up --build

# In another terminal, test health endpoint
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "message": "Lock-in API is running",
  "limits": {
    "maxSelectionLength": 5000,
    "maxUserMessageLength": 1500
  }
}
```

### 2.2 Test Key Endpoints

```bash
# Health check (no auth)
curl http://localhost:3000/health

# With auth token (get from Supabase auth)
TOKEN="your-jwt-token"

# Test notes endpoint
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/notes

# Test chats endpoint
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/chats
```

---

## Phase 3: Azure Infrastructure Setup

### 3.1 Run Setup Script

```powershell
# From project root
.\scripts\azure-setup.ps1 `
    -ResourceGroup "lock-in-prod" `
    -Location "australiaeast" `
    -AppName "lock-in-backend" `
    -AcrName "lockinacr" `
    -KeyVaultName "lock-in-kv"
```

This creates:

- Resource Group
- Azure Container Registry (ACR)
- Azure Key Vault
- Azure OpenAI resource + deployments
- Log Analytics Workspace
- Container Apps Environment
- Container App (initial deployment)

### 3.2 Add Secrets to Key Vault

**Production secrets (for PROD deployment):**

```bash
# Add production secrets
az keyvault secret set --vault-name lock-in-kv --name AZURE-OPENAI-API-KEY --value "your-azure-openai-key"
az keyvault secret set --vault-name lock-in-kv --name AZURE-OPENAI-ENDPOINT --value "https://your-openai-resource.openai.azure.com/"
az keyvault secret set --vault-name lock-in-kv --name OPENAI-API-KEY --value "sk-your-key"
az keyvault secret set --vault-name lock-in-kv --name SUPABASE-URL-PROD --value "https://vtuflatvllpldohhimao.supabase.co"
az keyvault secret set --vault-name lock-in-kv --name SUPABASE-ANON-KEY-PROD --value "your-prod-anon-key"
az keyvault secret set --vault-name lock-in-kv --name SUPABASE-SERVICE-ROLE-KEY-PROD --value "eyJ..."
az keyvault secret set --vault-name lock-in-kv --name SENTRY-DSN --value "https://...@sentry.io/..."
```

**Development secrets (for STAGING deployment, optional):**

```bash
# Add dev secrets (only if deploying staging environment to Azure)
az keyvault secret set --vault-name lock-in-kv-dev --name SUPABASE-URL-DEV --value "https://uszxfuzauetcchwcgufe.supabase.co"
az keyvault secret set --vault-name lock-in-kv-dev --name SUPABASE-SERVICE-ROLE-KEY-DEV --value "eyJ..."
```

### 3.3 Configure Container App Secrets

```bash
# Enable system-assigned managed identity
az containerapp identity assign \
    --name lock-in-backend \
    --resource-group lock-in-prod \
    --system-assigned

# Grant Key Vault access to managed identity
IDENTITY_ID=$(az containerapp show --name lock-in-backend --resource-group lock-in-prod --query identity.principalId -o tsv)

az keyvault set-policy \
    --name lock-in-kv \
    --object-id $IDENTITY_ID \
    --secret-permissions get list

# Add secrets from Key Vault (PRODUCTION deployment)
az containerapp secret set \
    --name lock-in-backend \
    --resource-group lock-in-prod \
    --secrets \
        "azure-openai-api-key=keyvaultref:https://lock-in-kv.vault.azure.net/secrets/AZURE-OPENAI-API-KEY,identityref:system" \
        "azure-openai-endpoint=keyvaultref:https://lock-in-kv.vault.azure.net/secrets/AZURE-OPENAI-ENDPOINT,identityref:system" \
        "openai-api-key=keyvaultref:https://lock-in-kv.vault.azure.net/secrets/OPENAI-API-KEY,identityref:system" \
        "supabase-url-prod=keyvaultref:https://lock-in-kv.vault.azure.net/secrets/SUPABASE-URL-PROD,identityref:system" \
        "supabase-service-role-key-prod=keyvaultref:https://lock-in-kv.vault.azure.net/secrets/SUPABASE-SERVICE-ROLE-KEY-PROD,identityref:system" \
        "sentry-dsn=keyvaultref:https://lock-in-kv.vault.azure.net/secrets/SENTRY-DSN,identityref:system"

# Update environment variables to use secrets (PRODUCTION)
az containerapp update \
    --name lock-in-backend \
    --resource-group lock-in-prod \
    --set-env-vars \
        "AZURE_OPENAI_API_KEY=secretref:azure-openai-api-key" \
        "AZURE_OPENAI_ENDPOINT=secretref:azure-openai-endpoint" \
        "AZURE_OPENAI_API_VERSION=2024-02-01" \
        "AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o-mini" \
        "AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT=text-embedding-3-small" \
        "AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT=whisper-1" \
        "OPENAI_API_KEY=secretref:openai-api-key" \
        "OPENAI_FALLBACK_ENABLED=true" \
        "SUPABASE_URL_PROD=secretref:supabase-url-prod" \
        "SUPABASE_SERVICE_ROLE_KEY_PROD=secretref:supabase-service-role-key-prod" \
        "SENTRY_DSN=secretref:sentry-dsn" \
        "NODE_ENV=production" \
        "PORT=3000" \
        "TRANSCRIPTION_TEMP_DIR=/tmp/transcripts"
```

### 3.4 Configure Health Probes

```bash
az containerapp update \
    --name lock-in-backend \
    --resource-group lock-in-prod \
    --container-name lock-in-backend \
    --yaml - <<EOF
properties:
  template:
    containers:
      - name: lock-in-backend
        probes:
          - type: Liveness
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 30
            failureThreshold: 3
          - type: Readiness
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3
EOF
```

### 3.5 Configure Autoscaling

```bash
az containerapp update \
    --name lock-in-backend \
    --resource-group lock-in-prod \
    --min-replicas 1 \
    --max-replicas 5 \
    --scale-rule-name http-scaling \
    --scale-rule-type http \
    --scale-rule-http-concurrency 100
```

---

## Phase 4: GitHub Actions CI/CD

### 4.1 Configure OIDC (Managed Identity)

```powershell
# From repo root (edit config values at top if needed)
.\setup_uami.ps1
```

This creates a user-assigned managed identity, assigns roles, and configures
federated credentials for GitHub Actions.

### 4.2 Configure GitHub Secrets

Go to GitHub repo → Settings → Secrets and variables → Actions

Add these secrets:

| Secret Name                    | Value                                   |
| ------------------------------ | --------------------------------------- |
| `AZURE_CLIENT_ID`              | Managed identity client ID              |
| `AZURE_TENANT_ID`              | Azure AD tenant ID                      |
| `AZURE_SUBSCRIPTION_ID`        | Azure subscription ID                   |
| `AZURE_CONTAINER_REGISTRY`     | `lockinacr` (name only, no .azurecr.io) |
| `AZURE_RESOURCE_GROUP`         | `lock-in-prod`                          |
| `AZURE_RESOURCE_GROUP_STAGING` | `lock-in-dev`                           |

### 4.3 Create Production Environment

1. Go to GitHub repo → Settings → Environments
2. Create environment: `production`
3. Add protection rules (optional):
   - Required reviewers
   - Wait timer

### 4.4 Test CI/CD Pipeline

```bash
# Push a change to main branch
git add .
git commit -m "feat: Azure Container Apps deployment"
git push origin main
```

Watch the Actions tab for the pipeline run.

---

## Phase 5: Update Extension Configuration

### 5.1 Get Container App URL

```bash
az containerapp show \
    --name lock-in-backend \
    --resource-group lock-in-prod \
    --query "properties.configuration.ingress.fqdn" -o tsv
```

### 5.2 Update API Client

Edit `api/client.ts`:

```typescript
// Change from:
const API_BASE_URL = 'http://localhost:3000';

// To production URL:
const API_BASE_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://lock-in-backend.azurecontainerapps.io' // Your actual URL
    : 'http://localhost:3000';
```

### 5.3 Update CORS Origins (if needed)

If deploying a web app frontend, update `backend/config/index.js`:

```javascript
const ALLOWED_ORIGINS = [
  /^chrome-extension:\/\//,
  /localhost/,
  /^https:\/\/your-web-app\.com$/, // Add your web app domain
  // ... existing patterns
];
```

---

## Phase 6: Monitoring Setup

### 6.1 Azure OpenAI Diagnostic Settings (Recommended)

Enable diagnostic logging on your Azure OpenAI resource to track usage, costs, and troubleshoot issues:

1. **Azure Portal** → Azure OpenAI resource (`lock-in-openai-dev`)
2. **Monitoring** → **Diagnostic settings** → **Add diagnostic setting**
3. Configure:
   - **Name**: `lock-in-openai-diagnostics`
   - **Logs** (check all):
     - ✅ Audit
     - ✅ Request and Response Logs
     - ✅ Azure OpenAI Request Usage
     - ✅ Trace Logs
   - **Metrics**:
     - ✅ AllMetrics
   - **Destination**: Send to Log Analytics workspace
     - Create new workspace in `lock-in-prod` resource group if needed

**Benefits**:

- Track token usage per model/deployment
- Monitor request latency and errors
- Debug failed API calls with request/response details
- Cost analysis via Log Analytics queries

### 6.2 Application Insights (Recommended)

The backend now supports Azure Application Insights for Azure-native APM:

1. **Create Application Insights resource**:

   ```bash
   # Create Log Analytics workspace (if not exists)
   az monitor log-analytics workspace create \
       --name lock-in-logs \
       --resource-group lock-in-prod \
       --location australiaeast

   # Create Application Insights
   az monitor app-insights component create \
       --app lock-in-backend-insights \
       --resource-group lock-in-prod \
       --location australiaeast \
       --workspace lock-in-logs
   ```

2. **Get connection string**:

   ```bash
   az monitor app-insights component show \
       --app lock-in-backend-insights \
       --resource-group lock-in-prod \
       --query connectionString -o tsv
   ```

3. **Add to Key Vault**:

   ```bash
   az keyvault secret set \
       --vault-name lock-in-secrets \
       --name "APPLICATIONINSIGHTS-CONNECTION-STRING" \
       --value "InstrumentationKey=xxx;IngestionEndpoint=..."
   ```

4. **Add to Container App environment**:
   ```bash
   az containerapp update \
       --name lock-in-backend \
       --resource-group lock-in-prod \
       --set-env-vars "APPLICATIONINSIGHTS_CONNECTION_STRING=secretref:applicationinsights-connection-string"
   ```

**What you get**:

- Request tracing with correlation IDs
- Dependency tracking (Supabase, Azure OpenAI calls)
- Performance metrics and latency histograms
- Live metrics stream in Azure Portal
- Custom LLM token usage metrics

### 6.3 Azure Monitor Alerts

```bash
# Create alert for high error rate
az monitor metrics alert create \
    --name "lock-in-high-errors" \
    --resource-group lock-in-prod \
    --scopes "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/lock-in-prod/providers/Microsoft.App/containerApps/lock-in-backend" \
    --condition "count requests where resultCode >= 500 > 10" \
    --window-size 5m \
    --evaluation-frequency 1m

# Create alert for high CPU
az monitor metrics alert create \
    --name "lock-in-high-cpu" \
    --resource-group lock-in-prod \
    --scopes "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/lock-in-prod/providers/Microsoft.App/containerApps/lock-in-backend" \
    --condition "avg CpuUsage > 80" \
    --window-size 5m \
    --evaluation-frequency 1m
```

### 6.2 Sentry Alerts

Configure in Sentry Dashboard:

- Error rate threshold alerts
- New issue notifications
- Weekly error digest

### 6.3 View Logs

```bash
# Stream live logs
az containerapp logs show \
    --name lock-in-backend \
    --resource-group lock-in-prod \
    --follow

# Query logs via Log Analytics
az monitor log-analytics query \
    --workspace lock-in-backend-logs \
    --analytics-query "ContainerAppConsoleLogs_CL | where ContainerAppName_s == 'lock-in-backend' | order by TimeGenerated desc | take 100"
```

---

## Verification Checklist

### Post-Deployment Tests

```bash
APP_URL="https://your-app.azurecontainerapps.io"
TOKEN="your-test-jwt-token"

# Health check
curl $APP_URL/health

# Auth-required endpoints (use valid JWT)
curl -H "Authorization: Bearer $TOKEN" $APP_URL/api/notes
curl -H "Authorization: Bearer $TOKEN" $APP_URL/api/chats

# Test file upload (with a small file)
curl -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@test-image.png" \
    $APP_URL/api/notes/note-id/assets
```

### Verification Checklist

- [ ] `/health` returns 200 OK
- [ ] Notes CRUD operations work
- [ ] Chat operations work
- [ ] File uploads work (note assets, chat assets)
- [ ] AI responses work (POST /api/lockin)
- [ ] Transcription jobs work
- [ ] Sentry receives errors (test with `/debug-sentry` in dev)
- [ ] Logs appear in Azure Monitor
- [ ] Autoscaling triggers under load
- [ ] Graceful shutdown works (check logs on redeploy)

---

## Troubleshooting

### Container Won't Start

```bash
# Check container logs
az containerapp logs show --name lock-in-backend --resource-group lock-in-prod

# Common issues:
# - Missing environment variables (check secrets are set)
# - Invalid secrets (verify Key Vault values)
# - Port mismatch (should be 3000)
```

### Health Check Failing

```bash
# Test locally first
docker run -p 3000:3000 --env-file .env lockinacr.azurecr.io/lock-in-backend:latest
curl http://localhost:3000/health

# Check if Supabase/Azure OpenAI are reachable from container (and fallback if configured)
# Verify secrets are correctly mapped to environment variables
```

### CORS Errors

- Verify origin is in `ALLOWED_ORIGINS` in `backend/config/index.js`
- Check browser console for exact origin being blocked
- Rebuild and redeploy after updating CORS config

### Transcription Jobs Failing

- Check FFmpeg is available: logs should show "FFmpeg available: true"
- Verify temp directory is writable: `/tmp/transcripts`
- Check Azure OpenAI deployment includes `whisper-1` (or OpenAI fallback has Whisper access)

---

## Cost Optimization

### Resource Sizing

| Workload  | CPU | Memory | Min Replicas | Max Replicas |
| --------- | --- | ------ | ------------ | ------------ |
| Low (dev) | 0.5 | 1Gi    | 0            | 2            |
| Medium    | 1.0 | 2Gi    | 1            | 5            |
| High      | 2.0 | 4Gi    | 2            | 10           |

### Cost-Saving Tips

1. **Scale to zero in dev**: Set `--min-replicas 0` for non-production
2. **Right-size resources**: Start with 0.5 CPU / 1Gi, increase if needed
3. **Use spot instances**: Not available for Container Apps, but consider AKS
4. **Monitor and adjust**: Review metrics weekly, adjust scaling rules

---

## Rollback Procedure

```bash
# List available revisions
az containerapp revision list \
    --name lock-in-backend \
    --resource-group lock-in-prod \
    --output table

# Activate previous revision
az containerapp revision activate \
    --name lock-in-backend \
    --resource-group lock-in-prod \
    --revision lock-in-backend--previous-revision-name

# Route traffic to previous revision
az containerapp ingress traffic set \
    --name lock-in-backend \
    --resource-group lock-in-prod \
    --revision-weight lock-in-backend--previous-revision-name=100
```

---

## Security Checklist

- [ ] Secrets stored in Azure Key Vault (not environment variables)
- [ ] Managed identity for Key Vault access
- [ ] HTTPS-only ingress enabled
- [ ] Non-root container user
- [ ] Rate limiting configured (app-level)
- [ ] CORS restricted to known origins
- [ ] Supabase RLS policies active
- [ ] Sentry PII scrubbing enabled
- [ ] Container image vulnerability scanning enabled
