# Lock-in CI/CD Pipeline Documentation

## Overview

This directory contains GitHub Actions workflows that implement industry-standard CI/CD practices for the Lock-in project.

## Workflows

### 1. Backend CI/CD (`backend-deploy.yml`)

**Purpose**: Automated testing, building, and deployment of the backend service to Azure Container Apps.

**Triggers**:

- Push to `develop` → Deploy to Staging
- Push to `main` → Deploy to Production
- Pull requests → Run tests only
- Manual dispatch → Deploy to chosen environment

**Pipeline Stages**:

#### Stage 1: Build and Test

- Checkout code
- Setup Node.js with dependency caching
- Run unit tests
- Build Docker image with BuildKit and layer caching
- Run security scanning with Trivy
- Start test container with health checks
- Verify container health

#### Stage 2: Push to ACR

- Login to Azure using Service Principal
- Login to Azure Container Registry
- Build multi-platform image with Docker Buildx
- Push image with SHA and latest tags
- Cache Docker layers for faster builds

#### Stage 3: Deploy

- Login to Azure
- Deploy to Container App (staging or production)
- Wait for deployment with exponential backoff
- Run smoke tests on health endpoint
- Fetch logs on failure

#### Stage 4: Summary

- Output deployment information
- Provide manual deployment commands as fallback

### 2. Rollback Workflow (`backend-rollback.yml`)

**Purpose**: Emergency rollback to a previous working version.

**Usage**:

```bash
# Via GitHub CLI
gh workflow run backend-rollback.yml \
  -f environment=production \
  -f image_tag=abc1234567890

# Via GitHub UI
Actions → Backend Rollback → Run workflow
```

**Parameters**:

- `environment`: staging or production
- `image_tag`: Git commit SHA or "previous"

### 3. Test Workflow (`test.yml`)

**Purpose**: Run automated tests on pull requests.

### 4. Refactor Gate (`refactor-gate.yml`)

**Purpose**: Enforce code quality standards during refactoring.

## Security Best Practices

### 1. Secrets Management

All sensitive credentials are stored as GitHub Secrets:

| Secret                         | Purpose                | Format                                                     |
| ------------------------------ | ---------------------- | ---------------------------------------------------------- |
| `AZURE_CREDENTIALS`            | Service Principal auth | JSON with clientId, clientSecret, subscriptionId, tenantId |
| `AZURE_CONTAINER_REGISTRY`     | ACR name               | String (e.g., "myregistry")                                |
| `AZURE_RESOURCE_GROUP`         | Production RG          | String                                                     |
| `AZURE_RESOURCE_GROUP_STAGING` | Staging RG             | String                                                     |

### 2. Authentication Methods

**✅ Recommended (Current Implementation)**:

- Azure Service Principal with RBAC
- Scoped to specific resource groups
- No admin passwords stored

**❌ Deprecated (Removed)**:

- ACR admin username/password
- Less secure, harder to rotate

### 3. Image Scanning

- Trivy scans every image for vulnerabilities
- Blocks on CRITICAL/HIGH severity issues
- SARIF results uploaded to GitHub Security tab

### 4. Environment Protection

Configure in GitHub Settings → Environments:

**Staging**:

- No approval required
- Auto-deploys from `develop`

**Production**:

- Require reviewers: 1-2 team members
- Wait timer: Optional (e.g., 5 minutes)
- Deployment branches: Only `main`

## Performance Optimizations

### 1. Docker Layer Caching

```yaml
- uses: actions/cache@v4
  with:
    path: /tmp/.buildx-cache
    key: ${{ runner.os }}-buildx-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-buildx-
```

**Benefits**:

- 50-80% faster builds
- Reduced bandwidth usage
- Lower ACR egress costs

### 2. Multi-Stage Builds

The backend Dockerfile uses multi-stage builds:

- Stage 1: Dependencies (cached)
- Stage 2: Build (uses cached deps)
- Stage 3: Production runtime (minimal image)

### 3. BuildKit

Enabled by default with `docker/build-push-action@v5`:

- Parallel layer builds
- Better caching
- Automatic garbage collection

### 4. GitHub Actions Caching

- npm dependencies cached per `package-lock.json`
- Docker layers cached between runs
- Action setup cached (Node.js, Docker)

## Scalability Considerations

### 1. Multi-Region Deployment (Future)

To add multi-region support:

```yaml
strategy:
  matrix:
    region: [eastus, westeurope, australiaeast]
steps:
  - name: Deploy to ${{ matrix.region }}
    run: |
      az containerapp update \
        --name lock-in-backend-${{ matrix.region }} \
        --image ${{ env.REGISTRY_LOGIN_SERVER }}/...
```

### 2. Blue-Green Deployment (Future)

```yaml
- name: Deploy to blue slot
  run: |
    az containerapp revision copy \
      --name lock-in-backend \
      --image ${{ env.REGISTRY_LOGIN_SERVER }}/...

- name: Test blue slot
  run: curl -sf https://blue.lock-in-backend.azurecontainerapps.io/health

- name: Switch traffic
  run: |
    az containerapp ingress traffic set \
      --name lock-in-backend \
      --revision-weight blue=100 green=0
```

### 3. Canary Deployment

```yaml
- name: Canary deployment (10% traffic)
  run: |
    az containerapp ingress traffic set \
      --name lock-in-backend \
      --revision-weight canary=10 stable=90
```

### 4. Auto-Scaling

Container Apps automatically scale based on:

- HTTP requests
- CPU usage
- Memory usage
- Custom metrics (future)

Configure in Container App:

```bash
az containerapp update \
  --name lock-in-backend \
  --min-replicas 1 \
  --max-replicas 10 \
  --scale-rule-name http-rule \
  --scale-rule-type http \
  --scale-rule-http-concurrency 100
```

## Monitoring and Observability

### 1. Deployment Verification

The pipeline includes:

- Health check polling with exponential backoff
- Smoke tests on critical endpoints
- Automatic log fetching on failure

### 2. GitHub Actions Insights

Monitor at: `Actions` → Workflow → `Insights`

Metrics:

- Success rate
- Average duration
- Failure patterns

### 3. Azure Monitoring (External)

Recommended setup:

- Application Insights for APM
- Log Analytics for centralized logs
- Azure Monitor alerts for downtime

## Troubleshooting

### Issue: "Input required and not supplied: username"

**Cause**: Using `azure/docker-login@v2` without credentials.

**Solution**: Workflow now uses `az acr login` with Service Principal.

### Issue: "Permission denied" on ACR push

**Cause**: Service Principal lacks ACR push role.

**Solution**:

```bash
az role assignment create \
  --assignee <client-id> \
  --scope /subscriptions/.../Microsoft.ContainerRegistry/registries/<acr> \
  --role AcrPush
```

### Issue: Deployment succeeds but health check fails

**Possible causes**:

1. Container not listening on correct port
2. Health endpoint not implemented
3. Environment variables missing

**Debug**:

```bash
# Check logs
az containerapp logs show \
  --name lock-in-backend \
  --resource-group <rg> \
  --tail 100

# Check environment
az containerapp show \
  --name lock-in-backend \
  --resource-group <rg> \
  --query "properties.template.containers[0].env"
```

### Issue: Build timeout

**Causes**:

- No layer caching
- Installing dependencies from scratch

**Solutions**:

- Ensure cache is working (check workflow logs)
- Use `npm ci` instead of `npm install`
- Consider GitHub Actions larger runners

## Setup Instructions

### 1. Create Service Principal

```bash
# Create with contributor role
az ad sp create-for-rbac \
  --name "github-actions-lock-in" \
  --role contributor \
  --scopes /subscriptions/<subscription-id>/resourceGroups/<rg> \
  --sdk-auth

# Output will be JSON - save this
```

### 2. Assign ACR Permissions

```bash
# Get service principal app ID
SP_APP_ID=$(az ad sp list --display-name "github-actions-lock-in" --query "[0].appId" -o tsv)

# Assign AcrPush role
az role assignment create \
  --assignee $SP_APP_ID \
  --scope /subscriptions/<sub-id>/resourceGroups/<rg>/providers/Microsoft.ContainerRegistry/registries/<acr-name> \
  --role AcrPush
```

### 3. Add GitHub Secrets

Go to: `Settings` → `Secrets and variables` → `Actions` → `New repository secret`

Add:

- `AZURE_CREDENTIALS`: The JSON from step 1
- `AZURE_CONTAINER_REGISTRY`: ACR name (e.g., "lockincr")
- `AZURE_RESOURCE_GROUP`: Production resource group name
- `AZURE_RESOURCE_GROUP_STAGING`: Staging resource group name

### 4. Create GitHub Environments

Go to: `Settings` → `Environments` → `New environment`

Create:

- `staging`: No protection rules
- `production`: Add required reviewers

### 5. Test the Pipeline

```bash
# Push to develop to test staging deployment
git checkout develop
git commit --allow-empty -m "test: trigger staging deployment"
git push origin develop

# Watch the workflow
gh run watch
```

## Best Practices Checklist

- [x] Use service principal authentication
- [x] Enable Docker layer caching
- [x] Run security scanning (Trivy)
- [x] Implement health checks
- [x] Use exponential backoff for retries
- [x] Tag images with commit SHA
- [x] Separate staging and production
- [x] Require PR reviews for production
- [x] Cache npm dependencies
- [x] Use BuildKit for faster builds
- [x] Include rollback workflow
- [x] Fetch logs on deployment failure
- [x] Run smoke tests after deployment
- [ ] Add performance tests (future)
- [ ] Implement blue-green deployment (future)
- [ ] Add notification on deployment (future)
- [ ] Multi-region deployment (future)

## Further Reading

- [Azure Container Apps Deployment](https://learn.microsoft.com/en-us/azure/container-apps/github-actions)
- [Docker Build Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [GitHub Actions Security](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [Trivy Security Scanner](https://github.com/aquasecurity/trivy-action)
