# Deployment Issue Resolution Guide

## Issue Summary

**Date:** January 22, 2026  
**Status:** Container App running but unable to pull images  
**Root Cause:** GitHub Actions CI/CD pipeline failing due to missing Supabase environment secrets

## Current State

- ✅ Azure infrastructure deployed (Container App, ACR, Key Vault, etc.)
- ✅ Bicep templates validated and production-ready
- ❌ CI/CD workflows failing - no images pushed to ACR
- ❌ Container App in `imagePullBackOff` state (no image available)

## Root Cause Analysis

1. Backend CI workflow requires Supabase connection to validate health endpoint
2. GitHub Actions secrets missing: `SUPABASE_URL_DEV`, `SUPABASE_SERVICE_ROLE_KEY_DEV`, `SUPABASE_ANON_KEY_DEV`
3. Without passing health checks, workflow fails before pushing image to ACR
4. Container App configured with image `lockinacr.azurecr.io/lock-in-backend:latest` but no such image exists

## Resolution Steps (Following Best Practices)

### Step 1: Add Supabase Secrets to GitHub (Secure Method)

**Option A: Using GitHub CLI (Recommended)**

```powershell
# Set secrets from prompts (won't show in history)
gh secret set SUPABASE_URL_DEV
gh secret set SUPABASE_SERVICE_ROLE_KEY_DEV
gh secret set SUPABASE_ANON_KEY_DEV

# Verify secrets were added
gh secret list
```

**Option B: Using GitHub Web UI**

1. Go to: https://github.com/matthewcks-prog/Lock-in/settings/secrets/actions
2. Click "New repository secret"
3. Add each secret:
   - Name: `SUPABASE_URL_DEV`
   - Value: `https://uszxfuzauetcchwcgufe.supabase.co`
   - Click "Add secret"
4. Repeat for `SUPABASE_SERVICE_ROLE_KEY_DEV` and `SUPABASE_ANON_KEY_DEV`

**Security Note:** These values should come from your Supabase project dashboard. Never commit these to Git or share them publicly.

### Step 2: Update GitHub Actions Workflow

The workflow needs access to these secrets. Add to [backend-deploy.yml](../../.github/workflows/backend-deploy.yml):

```yaml
# In the "Wait for container to be healthy" step environment
env:
  SUPABASE_URL_DEV: ${{ secrets.SUPABASE_URL_DEV }}
  SUPABASE_SERVICE_ROLE_KEY_DEV: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY_DEV }}
  SUPABASE_ANON_KEY_DEV: ${{ secrets.SUPABASE_ANON_KEY_DEV }}
```

### Step 3: Store Secrets in Azure Key Vault (Production Best Practice)

For production deployment, secrets should be stored in Azure Key Vault, not GitHub:

```powershell
# Add Supabase secrets to Key Vault
az keyvault secret set --vault-name lock-in-kv --name SUPABASE-URL-DEV --value "https://uszxfuzauetcchwcgufe.supabase.co"
az keyvault secret set --vault-name lock-in-kv --name SUPABASE-ANON-KEY-DEV --value "your-anon-key"
az keyvault secret set --vault-name lock-in-kv --name SUPABASE-SERVICE-ROLE-KEY-DEV --value "your-service-role-key"
```

### Step 4: Trigger CI/CD Pipeline

After adding secrets:

```powershell
# Option 1: Manual workflow dispatch
gh workflow run backend-deploy.yml -f environment=staging

# Option 2: Push to develop branch (triggers auto-deploy)
git commit --allow-empty -m "trigger: rebuild after secrets configuration"
git push origin develop
```

### Step 5: Verify Deployment

```powershell
# Watch workflow progress
gh run watch

# Once workflow succeeds, check Container App
az containerapp show --name lock-in-dev --resource-group lock-in-dev --query '{status:properties.runningStatus, provisioning:properties.provisioningState, replicas:properties.latestRevisionName}'

# Test health endpoint
curl https://lock-in-dev.bluerock-d7ffba56.australiaeast.azurecontainerapps.io/health
```

## Security & Compliance Checklist

- [ ] Secrets never committed to Git
- [ ] GitHub secrets used for CI/CD only (not production runtime)
- [ ] Azure Key Vault used for production runtime secrets
- [ ] Managed Identity configured for Key Vault access (no API keys)
- [ ] Secrets rotation policy documented
- [ ] Environment separation maintained (dev vs prod)
- [ ] Audit logging enabled (Azure Monitor + GitHub audit log)

## Industry Best Practices Applied

✅ **Secrets Management**

- GitHub Secrets for CI/CD pipeline
- Azure Key Vault for runtime secrets
- Managed Identity for authentication (no hardcoded credentials)

✅ **Environment Isolation**

- Separate Supabase projects for dev/prod
- Different Azure resource groups (lock-in-dev vs lock-in-prod)
- Environment-specific secrets naming convention

✅ **Deployment Safety**

- Health checks before marking deployment successful
- Blue-green deployment via Container App revisions
- Rollback capability via previous revisions

✅ **Monitoring & Observability**

- Application Insights for telemetry
- Log Analytics for centralized logging
- Sentry for error tracking
- Health endpoints for liveness probes

## Next Steps

1. Add missing GitHub secrets (see Step 1)
2. Update workflow file (see Step 2)
3. Migrate to Key Vault (see Step 3)
4. Trigger pipeline (see Step 4)
5. Verify deployment (see Step 5)

## Support Resources

- **GitHub Actions Documentation:** https://docs.github.com/en/actions
- **Azure Key Vault Best Practices:** https://learn.microsoft.com/en-us/azure/key-vault/general/best-practices
- **Container Apps Secrets:** https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets
- **Monash IT Security:** https://www.monash.edu/esolutions/it-security

---

**Created:** 2026-01-22  
**Last Updated:** 2026-01-22  
**Status:** Ready for implementation
