# How to Check Your Azure Container App Deployment

## Current Status (as of Jan 22, 2026)

### ✅ What's Working:

- **CI/CD Workflow**: ✅ Passing (health checks work with GitHub secrets)
- **GitHub Secrets**: ✅ Configured (SUPABASE_URL_DEV, SUPABASE_SERVICE_ROLE_KEY_DEV, SUPABASE_ANON_KEY_DEV)
- **Azure Key Vault**: ✅ Secrets stored (ready for production runtime)
- **Bicep Template**: ✅ Production-ready (health probes, autoscaling, Key Vault integration)

### ⏳ What's Pending:

- **PR #32**: Requires approval before merging to main
- **Image Push to ACR**: Will happen automatically once PR is merged
- **Container App Deployment**: Will update automatically once image is available

---

## Quick Status Check Commands

### 1. Check GitHub Actions Workflow Status

```powershell
# List recent backend deploy workflows
gh run list --workflow=backend-deploy.yml --limit 5

# Watch a specific run in real-time
gh run watch <RUN_ID>

# View detailed logs of the latest run
gh run view --log
```

### 2. Check if Docker Images Are in ACR

```powershell
# List all images in your container registry
az acr repository list --name lockinacr --output table

# List tags for the backend image (shows versions/builds)
az acr repository show-tags --name lockinacr --repository lock-in-backend --output table --orderby time_desc

# Expected output once deployed:
# Result
# --------
# latest
# <commit-sha>
```

### 3. Check Container App Status

```powershell
# Get Container App overview
az containerapp show --name lock-in-dev --resource-group lock-in-dev --query '{status:properties.runningStatus, revision:properties.latestRevisionName, replicas:properties.template.scale}' --output json

# List all revisions (deployment history)
az containerapp revision list --name lock-in-dev --resource-group lock-in-dev --query '[].{name:name, active:properties.active, createdTime:properties.createdTime, trafficWeight:properties.trafficWeight}' --output table

# Check replica status (should show 1 or more running)
az containerapp replica list --name lock-in-dev --resource-group lock-in-dev --output table
```

### 4. Test the Deployed Application

```powershell
# Get the application URL
az containerapp show --name lock-in-dev --resource-group lock-in-dev --query 'properties.configuration.ingress.fqdn' --output tsv

# Test health endpoint
$url = az containerapp show --name lock-in-dev --resource-group lock-in-dev --query 'properties.configuration.ingress.fqdn' --output tsv
Invoke-WebRequest -Uri "https://$url/health" -UseBasicParsing | Select-Object StatusCode, Content

# Expected output:
# StatusCode: 200
# Content: {"status":"ok","timestamp":"..."}
```

### 5. Check Container App Logs (Real-time)

```powershell
# Stream logs from the Container App
az containerapp logs show --name lock-in-dev --resource-group lock-in-dev --follow

# Get recent logs (last 50 lines)
az containerapp logs show --name lock-in-dev --resource-group lock-in-dev --tail 50

# Check for errors
az containerapp logs show --name lock-in-dev --resource-group lock-in-dev --tail 100 | Select-String -Pattern "error|Error|ERROR|failed|Failed"
```

---

## How to Complete the Deployment

### Option 1: Get PR Approved (Recommended)

The PR requires approval from another team member (you can't approve your own PR).

**Steps:**

1. Ask a teammate to review PR #32: https://github.com/matthewcks-prog/Lock-in/pull/32
2. Once approved, merge with:
   ```powershell
   gh pr merge 32 --squash
   ```
3. This will trigger deployment to staging automatically

### Option 2: Bypass Protection (If You Have Admin Access)

If you're the repo owner and need to deploy urgently:

```powershell
# Temporarily disable branch protection (GitHub Settings)
# Then merge:
gh pr merge 32 --squash --admin

# Or push directly to main (not recommended):
git checkout main
git merge develop
git push origin main
```

### Option 3: Manual Deployment (Bypass CI/CD)

If you need to deploy immediately without waiting for PR:

```powershell
# 1. Build and push Docker image manually
cd c:\Users\matth\Lock-in
docker build -t lockinacr.azurecr.io/lock-in-backend:manual -f backend/Dockerfile .

# 2. Login to ACR
az acr login --name lockinacr

# 3. Push image
docker push lockinacr.azurecr.io/lock-in-backend:manual

# 4. Update Container App to use the new image
az containerapp update --name lock-in-dev --resource-group lock-in-dev --image lockinacr.azurecr.io/lock-in-backend:manual
```

---

## Expected Deployment Flow

Once PR #32 is merged to main:

1. **GitHub Actions triggers** (on push to main)
2. **Build phase**: Tests run, Docker image built
3. **Security scan**: Trivy scans image for vulnerabilities
4. **Push to ACR**: Image pushed to `lockinacr.azurecr.io/lock-in-backend:latest`
5. **Deploy to staging**: Container App updated with new image
6. **Health check**: Deployment validates app is healthy
7. **Traffic shift**: New revision receives 100% traffic

**Timeline**: ~5-10 minutes from merge to deployment

---

## Troubleshooting

### Issue: "imagePullBackOff" Error

**Symptoms:**

```powershell
az containerapp show --name lock-in-dev --resource-group lock-in-dev --query 'properties.runningStatus'
# Output: "Running" but revision shows "Failed"
```

**Diagnosis:**

```powershell
# Check if image exists in ACR
az acr repository show-tags --name lockinacr --repository lock-in-backend --output table

# If empty, image wasn't pushed yet
```

**Solution:**

- Merge PR #32 to trigger image build and push
- Or use manual deployment (Option 3 above)

### Issue: Container App Unhealthy

**Symptoms:**

```powershell
# Replicas show 0/1 active
az containerapp replica list --name lock-in-dev --resource-group lock-in-dev
```

**Diagnosis:**

```powershell
# Check logs for startup errors
az containerapp logs show --name lock-in-dev --resource-group lock-in-dev --tail 100
```

**Common causes:**

1. Missing environment variables
2. Database connection failure
3. Port mismatch (app listens on wrong port)
4. Startup timeout (app takes too long to start)

**Solution:**

- Verify secrets in Key Vault: `az keyvault secret list --vault-name lock-in-kv --output table`
- Check Container App configuration matches Bicep template
- Increase startup probe timeout if needed

### Issue: CI/CD Workflow Fails

**Check workflow logs:**

```powershell
gh run list --workflow=backend-deploy.yml --limit 1
gh run view <RUN_ID> --log-failed
```

**Common issues:**

1. **Health check failure**: Missing GitHub secrets → Already fixed in PR #32
2. **Azure login failure**: Federated identity credential issue → Already verified working
3. **Build failure**: Code/dependency issues → Check build logs

---

## Monitoring & Alerts

### Application Insights (Telemetry)

```powershell
# Get Application Insights instrumentation key
az monitor app-insights component show --app lock-in-backend-insights --resource-group lock-in-dev --query 'instrumentationKey'

# Query recent requests
az monitor app-insights query --app lock-in-backend-insights --resource-group lock-in-dev --analytics-query "requests | take 10" --offset 1h
```

### Log Analytics (Centralized Logs)

```powershell
# Query Container App logs via Log Analytics
az monitor log-analytics query --workspace lock-in-backend-logs --analytics-query "ContainerAppConsoleLogs_CL | take 10" --timespan P1D
```

### Azure Portal (Visual Monitoring)

1. Navigate to: https://portal.azure.com
2. Go to: Resource Groups → lock-in-dev → lock-in-dev (Container App)
3. Check:
   - **Overview**: Status, URL, replicas
   - **Revisions**: Deployment history, traffic split
   - **Metrics**: CPU, memory, requests
   - **Log stream**: Real-time logs

---

## Current Deployment URLs

### Staging Environment

- **Container App**: https://lock-in-dev.bluerock-d7ffba56.australiaeast.azurecontainerapps.io
- **Health Endpoint**: https://lock-in-dev.bluerock-d7ffba56.australiaeast.azurecontainerapps.io/health
- **API Base**: https://lock-in-dev.bluerock-d7ffba56.australiaeast.azurecontainerapps.io/api

### Production Environment (Future)

- Will be deployed to `lock-in-backend` Container App (when you merge to main and pass manual approval)

---

## Next Steps

1. **Get PR #32 approved and merged** → Triggers automatic deployment
2. **Verify deployment** → Use commands above to check status
3. **Test the application** → Hit health endpoint, verify functionality
4. **Monitor logs** → Watch for any errors during startup
5. **Apply Bicep template updates** → Deploy health probes and autoscaling (optional)

---

## Summary

**Right now:**

- ✅ Everything is configured correctly
- ✅ CI/CD workflow passes
- ✅ Secrets are stored securely
- ⏳ Waiting for PR approval to trigger actual deployment

**Once PR #32 is merged:**

- Container App will automatically update
- New revision will be created
- Application will be accessible at the URL above
- imagePullBackOff error will be resolved (image will exist in ACR)

---

**PR to merge**: https://github.com/matthewcks-prog/Lock-in/pull/32  
**Workflow to watch**: https://github.com/matthewcks-prog/Lock-in/actions/workflows/backend-deploy.yml
