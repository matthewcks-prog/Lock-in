# Lock-in Backend - Azure Container Apps Deployment Guide

## Overview

This guide walks through deploying the Lock-in backend to Azure Container Apps with production-grade configuration including secrets management, monitoring, and CI/CD.

## Prerequisites

- [ ] Azure CLI installed and logged in (`az login`)
- [ ] Docker Desktop installed (for local testing)
- [ ] Supabase project created with database and storage
- [ ] OpenAI API key
- [ ] Sentry account (optional but recommended)

---

## Phase 1: Pre-Deployment Setup

### 1.1 Database Migrations

Run all migrations in order via Supabase SQL Editor:

```bash
# Location: backend/migrations/
001_note_assets.sql
002_performance_indexes.sql
003_note_search_indexes.sql
004_chat_message_assets.sql
005_transcripts_table.sql
006_feedback_table.sql
007_folders_table.sql
008_note_folder_relation.sql
009_transcript_jobs.sql
010_chat_asset_restrictions.sql
011_note_starred_field.sql
```

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

### 1.3 Gather Required Values

Collect these values (you'll need them for Azure setup):

| Variable | Where to Get It |
|----------|-----------------|
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
| `SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API (service_role key) |
| `SENTRY_DSN` | Sentry Dashboard → Project → Settings → Client Keys |

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
- Log Analytics Workspace
- Container Apps Environment
- Container App (initial deployment)

### 3.2 Add Secrets to Key Vault

```bash
# Add required secrets
az keyvault secret set --vault-name lock-in-kv --name OPENAI-API-KEY --value "sk-your-key"
az keyvault secret set --vault-name lock-in-kv --name SUPABASE-URL --value "https://xxx.supabase.co"
az keyvault secret set --vault-name lock-in-kv --name SUPABASE-SERVICE-ROLE-KEY --value "eyJ..."
az keyvault secret set --vault-name lock-in-kv --name SENTRY-DSN --value "https://...@sentry.io/..."
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

# Add secrets from Key Vault
az containerapp secret set \
    --name lock-in-backend \
    --resource-group lock-in-prod \
    --secrets \
        "openai-api-key=keyvaultref:https://lock-in-kv.vault.azure.net/secrets/OPENAI-API-KEY,identityref:system" \
        "supabase-url=keyvaultref:https://lock-in-kv.vault.azure.net/secrets/SUPABASE-URL,identityref:system" \
        "supabase-service-role-key=keyvaultref:https://lock-in-kv.vault.azure.net/secrets/SUPABASE-SERVICE-ROLE-KEY,identityref:system" \
        "sentry-dsn=keyvaultref:https://lock-in-kv.vault.azure.net/secrets/SENTRY-DSN,identityref:system"

# Update environment variables to use secrets
az containerapp update \
    --name lock-in-backend \
    --resource-group lock-in-prod \
    --set-env-vars \
        "OPENAI_API_KEY=secretref:openai-api-key" \
        "SUPABASE_URL=secretref:supabase-url" \
        "SUPABASE_SERVICE_ROLE_KEY=secretref:supabase-service-role-key" \
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

### 4.1 Create Azure Service Principal

```bash
# Get subscription ID
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# Create service principal with contributor role
az ad sp create-for-rbac \
    --name "github-actions-lock-in" \
    --role contributor \
    --scopes /subscriptions/$SUBSCRIPTION_ID/resourceGroups/lock-in-prod \
    --sdk-auth
```

Save the JSON output - you'll need it for GitHub.

### 4.2 Configure GitHub Secrets

Go to GitHub repo → Settings → Secrets and variables → Actions

Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `AZURE_CREDENTIALS` | The JSON from service principal creation |
| `AZURE_CONTAINER_REGISTRY` | `lockinacr` (name only, no .azurecr.io) |
| `AZURE_RESOURCE_GROUP` | `lock-in-prod` |
| `ACR_USERNAME` | ACR admin username (from setup script output) |
| `ACR_PASSWORD` | ACR admin password (from setup script output) |

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
const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://lock-in-backend.azurecontainerapps.io'  // Your actual URL
    : 'http://localhost:3000';
```

### 5.3 Update CORS Origins (if needed)

If deploying a web app frontend, update `backend/config.js`:

```javascript
const ALLOWED_ORIGINS = [
  /^chrome-extension:\/\//,
  /localhost/,
  /^https:\/\/your-web-app\.com$/,  // Add your web app domain
  // ... existing patterns
];
```

---

## Phase 6: Monitoring Setup

### 6.1 Azure Monitor Alerts

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

# Check if Supabase/OpenAI are reachable from container
# Verify secrets are correctly mapped to environment variables
```

### CORS Errors

- Verify origin is in `ALLOWED_ORIGINS` in `backend/config.js`
- Check browser console for exact origin being blocked
- Rebuild and redeploy after updating CORS config

### Transcription Jobs Failing

- Check FFmpeg is available: logs should show "FFmpeg available: true"
- Verify temp directory is writable: `/tmp/transcripts`
- Check OpenAI API key has Whisper access

---

## Cost Optimization

### Resource Sizing

| Workload | CPU | Memory | Min Replicas | Max Replicas |
|----------|-----|--------|--------------|--------------|
| Low (dev) | 0.5 | 1Gi | 0 | 2 |
| Medium | 1.0 | 2Gi | 1 | 5 |
| High | 2.0 | 4Gi | 2 | 10 |

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
