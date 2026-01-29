# Azure Container Registry - Cleanup and Cost Management Guide

## Overview

This guide explains how to manage Azure Container Registry (ACR) costs through automated cleanup policies and monitoring. Our Lock-in project uses a multi-environment deployment strategy that requires careful image retention management.

---

## Current ACR Strategy

### Image Tagging Convention

**Staging Environment** (develop branch):

- `staging-<SHA>` - Unique identifier for each build
- `staging-latest` - Always points to most recent staging deployment

**Production Environment** (main branch):

- `production-<SHA>` - Unique identifier for each build
- `production-latest` - Always points to most recent production deployment
- `<SHA>` - Fallback compatibility tag

**Semantic Versions** (when released):

- `v1.0.0`, `v1.2.3`, etc. - Never deleted, permanent tags

### Retention Policies

- **Staging images**: 14 days retention
- **Production images**: 90 days retention
- **Semantic versions**: Never deleted
- **Latest tags**: Never deleted

---

## Automated Cleanup

### GitHub Actions Workflow

The `.github/workflows/acr-cleanup.yml` workflow runs automatically:

**Schedule**: Weekly on Sundays at 2 AM UTC

**What it does**:

1. Fetches all tags from configured repository
2. Identifies images older than retention period
3. Preserves semantic version tags (v*.*.\*)
4. Preserves all `*-latest` tags
5. Deletes old staging and production images
6. Generates cleanup report

### Manual Triggering

You can manually trigger cleanup with custom parameters:

```bash
# Via GitHub CLI
gh workflow run acr-cleanup.yml \
  --field dry_run=true \
  --field staging_retention_days=7 \
  --field production_retention_days=60

# Via GitHub web interface
# Navigate to: Actions → ACR Cleanup → Run workflow
```

**Parameters**:

- `dry_run`: `true` (preview) or `false` (execute)
- `staging_retention_days`: Number of days to keep staging images
- `production_retention_days`: Number of days to keep production images
- `repository`: Repository name (default: lock-in-backend)

---

## Local Cleanup Script

For ad-hoc cleanup or testing, use the PowerShell script:

### Prerequisites

1. Install Azure CLI: https://learn.microsoft.com/en-us/cli/azure/install-azure-cli
2. Login to Azure: `az login`
3. Set environment variable (optional): `$env:AZURE_CONTAINER_REGISTRY="your-acr-name"`

### Usage

**Dry run (preview deletions)**:

```powershell
.\scripts\cleanup-acr.ps1 -RegistryName "myacr" -DryRun $true
```

**Execute cleanup**:

```powershell
.\scripts\cleanup-acr.ps1 -RegistryName "myacr" -DryRun $false
```

**Custom retention periods**:

```powershell
.\scripts\cleanup-acr.ps1 `
  -RegistryName "myacr" `
  -StagingRetentionDays 7 `
  -ProductionRetentionDays 30 `
  -DryRun $true
```

**Specific repository**:

```powershell
.\scripts\cleanup-acr.ps1 `
  -RegistryName "myacr" `
  -Repository "lock-in-backend" `
  -DryRun $false
```

---

## Cost Monitoring

### Check Current Usage

Use the Azure CLI to monitor your ACR usage:

```bash
# List all repositories
az acr repository list --name <acr-name> --output table

# Count images in repository
az acr repository show-tags \
  --name <acr-name> \
  --repository lock-in-backend \
  --output table | wc -l

# Show repository size
az acr repository show \
  --name <acr-name> \
  --repository lock-in-backend \
  --query '{name:name, tagCount:tagCount, manifestCount:manifestCount}'
```

### Estimate Costs

**Azure Container Registry Pricing (as of 2024)**:

- **Basic tier**: $0.167/day (~$5/month) + storage costs
- **Standard tier**: $0.667/day (~$20/month) + storage costs
- **Premium tier**: $1.667/day (~$50/month) + storage costs

**Storage costs** (all tiers):

- $0.10 per GB per month

**Example calculation**:

- 30 images × 150MB each = 4.5GB total storage
- Storage cost: 4.5GB × $0.10 = $0.45/month
- Total cost (Basic tier): $5 + $0.45 = $5.45/month

### Monitor with PowerShell Script

We provide a monitoring script (coming soon):

```powershell
.\scripts\monitor-acr-usage.ps1 -RegistryName "myacr"
```

This will output:

- Total number of images
- Total storage used
- Estimated monthly costs
- Cleanup candidates (old images)

---

## Azure Portal Monitoring

### Enable Diagnostic Logs

1. Navigate to your ACR in Azure Portal
2. Go to **Monitoring** → **Diagnostic settings**
3. Add diagnostic setting:
   - Log: `ContainerRegistryRepositoryEvents`
   - Destination: Log Analytics workspace
4. Create alerts for storage growth

### Set Up Cost Alerts

1. Navigate to **Cost Management + Billing**
2. Select **Cost alerts** → **Add**
3. Configure alert:
   - **Budget**: Monthly
   - **Amount**: Your expected monthly cost
   - **Alert threshold**: 80% and 100%
   - **Action group**: Email notification

---

## Troubleshooting

### Cleanup Workflow Fails

**Issue**: `az acr manifest delete` fails with permission error

**Solution**:

1. Verify the service principal has `AcrDelete` permission:
   ```bash
   az role assignment create \
     --assignee <service-principal-id> \
     --role AcrDelete \
     --scope /subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.ContainerRegistry/registries/<acr-name>
   ```

### Images Not Being Deleted

**Issue**: Old images still present after cleanup

**Possible causes**:

1. Images are tagged with semantic versions (preserved by design)
2. Images are tagged with `*-latest` (preserved by design)
3. Dry-run mode enabled (preview only, no deletions)
4. Retention period too long

**Solution**: Review cleanup logs and adjust retention periods

### Deployment Fails After Cleanup

**Issue**: Container App can't pull image after cleanup

**Solution**:

1. Verify `staging-latest` and `production-latest` tags exist
2. Update Container App to use environment-specific tags:
   ```bash
   az containerapp update \
     --name lock-in-dev \
     --resource-group <rg> \
     --image <acr>.azurecr.io/lock-in-backend:staging-latest
   ```

---

## Best Practices

### ✅ Do

- Run cleanup in **dry-run mode first** before executing
- Review cleanup reports after each automated run
- Monitor ACR costs monthly
- Adjust retention periods based on your compliance needs
- Use semantic versioning for production releases
- Keep `*-latest` tags for rollback capability

### ❌ Don't

- Delete semantic version tags (`v*.*.*`)
- Delete `*-latest` tags
- Set retention periods too short (< 7 days for staging)
- Run cleanup without testing in dry-run mode first
- Ignore cleanup failure notifications

---

## Compliance Considerations

### Regulatory Requirements

If your organization has compliance requirements:

1. **GDPR/HIPAA**: May require longer retention for audit trails
2. **SOC 2**: Document retention policies in security documentation
3. **ISO 27001**: Maintain change logs for all deployments

**How to adjust**:

- Increase `production_retention_days` to 180 or 365 days
- Add exception rules for compliance-tagged images
- Archive old images to Azure Blob Storage before deletion

### Audit Trail

All cleanup operations are logged:

1. **GitHub Actions logs**: 90 days retention (configurable)
2. **Cleanup reports**: Uploaded as artifacts
3. **Azure Activity Logs**: 90 days in Azure Portal

---

## Emergency Procedures

### Restore Deleted Image

**Unfortunately, deleted images cannot be restored.** ACR deletions are permanent.

**Prevention**:

1. Always test with `dry_run=true` first
2. Export critical images before cleanup:
   ```bash
   docker pull <acr>.azurecr.io/lock-in-backend:v1.0.0
   docker save <acr>.azurecr.io/lock-in-backend:v1.0.0 > backup.tar
   ```
3. Use semantic version tags for important releases

### Rollback Deployment

If a cleanup accidentally affects a deployment:

1. Check latest available tag:

   ```bash
   az acr repository show-tags \
     --name <acr> \
     --repository lock-in-backend \
     --orderby time_desc \
     --output table
   ```

2. Deploy previous working image:
   ```bash
   az containerapp update \
     --name lock-in-backend \
     --resource-group <rg> \
     --image <acr>.azurecr.io/lock-in-backend:production-<previous-sha>
   ```

---

## Additional Resources

### Azure Documentation

- [ACR retention policies](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-retention-policy)
- [ACR pricing](https://azure.microsoft.com/en-us/pricing/details/container-registry/)
- [ACR best practices](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-best-practices)

### Related Workflows

- `.github/workflows/backend-deploy.yml` - Main deployment pipeline
- `.github/workflows/acr-cleanup.yml` - Automated cleanup
- `scripts/cleanup-acr.ps1` - Manual cleanup script
- `scripts/monitor-acr-usage.ps1` - Cost monitoring (coming soon)

---

## Support

For issues or questions:

1. Check troubleshooting section above
2. Review workflow logs in GitHub Actions
3. Check Azure Activity Logs for ACR operations
4. Contact DevOps team or infrastructure lead
