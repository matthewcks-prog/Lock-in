# Emergency Rollback Procedures

Quick reference for rolling back deployments in emergency situations.

## When to Rollback

Rollback immediately if:

- ❌ Production deployment breaks critical functionality
- ❌ Security vulnerability introduced
- ❌ Database migrations fail
- ❌ Performance degrades significantly
- ❌ Health checks consistently fail

## Quick Rollback (3 Steps)

### 1. Identify Previous Working Version

```bash
# List recent images (ordered by time)
az acr repository show-tags \
  --name lockincr \
  --repository lock-in-backend \
  --orderby time_desc \
  --top 10
```

**Tip**: Commit SHAs are the image tags. Find the last known good commit.

### 2. Trigger Rollback Workflow

```bash
# Via GitHub CLI (recommended)
gh workflow run backend-rollback.yml \
  -f environment=production \
  -f image_tag=<commit-sha>

# Or via GitHub UI
# Actions > Backend Rollback > Run workflow > Select environment + image tag
```

### 3. Verify Rollback

```bash
# Check deployment status
az containerapp revision list \
  --name lock-in-backend \
  --resource-group lock-in-prod \
  --query "[?properties.active==\`true\`].{Name:name,Image:properties.template.containers[0].image,Traffic:properties.trafficWeight}" \
  -o table

# Test health endpoint
APP_URL=$(az containerapp show --name lock-in-backend --resource-group lock-in-prod --query "properties.configuration.ingress.fqdn" -o tsv)
curl -v https://$APP_URL/health
```

## Rollback Workflow

### Backend Rollback (`backend-rollback.yml`)

**Manual trigger only** (workflow_dispatch)

**Inputs:**

- `environment`: Choose `staging` or `production`
- `image_tag`: Commit SHA or `previous` (uses latest tag, not recommended)

**What it does:**

1. Validates inputs and shows warning for production
2. Logs into Azure with Service Principal
3. If `image_tag` is `previous`, retrieves the last active revision (falls back to `latest` tag)
4. Updates Container App with the specified image
5. Verifies rollback with health check (10 retries, exponential backoff)
6. Fetches logs if health check fails

**Example:**

```bash
gh workflow run backend-rollback.yml \
  -f environment=production \
  -f image_tag=a1b2c3d4
```

## Manual Rollback (Emergency)

If GitHub Actions is unavailable, rollback manually with Azure CLI:

### Production

```bash
# Login to Azure
az login

# Set variables
RESOURCE_GROUP="lock-in-prod"
CONTAINER_APP_NAME="lock-in-backend"
ACR_NAME="lockincr"
IMAGE_TAG="<commit-sha>"  # Replace with known good version

# Rollback
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --image ${ACR_NAME}.azurecr.io/lock-in-backend:${IMAGE_TAG}

# Wait for deployment (takes 1-2 minutes)
az containerapp revision list \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "[?properties.active==\`true\`].{Name:name,Traffic:properties.trafficWeight}" \
  -o table

# Verify
APP_URL=$(az containerapp show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --query "properties.configuration.ingress.fqdn" -o tsv)
curl -sf https://$APP_URL/health
```

### Staging

Same as production, but use:

- `RESOURCE_GROUP="lock-in-staging"`
- `CONTAINER_APP_NAME="lock-in-dev"`

## Rollback Strategies

### 1. Immediate Rollback (Most Common)

**Use when**: Production is broken, need to restore service ASAP.

**Steps:**

1. Identify last known good commit SHA
2. Trigger rollback workflow with that SHA
3. Verify health checks pass
4. Investigate issue offline

### 2. Gradual Rollback (Blue-Green)

**Use when**: Issue affects only some users, need to verify rollback.

⚠️ **Not currently supported** - requires Container Apps revision management.

**Future implementation:**

```bash
# Split traffic between revisions
az containerapp revision set-mode \
  --name lock-in-backend \
  --resource-group lock-in-prod \
  --mode multiple

# Adjust traffic weights
az containerapp ingress traffic set \
  --name lock-in-backend \
  --resource-group lock-in-prod \
  --revision-weight <old-revision>=80 <new-revision>=20
```

### 3. Forward Fix

**Use when**: Issue is minor, fix is simple and fast.

**Steps:**

1. Create hotfix branch from `main`
2. Make fix, test locally
3. Commit and push to `develop` first (test in staging)
4. If staging looks good, cherry-pick to `main` or merge via PR
5. Deploy to production (normal CI/CD flow)

## Post-Rollback Actions

After rolling back:

1. **Communicate**: Notify team and stakeholders
2. **Investigate**: Review logs, identify root cause
3. **Fix**: Create fix in `develop` branch, test in staging
4. **Document**: Add to incident log
5. **Prevent**: Add tests, update CI/CD checks if needed

## Rollback Verification Checklist

After rollback, verify:

- [ ] Health endpoint returns 200 OK
- [ ] Database connectivity works
- [ ] Authentication works (login flow)
- [ ] Key features work (create note, chat, etc.)
- [ ] No error spikes in logs
- [ ] Response times are normal

## Common Rollback Scenarios

### Scenario 1: Database Migration Broke Production

**Problem**: New deployment includes database migration that breaks queries.

**Solution:**

1. **DO NOT** rollback database migration automatically
2. Rollback application code to previous version
3. Fix migration offline, test in staging
4. Re-deploy fixed version

**Why**: Database rollbacks are risky. Better to rollback application code and keep database forward-compatible.

### Scenario 2: New Dependency Has Critical Vulnerability

**Problem**: Trivy scan didn't catch it, but CVE published after deployment.

**Solution:**

1. Rollback to previous version immediately
2. Update dependency, run Trivy scan locally
3. Deploy fix via normal CI/CD

### Scenario 3: Configuration Error (Wrong Environment Variable)

**Problem**: Deployed with wrong Supabase URL or API key.

**Solution:**

1. **Option A**: Fix environment variable in Azure Portal (faster)

   ```bash
   az containerapp update \
     --name lock-in-backend \
     --resource-group lock-in-prod \
     --set-env-vars SUPABASE_URL_PROD=<correct-value>
   ```

2. **Option B**: Rollback to previous version, fix config, re-deploy

**Why**: For config-only issues, updating environment variables is faster than full rollback.

## Monitoring After Rollback

Watch these metrics for 30 minutes after rollback:

```bash
# Check error logs
az containerapp logs show \
  --name lock-in-backend \
  --resource-group lock-in-prod \
  --tail 100 \
  --follow

# Check health endpoint every minute
watch -n 60 curl -sf https://<app-url>/health

# Check Container App metrics in Azure Portal
# - CPU usage
# - Memory usage
# - Request count
# - Response time
# - Error rate
```

## Rollback Testing

Test rollback procedure quarterly:

1. Deploy a test change to staging
2. Use rollback workflow to rollback staging
3. Verify rollback works as expected
4. Document any issues or improvements needed

## Incident Response Template

```markdown
## Incident: [Brief Description]

**Date**: YYYY-MM-DD
**Time**: HH:MM UTC
**Severity**: Critical / High / Medium / Low

### Timeline

- HH:MM - Issue detected ([describe symptoms])
- HH:MM - Rollback initiated (commit SHA: [old] → [new])
- HH:MM - Rollback completed, service restored
- HH:MM - Verified service health

### Root Cause

[Describe what caused the issue]

### Resolution

[Describe what was done to resolve]

### Lessons Learned

1. [What went well]
2. [What could be improved]
3. [Action items to prevent recurrence]

### Action Items

- [ ] [Action item 1]
- [ ] [Action item 2]
```

## Related Documentation

- [CI/CD Pipeline](./CICD.md) - Pipeline reference
- [Azure Deployment](./AZURE.md) - Azure setup
- [Environments](./ENVIRONMENTS.md) - Environment strategy
