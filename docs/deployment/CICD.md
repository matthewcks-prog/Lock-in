# CI/CD Pipeline Reference

Complete reference for Lock-in's GitHub Actions CI/CD pipeline.

## Overview

Lock-in uses **GitHub Actions** for automated build, test, and deployment. The pipeline follows industry-standard practices with multi-environment support, security scanning, and rollback capabilities.

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LOCK-IN CI/CD PIPELINE                              │
└─────────────────────────────────────────────────────────────────────────────┘

                            ┌──────────────┐
                            │   Git Push   │
                            └──────┬───────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
              ┌─────▼─────┐               ┌──────▼──────┐
              │  develop  │               │    main     │
              └─────┬─────┘               └──────┬──────┘
                    │                            │
┌───────────────────▼─────────────────┐  ┌───────▼──────────────────────────┐
│     BUILD & TEST (All Branches)     │  │  BUILD & TEST (All Branches)     │
├─────────────────────────────────────┤  ├──────────────────────────────────┤
│ 1. Checkout code                    │  │ 1. Checkout code                 │
│ 2. Setup Node.js + cache            │  │ 2. Setup Node.js + cache         │
│ 3. Install dependencies (npm ci)    │  │ 3. Install dependencies (npm ci) │
│ 4. Build Docker image (BuildKit)    │  │ 4. Build Docker image (BuildKit) │
│ 5. Security scan (Trivy) ⚠️         │  │ 5. Security scan (Trivy) ⚠️      │
│ 6. Start test container             │  │ 6. Start test container          │
│ 7. Health check + smoke tests       │  │ 7. Health check + smoke tests    │
└─────────────────┬───────────────────┘  └───────┬──────────────────────────┘
                  │                              │
                  │ if push (not PR)             │ if push (not PR)
                  │                              │
┌─────────────────▼───────────────────┐  ┌───────▼──────────────────────────┐
│       PUSH TO ACR (develop)         │  │    PUSH TO ACR (main)            │
├─────────────────────────────────────┤  ├──────────────────────────────────┤
│ 1. Login to Azure (OIDC)│ │ 1. Login to Azure (OIDC)           │
│ 2. az acr login                      │ │ 2. az acr login                  │
│ 3. Setup Docker Buildx              │  │ 3. Setup Docker Buildx           │
│ 4. Build + push image               │  │ 4. Build + push image            │
│    - Tag: <commit-sha>              │  │    - Tag: <commit-sha>           │
│    - Tag: latest                    │  │    - Tag: latest                 │
│ 5. Use GitHub Actions cache         │  │ 5. Use GitHub Actions cache      │
└─────────────────┬───────────────────┘  └───────┬──────────────────────────┘
                  │                              │
┌─────────────────▼───────────────────┐  ┌───────▼──────────────────────────┐
│    DEPLOY TO STAGING (lock-in-dev)  │  │ DEPLOY TO PRODUCTION             │
│         Environment: staging        │  │  (lock-in-backend)               │
│         No reviewers required       │  │  Environment: production         │
├─────────────────────────────────────┤  │  ⚠️ Reviewers: REQUIRED         │
│ 1. Check OIDC secrets          │  ├──────────────────────────────────┤
│ 2. Login to Azure                   │  │ 1. Check OIDC secrets       │
│ 3. Deploy to Container App          │  │ 2. Login to Azure                │
│ 4. Wait for deployment              │  │ 3. Deploy to Container App       │
│ 5. Health check (retry with exp    │  │ 4. Wait for deployment           │
│    backoff, max 10 attempts)        │  │ 5. Health check (retry with exp  │
│ 6. Run smoke tests                  │  │    backoff, max 10 attempts)     │
│ 7. If fail: fetch and show logs     │  │ 6. Run smoke tests               │
└─────────────────┬───────────────────┘  │ 7. If fail: fetch and show logs  │
                  │                      └───────┬──────────────────────────┘
                  ▼                              ▼
        ┌─────────────────┐            ┌─────────────────┐
        │  ✅ Staging OK  │            │ ✅ Production OK │
        └─────────────────┘            └─────────────────┘
```

⚠️ **Security Note**: Trivy scanner now **fails the build** on CRITICAL/HIGH vulnerabilities (previously was continue-on-error).

## Workflow Triggers

### Backend Build & Deploy (`backend-deploy.yml`)

**Triggers:**

```yaml
on:
  push:
    branches: [main, develop]
    paths:
      - 'backend/**'
      - 'core/config/**'
      - '.github/workflows/backend-deploy.yml'
  pull_request:
    branches: [main, develop]
    paths:
      - 'backend/**'
      - 'core/config/**'
  workflow_dispatch:
    inputs:
      environment: staging | production
```

**Behavior:**

- **Push to develop** → Build → Push to ACR → Deploy to Staging
- **Push to main** → Build → Push to ACR → Deploy to Production (with reviewers)
- **Pull Request** → Build and test only (no push to ACR, no deploy)
- **Manual dispatch** → Build → Push to ACR → Deploy to specified environment

### Quality Gate (`quality-gate.yml`)

**Triggers:**

```yaml
on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]
```

**Purpose:** Single source of truth for all quality checks. Runs on PRs and pushes to protected branches only (NOT on feature branches).

**Checks performed:**

1. Code formatting (`npm run format:check`)
2. Linting all workspaces (`npm run lint:all`)
3. Type checking (`npm run type-check`)
4. Unit tests with coverage (`npm run test:all`, `npm run test:coverage`)
5. Build verification (`npm run build`, `npm run verify-build`)

**Key features:**

- Single Node version (20.x) for faster CI
- Concurrency control (cancels in-progress runs on new PR push)
- Uploads coverage artifacts and failure logs
- Industry best practice: Run quality checks ONCE, not on every feature branch push

## Jobs Explained

### Backend Deploy Workflow

### 1. `build-and-deploy`

**Purpose**: Build Docker image, run security scan, and deploy to Azure.

**Note**: Linting and tests are handled by `quality-gate.yml` to avoid duplication.

**Steps:**

1. **Checkout code** - Get latest code
2. **Setup Node.js** - Install Node 20 with npm cache
3. **Install dependencies** - `npm ci` for all workspaces
4. **Validate lockfile** - Ensure package-lock.json is in sync
5. **Build Docker image** - Use BuildKit with GitHub Actions cache
6. **Security scan** - Trivy vulnerability scanner (**now fails on CRITICAL/HIGH**)
7. **Start test container** - Run Docker image locally
8. **Health check** - Verify container responds
9. **Determine deployment targets** - Set outputs for staging/production

**Outputs:**

- `should-deploy-staging`: `true` if develop push or manual staging
- `should-deploy-production`: `true` if main push or manual production

### 2. `push-to-acr`

**Purpose**: Push Docker image to Azure Container Registry.

**Gate**: Runs only when repository variable `DEPLOYMENT_ENABLED` = `true`. When unset or `false`, this job and all deploy jobs are skipped (see [Pausing and resuming deployment](#pausing-and-resuming-deployment-acr-cost-control)).

**Steps:**

1. **Login to Azure** - Using OIDC
2. **Login to ACR** - `az acr login`
3. **Setup Docker Buildx** - Multi-platform support
4. **Cache Docker layers** - GitHub Actions cache (not local cache)
5. **Build and push** - Tag with commit SHA and `latest`

**Outputs:**

- `image-tag`: Commit SHA used for deployment

**Authentication**: Uses OIDC secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.

### 3. `deploy-staging`

**Purpose**: Deploy to staging environment (lock-in-dev).

**Conditions:**

- Only runs if `DEPLOYMENT_ENABLED == 'true'` (via `push-to-acr` dependency) and `should-deploy-staging == true`
- GitHub Environment: `staging` (no required reviewers)

**Steps:**

1. **Check credentials** - Skip if `AZURE_CLIENT_ID` missing
2. **Login to Azure** - Using OIDC
3. **Deploy to Container App** - Update image to new SHA
4. **Verify deployment** - Health check with exponential backoff (10 attempts, 10s → 5120s)
5. **Run smoke tests** - Verify `/health` returns `ok` or `healthy`
6. **Fetch logs on failure** - Show last 50 lines

### 4. `deploy-production`

**Purpose**: Deploy to production environment (lock-in-backend).

**Conditions:**

- Only runs if `DEPLOYMENT_ENABLED == 'true'` (via `push-to-acr` dependency) and `should-deploy-production == true`
- GitHub Environment: `production` ⚠️ **MUST have required reviewers enabled**

**Steps:** Same as `deploy-staging` but targets `lock-in-backend` and `AZURE_RESOURCE_GROUP`.

**Important**: Configure required reviewers in GitHub Settings > Environments > production.

### 5. `deployment-summary`

**Purpose**: Runs after build to show deployment summary or a "deployment paused" notice.

Shows manual deploy commands when `DEPLOYMENT_ENABLED` is true; otherwise explains how to enable deployment. Useful when deployment is paused or OIDC secrets are not set.

## Authentication & Secrets

### OIDC Setup

```powershell
# From repo root (edit config values at top if needed)
.\setup_uami.ps1
```

This configures federated credentials for:

- `refs/heads/main`
- `refs/heads/develop`
- `pull_request`
- `environment:staging`
- `environment:production`

### Required GitHub Secrets

Add these in GitHub Settings > Secrets and variables > Actions:

| Secret                         | Format                             | Example                    |
| ------------------------------ | ---------------------------------- | -------------------------- |
| `AZURE_CLIENT_ID`              | OIDC client ID                     | Managed identity client ID |
| `AZURE_TENANT_ID`              | OIDC tenant ID                     | Azure AD tenant ID         |
| `AZURE_SUBSCRIPTION_ID`        | Azure subscription ID              | Subscription ID            |
| `AZURE_CONTAINER_REGISTRY`     | String (ACR name, no .azurecr.io)  | `lockincr`                 |
| `AZURE_RESOURCE_GROUP`         | String (production resource group) | `lock-in-prod`             |
| `AZURE_RESOURCE_GROUP_STAGING` | String (staging resource group)    | `lock-in-staging`          |

### Repository variable: deployment gate

| Variable             | Values                    | Purpose                                                                                                                                                                                  |
| -------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEPLOYMENT_ENABLED` | `true` / `false` or unset | When `true`, workflows push to ACR and deploy to staging/production. When unset or `false`, ACR push and deploy are **skipped** (build and test still run). Use to pause Azure/ACR cost. |

Add in **Settings → Secrets and variables → Actions → Variables**. See [Pausing and resuming deployment](#pausing-and-resuming-deployment-acr-cost-control) below.

## Pausing and resuming deployment (ACR cost control)

**Root cause of ACR cost:** Azure Container Registry is billed for the registry tier and storage. The backend-deploy workflow pushes images to ACR on push to `main` (and manual dispatch); the acr-cleanup workflow runs weekly. Both use the same gate so you can pause all ACR-related activity from one place.

**To pause (stop ACR push and deploy):**

- **Option A (default):** Do nothing. If `DEPLOYMENT_ENABLED` is not set, ACR push and deploy are **skipped**. Build and test still run.
- **Option B:** Set repository variable `DEPLOYMENT_ENABLED` = `false` in **Settings → Secrets and variables → Actions → Variables** for clarity.

**To resume when ready for staging/production:**

1. Go to **Settings → Secrets and variables → Actions → Variables**.
2. Add or edit: `DEPLOYMENT_ENABLED` = `true`.
3. Push to `main` (or run workflow_dispatch) to push to ACR and deploy.

**What stays on when paused:**

- Build, test, Trivy, and container health check in `backend-deploy.yml`.
- Quality gate and other non-deploy workflows.

**What is skipped when paused:**

- Push to Azure Container Registry.
- Deploy to staging and production.
- ACR cleanup workflow (no weekly ACR API calls).

**To stop Azure billing entirely:** Pausing workflows stops _new_ pushes; the ACR resource in Azure still incurs cost until you delete or downsize it in the Azure Portal. To eliminate ACR cost, delete the registry (or remove the resource) in Azure when paused; recreate it when you are ready to deploy again.

### Clean the registry while paused (recommended)

**Best practice:** While deployment is paused, clean or remove the registry so you don’t pay for storage. When you resume, the next pipeline run will push fresh images; you don’t need to “keep” old ones for that.

| Option                   | Action                                                                                                                                                                          | Cost impact                                     | When you resume                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. Delete ACR**        | Delete the ACR resource in Azure Portal (or `az acr delete`).                                                                                                                   | No registry or storage cost.                    | Recreate ACR (e.g. `scripts/infra/azure-setup.ps1` or Portal), ensure `AZURE_CONTAINER_REGISTRY` secret still matches, set `DEPLOYMENT_ENABLED=true`. First push repopulates the registry. |
| **B. Clean images only** | Run a one-time cleanup (e.g. `acr-cleanup.yml` with `dry_run: false` and short retention, or `scripts/cleanup-acr.ps1`). Optionally keep last 1–2 production tags for rollback. | Lower storage cost; registry tier still billed. | Set `DEPLOYMENT_ENABLED=true`; next push adds new images.                                                                                                                                  |
| **C. Keep as is**        | Do nothing in ACR.                                                                                                                                                              | Full storage (and tier) cost continues.         | Set `DEPLOYMENT_ENABLED=true`; next push adds new images.                                                                                                                                  |

**Recommendation:** Use **Option A** if you want to stop all ACR cost. Use **Option B** only if you need to keep one or two recent production tags for rollback during the pause.

#### One-time: log in and clean ACR images (Option B)

From the repo root in PowerShell:

```powershell
# 1. Log in to Azure (opens browser if needed)
az login

# 2. Set your ACR name if not already set (use the value from GitHub secret AZURE_CONTAINER_REGISTRY)
$env:AZURE_CONTAINER_REGISTRY = "your-acr-name"   # e.g. lockinacr

# 3. Preview what would be deleted (dry run)
.\scripts\cleanup-acr.ps1 -DryRun $true

# 4. Run cleanup for real (short retention = delete almost everything)
.\scripts\cleanup-acr.ps1 -StagingRetentionDays 0 -ProductionRetentionDays 0 -DryRun $false -Force
```

Use `-Force` to skip the "Type 'DELETE' to confirm" prompt (e.g. for automation).

To keep the last 1–2 production images, use a small retention instead of `0` (e.g. `-ProductionRetentionDays 1`). The script preserves `*-latest` and semantic `v*.*.*` tags unless you change the script.

## GitHub Environments

Configure in GitHub Settings > Environments:

### `staging`

- **Protection rules**: None (auto-deploys)
- **Secrets**: Can use staging-specific secrets if needed

### `production`

- **Protection rules**: ⚠️ **Required reviewers** (at least 1)
- **Deployment branches**: Recommended to limit to `main` only
- **Wait timer**: Optional (e.g., 10 minutes to allow verification)

## Command Reference

### Watch Deployment

```bash
# Watch latest workflow run
gh run watch

# View specific run
gh run view <run-id> --log
```

### Manual Deployment

```bash
# Trigger manual deployment
gh workflow run backend-deploy.yml -f environment=staging

# Or deploy directly with Azure CLI
az containerapp update \
  --name lock-in-backend \
  --resource-group lock-in-prod \
  --image lockincr.azurecr.io/lock-in-backend:<commit-sha>
```

### Check Container Status

```bash
# Get app status
az containerapp show \
  --name lock-in-backend \
  --resource-group lock-in-prod \
  --query "properties.provisioningState"

# Get app URL
az containerapp show \
  --name lock-in-backend \
  --resource-group lock-in-prod \
  --query "properties.configuration.ingress.fqdn" -o tsv

# View logs
az containerapp logs show \
  --name lock-in-backend \
  --resource-group lock-in-prod \
  --tail 100 \
  --follow
```

### List Images in ACR

```bash
# List all tags
az acr repository show-tags \
  --name lockincr \
  --repository lock-in-backend \
  --orderby time_desc \
  --top 20

# Get image digest
az acr repository show \
  --name lockincr \
  --repository lock-in-backend:<commit-sha> \
  --query "digest"
```

## Troubleshooting

### Build Fails at Security Scan

**Issue**: Trivy finds CRITICAL or HIGH vulnerabilities.

**Solution:**

1. Review Trivy output in GitHub Actions logs
2. Update vulnerable dependencies in `backend/package.json`
3. Rebuild and retest locally
4. If urgent, temporarily set `exit-code: '0'` in workflow (NOT recommended)

### Deployment Fails at Health Check

**Issue**: Health check times out after 10 attempts.

**Solution:**

1. Check Container App logs: `az containerapp logs show --name lock-in-backend --resource-group lock-in-prod --tail 100`
2. Verify environment variables in Azure Portal
3. Check Supabase connectivity
4. Verify OpenAI API key validity

### ACR Login Fails

**Issue**: `az acr login` fails with authentication error.

**Solution:**

1. Verify `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID` secrets are set
2. Verify managed identity has `AcrPush` role on the registry
3. Check federated credentials match repo/environment subjects

### Manual Deployment Skipped

**Issue**: Workflow shows "Manual deployment required" message.

**Solution:**

OIDC secrets are missing. Either:

1. Add the secrets (recommended): See "OIDC Setup" above
2. Deploy manually: Use the printed `az containerapp update` command

## Best Practices

### Branch Strategy

- **Feature branches** → Create PR to `develop`
- **develop branch** → Staging deployments (test features)
- **main branch** → Production deployments (stable releases)

### Deployment Frequency

- **Staging**: Deploy often (every commit to develop)
- **Production**: Deploy when staging is verified (weekly/bi-weekly releases)

### Security

- ✅ Use OIDC with managed identity authentication (not ACR admin credentials)
- ✅ Review federated credentials and role assignments regularly
- ✅ Enable required reviewers for production
- ✅ Monitor Trivy scan results
- ✅ Keep dependencies updated

### Monitoring

- Review GitHub Actions runs weekly
- Check Container App metrics in Azure Portal
- Set up alerts for deployment failures
- Monitor application logs for errors

## Performance

### Build Times

- **Without cache**: ~5-7 minutes
- **With cache**: ~2-4 minutes

### Deployment Times

- **Staging**: ~2-3 minutes (no review)
- **Production**: ~5-10 minutes (includes review approval)

### Cache Strategy

Uses GitHub Actions cache (`cache-from: type=gha, cache-to: type=gha,mode=max`):

- ✅ Faster than local cache
- ✅ Shared across workflow runs
- ✅ Automatically managed by GitHub

## Rollback

See [ROLLBACK.md](./ROLLBACK.md) for emergency rollback procedures.

## Related Documentation

- [Azure Deployment](./AZURE.md) - Azure Container Apps setup
- [Environments](./ENVIRONMENTS.md) - Environment strategy
- [Rollback](./ROLLBACK.md) - Emergency rollback procedures
