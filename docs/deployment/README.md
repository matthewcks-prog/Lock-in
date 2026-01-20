# Deployment Documentation

This folder contains all deployment and CI/CD documentation for Lock-in.

## Quick Navigation

- **[CI/CD Pipeline](./CICD.md)** - Complete CI/CD pipeline reference
- **[Azure Deployment](./AZURE.md)** - Azure Container Apps setup and deployment
- **[Environments](./ENVIRONMENTS.md)** - Environment strategy and configuration
- **[Rollback](./ROLLBACK.md)** - Emergency rollback procedures

## Quick Start

### First-Time Setup

```powershell
# Setup Azure resources and GitHub secrets
.\scripts\setup-ci-cd.ps1 `
  -SubscriptionId "your-subscription-id" `
  -ResourceGroupProduction "lock-in-prod" `
  -ContainerRegistryName "lockincr"

# Verify configuration
.\scripts\verify-ci-cd.ps1
```

### Daily Development

```bash
# Deploy to staging (develop branch)
git checkout develop
git commit -m "feat: your changes"
git push origin develop

# Watch deployment
gh run watch

# Deploy to production (merge to main via PR)
gh pr create --base main --head develop --title "Release: $(date +%Y-%m-%d)"
```

### Emergency Rollback

```bash
# List recent images
az acr repository show-tags --name <acr-name> --repository lock-in-backend --top 10

# Rollback via GitHub Actions
gh workflow run backend-rollback.yml -f environment=production -f image_tag=<commit-sha>
```

## GitHub Actions Workflows

| Workflow               | File                   | Purpose                        |
| ---------------------- | ---------------------- | ------------------------------ |
| Backend Build & Deploy | `backend-deploy.yml`   | Build Docker image and deploy  |
| Backend Rollback       | `backend-rollback.yml` | Emergency rollback             |
| Quality Gate           | `quality-gate.yml`     | Lint, test, format, type-check |

## Required GitHub Secrets

Configure these in GitHub Settings > Secrets and variables > Actions:

| Secret                         | Description                    | Required For    |
| ------------------------------ | ------------------------------ | --------------- |
| `AZURE_CREDENTIALS`            | Service Principal JSON         | All deployments |
| `AZURE_CONTAINER_REGISTRY`     | ACR name (without .azurecr.io) | All deployments |
| `AZURE_RESOURCE_GROUP`         | Production resource group      | Production      |
| `AZURE_RESOURCE_GROUP_STAGING` | Staging resource group         | Staging         |

## GitHub Environments

Configure these in GitHub Settings > Environments:

- **staging**: No required reviewers (auto-deploys from develop)
- **production**: ⚠️ **MUST** have required reviewers enabled for manual approval

## Architecture Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   develop   │──────>│   Staging   │       │     main    │
│   branch    │ push  │  lock-in-dev│       │   branch    │
└─────────────┘       └─────────────┘       └──────┬──────┘
                                                    │ PR merge
                                                    │ (with review)
                                                    ▼
                                            ┌─────────────┐
                                            │ Production  │
                                            │lock-in-     │
                                            │  backend    │
                                            └─────────────┘
```

## Support

- For CI/CD issues: See [CICD.md](./CICD.md)
- For Azure issues: See [AZURE.md](./AZURE.md)
- For environment config: See [ENVIRONMENTS.md](./ENVIRONMENTS.md)
