# Lock-in Environment & Deployment Guide

This document explains the industry-standard development workflow and deployment pipeline for Lock-in.

## 🌍 Environment Overview

| Environment    | Branch    | Azure Resource    | Purpose                                    |
| -------------- | --------- | ----------------- | ------------------------------------------ |
| **Local Dev**  | any       | N/A               | Local development with hot reload          |
| **Staging**    | `develop` | `lock-in-dev`     | Pre-production testing, feature validation |
| **Production** | `main`    | `lock-in-backend` | Live production environment                |

## 🔄 Development Workflow

### Branch Strategy (GitFlow-inspired)

```
main (protected)           ← Production deployments
  ↑
  │ PR with review
  │
develop                    ← Staging deployments, integration testing
  ↑
  │ PR or direct push
  │
feature/xyz                ← Your feature branches
```

### Day-to-Day Development

#### 1. Start New Feature

```bash
# Always branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/my-feature
```

#### 2. Local Development

```bash
# Extension (with hot reload)
npm run dev

# Backend (separate terminal)
cd backend
npm run dev
```

**What each command does:**

- `npm run dev` (root): Watches and rebuilds the extension on file changes
- `npm run dev` (backend): Runs backend with nodemon for auto-restart

#### 3. Test Before Pushing

```bash
# Run full validation (recommended before pushing)
npm run prepush

# Or individually:
npm run type-check    # TypeScript errors
npm run lint          # Code style issues
npm run test          # Unit tests
npm run build         # Build extension
npm run verify-build  # Verify build output
```

#### 4. Push to Feature Branch

```bash
git add .
git commit -m "feat: your feature description"
git push origin feature/my-feature
```

#### 5. Create PR to Develop

```bash
# Creates PR to merge into develop
gh pr create --base develop --title "feat: my feature"
```

Once merged to `develop`, the staging deployment automatically triggers.

#### 6. Promote to Production

When staging is verified:

```bash
# Create PR from develop to main
gh pr create --base main --head develop --title "Release: feature description"
```

After review and merge, production deployment automatically triggers.

---

## 📦 What Gets Built

### Extension (`npm run build`)

The extension build creates:

```
extension/
├── dist/
│   ├── ui/                  # React sidebar bundle
│   ├── libs/                # initApi, contentLibs, webvttParser
│   └── ...
├── manifest.json
└── ...
```

**Use `npm run build` when:**

- Preparing for Chrome Web Store submission
- Testing production build locally
- Before committing (via `npm run prepush`)

**Use `npm run dev` when:**

- Actively developing features
- Debugging issues
- Hot reload is needed

### Backend (`docker build`)

Backend is containerized and deployed via CI/CD:

```
Docker Image → Azure Container Registry → Azure Container Apps
```

---

## 🚀 Deployment Pipeline

### Automatic Deployments

| Trigger                | Action                                       |
| ---------------------- | -------------------------------------------- |
| Push to `develop`      | Deploy to **Staging** (`lock-in-dev`)        |
| Push to `main`         | Deploy to **Production** (`lock-in-backend`) |
| PR to `develop`/`main` | Run tests only (no deploy)                   |

### Manual Deployment

You can manually deploy from GitHub Actions:

1. Go to Actions → "Backend CI/CD"
2. Click "Run workflow"
3. Select environment: `staging` or `production`
4. Click "Run workflow"

### What CI/CD Does

1. **Build & Test** - Runs tests, builds Docker image, health check
2. **Push to ACR** - Pushes image to Azure Container Registry
3. **Deploy** - Updates Azure Container App with new image
4. **Verify** - Checks `/health` endpoint responds

---

## 🔐 Required GitHub Secrets

Configure these in: **Settings → Secrets and variables → Actions**

| Secret                         | Description                            | Example                    |
| ------------------------------ | -------------------------------------- | -------------------------- |
| `AZURE_CREDENTIALS`            | Service principal JSON for Azure login | `{"clientId": "...", ...}` |
| `AZURE_CONTAINER_REGISTRY`     | ACR name (without .azurecr.io)         | `lockinacr`                |
| `AZURE_RESOURCE_GROUP`         | Production resource group              | `lock-in-prod`             |
| `AZURE_RESOURCE_GROUP_STAGING` | Staging resource group (can be same)   | `lock-in-dev`              |
| `ACR_USERNAME`                 | ACR admin username                     | `lockinacr`                |
| `ACR_PASSWORD`                 | ACR admin password                     | `...`                      |

> **Note**: If `AZURE_RESOURCE_GROUP_STAGING` is not set, you can use the same value as `AZURE_RESOURCE_GROUP` if staging and production are in the same resource group.

### Creating Service Principal

```bash
az ad sp create-for-rbac \
  --name "github-actions-lock-in" \
  --role contributor \
  --scopes /subscriptions/{subscription-id}/resourceGroups/{resource-group} \
  --sdk-auth
```

---

## 🌿 GitHub Environments

Configure in: **Settings → Environments**

### Staging Environment

- Name: `staging`
- No required reviewers (auto-deploy)
- Optional: Add staging-specific secrets

### Production Environment

- Name: `production`
- **Recommended**: Add required reviewers for manual approval
- Add production-specific secrets if different from staging

---

## 🧪 Testing Strategy

### Local Testing

```bash
# All tests
npm run test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

### Backend Testing

```bash
cd backend
npm test
```

### What Gets Tested

- **Frontend tests** (Vitest): `core/`, `ui/`, `integrations/`, `api/`
- **Backend tests** (Node test runner): `backend/`
- **Backend integration tests**: Excluded from Vitest, run separately in CI

---

## 🔧 Common Scenarios

### "I want to add a new feature"

```bash
git checkout develop
git pull origin develop
git checkout -b feature/new-thing
# ... make changes ...
npm run prepush  # Validate everything
git add . && git commit -m "feat: new thing"
git push origin feature/new-thing
gh pr create --base develop
```

### "I need to hotfix production"

```bash
git checkout main
git pull origin main
git checkout -b hotfix/fix-bug
# ... fix the bug ...
npm run prepush
git add . && git commit -m "fix: critical bug"
git push origin hotfix/fix-bug
gh pr create --base main  # Direct to main for hotfix
```

### "Staging is broken, I need to rollback"

```bash
# Find the last working image
az acr repository show-tags --name <acr-name> --repository lock-in-backend

# Deploy specific image
az containerapp update \
  --name lock-in-dev \
  --resource-group <rg> \
  --image <acr>.azurecr.io/lock-in-backend:<previous-sha>
```

### "I want to test my branch on staging"

```bash
# Merge your feature into develop
git checkout develop
git merge feature/my-feature
git push origin develop
# Staging deployment auto-triggers
```

---

## 📊 Environment Variables

### Development (Local)

Create `.env` files:

- Root `.env` - Extension environment variables
- `backend/.env` - Backend environment variables

### Staging/Production

Environment variables are configured in Azure Container Apps:

- **Staging**: `lock-in-dev` container app settings
- **Production**: `lock-in-backend` container app settings

---

## 🎯 Best Practices

1. **Never push directly to `main`** - Always go through PR
2. **Test on staging first** - Merge to `develop`, verify, then promote
3. **Run `npm run prepush` before pushing** - Catches issues early
4. **Use meaningful commit messages** - Follows conventional commits
5. **Keep PRs small** - Easier to review and safer to deploy
6. **Monitor after deployment** - Check logs and health endpoints

---

## 🔗 Related Documentation

- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines
- [backend/README.md](./backend/README.md) - Backend-specific documentation
- [docs/AZURE_DEPLOYMENT.md](./docs/AZURE_DEPLOYMENT.md) - Azure setup details
