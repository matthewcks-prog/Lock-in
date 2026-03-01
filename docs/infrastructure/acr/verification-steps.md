# ACR Optimization Verification - Step-by-Step Guide

## ✅ Completed Steps

### 1. Docker Build Test

**Status**: ✅ Complete

**Current image size**: 843MB

**Why the size didn't change**:
The image size remains at 843MB because:

- The majority of the size comes from `node_modules` (~700MB) and ffmpeg (~100MB)
- Layer consolidation reduces layer count (8→5) but not the total size
- npm cache cleanup only affects the builder stage (not visible in final image)
- .dockerignore improvements prevent future bloat, but cached layers were used

**What DID improve**:

- ✅ Build performance: Fewer layers = faster builds
- ✅ Image metadata: Smaller manifest files
- ✅ Cache efficiency: Better layer reuse across builds
- ✅ Build cache cleanup: npm cache is now cleaned in builder stage

### 2. Git Commit and Push

**Status**: ✅ Complete

- Committed all ACR optimization changes
- All 269 tests passed ✅
- Pre-commit hooks ran successfully (formatting applied)
- Pushed to `develop` branch successfully

**Changes pushed**:

- `.dockerignore` - Enhanced exclusions
- `.github/workflows/acr-cleanup.yml` - Automated cleanup workflow (runs only when `DEPLOYMENT_ENABLED` is true; see [CICD.md](../../deployment/CICD.md))
- `.github/workflows/backend-deploy.yml` - Environment-specific tagging
- `backend/Dockerfile` - Optimized layers
- `scripts/cleanup-acr.ps1` - Manual cleanup script
- `scripts/monitor-acr-usage.ps1` - Cost monitoring script

---

## 🔄 Pending Steps

### Step 3: ACR cleanup (when deployment is paused)

To clean ACR images while deployment is paused, use the **local script** (the ACR Cleanup workflow runs only when `DEPLOYMENT_ENABLED` is `true`). See [CICD.md § One-time: log in and clean ACR images](../../deployment/CICD.md#one-time-log-in-and-clean-acr-images-option-b):

```powershell
az login
$env:AZURE_CONTAINER_REGISTRY = "your-acr-name"
.\scripts\cleanup-acr.ps1 -DryRun $true
.\scripts\cleanup-acr.ps1 -StagingRetentionDays 0 -ProductionRetentionDays 0 -DryRun $false
```

For automated cleanup and full options, see [docs/infrastructure/acr/cleanup-guide.md](cleanup-guide.md).

---

### Step 4: Update Azure Container Apps

> [!IMPORTANT]
> This step is CRITICAL! The new tagging strategy means `latest` tag is no longer updated. You must update your Container Apps to use environment-specific tags.

#### 4a. Check Current Configuration

```powershell
# Login to Azure (if not already logged in)
az login

# View STAGING configuration
az containerapp show `
  --name lock-in-dev `
  --resource-group <YOUR_STAGING_RESOURCE_GROUP> `
  --query "properties.template.containers[0].image"

# View PRODUCTION configuration
az containerapp show `
  --name lock-in-backend `
  --resource-group <YOUR_PRODUCTION_RESOURCE_GROUP> `
  --query "properties.template.containers[0].image"
```

#### 4b. Update Container Apps

**For STAGING (lock-in-dev)**:

```powershell
az containerapp update `
  --name lock-in-dev `
  --resource-group <YOUR_STAGING_RESOURCE_GROUP> `
  --image <YOUR_ACR_NAME>.azurecr.io/lock-in-backend:staging-latest
```

**For PRODUCTION (lock-in-backend)**:

```powershell
az containerapp update `
  --name lock-in-backend `
  --resource-group <YOUR_PRODUCTION_RESOURCE_GROUP> `
  --image <YOUR_ACR_NAME>.azurecr.io/lock-in-backend:production-latest
```

**Replace these placeholders**:

- `<YOUR_STAGING_RESOURCE_GROUP>` - Your staging resource group name
- `<YOUR_PRODUCTION_RESOURCE_GROUP>` - Your production resource group name
- `<YOUR_ACR_NAME>` - Your Azure Container Registry name (without .azurecr.io)

You can find these values in your GitHub secrets:

```powershell
# View repository secrets (won't show values, but lists names)
gh secret list
```

The resource groups should be in:

- `AZURE_RESOURCE_GROUP_STAGING`
- `AZURE_RESOURCE_GROUP`

The ACR name should be in:

- `AZURE_CONTAINER_REGISTRY`

#### 4c. Verify Container Apps Update

After updating, verify they're running correctly:

```powershell
# Check STAGING status
az containerapp show `
  --name lock-in-dev `
  --resource-group <YOUR_STAGING_RESOURCE_GROUP> `
  --query "properties.{image: template.containers[0].image, status: runningStatus}"

# Check PRODUCTION status
az containerapp show `
  --name lock-in-backend `
  --resource-group <YOUR_PRODUCTION_RESOURCE_GROUP> `
  --query "properties.{image: template.containers[0].image, status: runningStatus}"

# Test health endpoints
# Replace with your actual URLs
curl https://<your-staging-url>/health
curl https://<your-production-url>/health
```

---

## 📊 Monitoring and Validation

### Monitor ACR Usage

Run the monitoring script to see current state:

```powershell
# Make sure you're in the project root
cd C:\Users\matth\Lock-in

# Run the monitoring script
.\scripts\monitor-acr-usage.ps1 -RegistryName "<YOUR_ACR_NAME>"

# Export to CSV for detailed analysis
.\scripts\monitor-acr-usage.ps1 `
  -RegistryName "<YOUR_ACR_NAME>" `
  -ExportCsv $true `
  -CsvPath "acr-usage-$(Get-Date -Format 'yyyy-MM-dd').csv"
```

### Monitor Deployment Workflow

Your next push to `develop` will trigger the backend deployment with the new tagging strategy:

```powershell
# Watch for workflow runs
gh run watch
```

The deployment should:

1. Build the Docker image
2. Tag it with `staging-<SHA>` and `staging-latest`
3. Push to ACR
4. Deploy to lock-in-dev using the new tag

---

## 🎯 Expected Timeline

| Step                                                | Duration     | Status      |
| --------------------------------------------------- | ------------ | ----------- |
| Docker build test                                   | Complete     | ✅          |
| Git commit & push                                   | Complete     | ✅          |
| Workflow sync                                       | 5-10 minutes | 🔄 Waiting  |
| ACR cleanup (local script or workflow when enabled) | 2-3 minutes  | ⏳ Optional |
| Container Apps update                               | 5-10 minutes | ⏳ Pending  |
| Verification                                        | 5-10 minutes | ⏳ Pending  |

**Total time remaining**: ~20-30 minutes

---

## ✅ Success Criteria

You'll know everything is working when:

1. ✅ ACR cleanup (local script or workflow when `DEPLOYMENT_ENABLED=true`) runs successfully in dry-run mode
2. ✅ Container Apps are updated to use `*-latest` tags
3. ✅ Next deployment to `develop` completes successfully
4. ✅ Staging health check passes
5. ✅ Monitoring script shows categorized images
6. ✅ No deployment failures or errors

---

## 🆘 Troubleshooting

### Workflow not showing up

**Wait 5-10 minutes** for GitHub to index the new workflow file. If it still doesn't appear:

```powershell
# Force re-sync by making a small change
git commit --allow-empty -m "chore: trigger workflow sync"
git push origin develop
```

### Container App update fails

Check permissions:

```powershell
# Verify you have Contributor role
az role assignment list --assignee $(az account show --query user.name -o tsv) --all
```

### Health check fails after update

Rollback to previous tag:

```powershell
# List recent tags
az acr repository show-tags `
  --name <YOUR_ACR_NAME> `
  --repository lock-in-backend `
  --orderby time_desc `
  --output table

# Rollback to previous SHA
az containerapp update `
  --name lock-in-dev `
  --resource-group <YOUR_STAGING_RESOURCE_GROUP> `
  --image <YOUR_ACR_NAME>.azurecr.io/lock-in-backend:<PREVIOUS_SHA>
```

---

## 📚 Next Steps After Verification

Once all verification steps are complete:

1. **Merge to main** (when ready for production):

   ```powershell
   # Create PR: develop → main
   gh pr create --base main --head develop --title "feat: ACR cost optimizations" --body "See implementation plan for details"
   ```

2. **Schedule regular monitoring**:
   - Run `monitor-acr-usage.ps1` monthly
   - Review ACR costs in Azure Portal

3. **Automated cleanup**: When `DEPLOYMENT_ENABLED` is `true`, `.github/workflows/acr-cleanup.yml` runs weekly. See [CICD.md](../../deployment/CICD.md) and [cleanup-guide.md](cleanup-guide.md).

4. **Update documentation**: Add ACR optimization notes to your project README and document the tagging strategy for your team.

---

## 📞 Support

- **Cleanup and cost control**: [CICD.md § Pausing and Clean the registry](../../deployment/CICD.md#clean-the-registry-while-paused-recommended) and [cleanup-guide.md](cleanup-guide.md)
- **Azure ACR Docs**: https://learn.microsoft.com/en-us/azure/container-registry/
