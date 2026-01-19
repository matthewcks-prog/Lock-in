# Azure Environment Architecture - Lock-in Backend

## 📋 Overview

Lock-in follows **industry-standard multi-environment deployment** with complete isolation between staging and production.

## 🏗️ Recommended Architecture

### **Option 1: Separate Resource Groups (RECOMMENDED)**

Complete isolation for staging and production environments:

```
Azure Subscription
├── Resource Group: lock-in-staging
│   ├── Container App: lock-in-dev
│   ├── Container Registry: lockinacrstaging
│   ├── Key Vault: lock-in-kv-staging
│   ├── App Insights: lock-in-insights-staging
│   ├── Log Analytics: lock-in-logs-staging
│   └── Container Environment: lock-in-env-staging
│
└── Resource Group: lock-in-production
    ├── Container App: lock-in-backend
    ├── Container Registry: lockinacrprod
    ├── Key Vault: lock-in-kv-prod
    ├── App Insights: lock-in-insights-prod
    ├── Log Analytics: lock-in-logs-prod
    └── Container Environment: lock-in-env-prod
```

**Benefits:**

- ✅ Complete resource isolation
- ✅ Independent RBAC and access policies
- ✅ Separate billing and cost tracking
- ✅ Can delete staging without affecting production
- ✅ Different scaling/performance tiers per environment

**Cost Considerations:**

- More resources = higher cost
- Can use lower tiers for staging (e.g., Consumption tier for Container Apps)
- Container Registry can be shared if needed (use separate repositories)

---

### **Option 2: Shared Resource Group (NOT RECOMMENDED)**

Single resource group with environment suffixes:

```
Azure Subscription
└── Resource Group: lock-in
    ├── Container App: lock-in-dev (staging)
    ├── Container App: lock-in-backend (production)
    ├── Container Registry: lockinacr (shared)
    ├── Key Vault: lock-in-kv (shared, separate secrets)
    └── App Insights/Logs: shared
```

**Downsides:**

- ❌ Shared RBAC (access to staging = access to production)
- ❌ Risk of accidental production changes
- ❌ Mixed billing/cost tracking
- ❌ Can't delete staging cleanly

---

## 🎯 Current Lock-in Setup (Based on Your Files)

### What You Have Now:

```
Resource Group: lock-in-dev (or similar)
├── Container App: lock-in-dev (staging)
├── Container App: lock-in-backend (production) ← MAYBE?
├── Container Registry: lockinacr
├── Azure OpenAI: lock-in-openai-dev
└── Key Vault: lock-in-kv
```

### What's Unclear:

- Is `lock-in-backend` deployed yet, or just referenced in CI/CD?
- Are both apps in the same resource group?
- Is this your staging-only setup, or mixed staging/production?

---

## ✅ Recommended Next Steps

### Step 1: Verify Current Setup

Check what's currently deployed:

```powershell
# List all resource groups
az group list --query "[].{Name:name, Location:location}" -o table

# Check what's in lock-in-dev resource group
az resource list --resource-group lock-in-dev --query "[].{Name:name, Type:type}" -o table

# Check Container Apps specifically
az containerapp list --query "[].{Name:name, ResourceGroup:resourceGroup, FQDN:properties.configuration.ingress.fqdn}" -o table
```

### Step 2: Plan Your Architecture

**For small team / cost-conscious:**

- Keep current `lock-in-dev` resource group for staging
- Create new `lock-in-production` resource group for production
- Share Container Registry (separate repositories: `lock-in-backend:staging`, `lock-in-backend:prod`)

**For enterprise / strict isolation:**

- Rename `lock-in-dev` → `lock-in-staging`
- Create `lock-in-production` resource group
- Separate Container Registries for each environment

### Step 3: Update CI/CD Pipeline

Your GitHub Actions workflow already supports this:

```yaml
# Staging deployment (develop branch)
deploy-staging:
  env:
    CONTAINER_APP_NAME: lock-in-dev
    RESOURCE_GROUP: ${{ secrets.AZURE_RESOURCE_GROUP_STAGING }}

# Production deployment (main branch)
deploy-production:
  env:
    CONTAINER_APP_NAME: lock-in-backend
    RESOURCE_GROUP: ${{ secrets.AZURE_RESOURCE_GROUP }}
```

**GitHub Secrets to Set:**

- `AZURE_RESOURCE_GROUP_STAGING` → `lock-in-staging` (or `lock-in-dev`)
- `AZURE_RESOURCE_GROUP` → `lock-in-production`

---

## 🔧 Environment Variable Configuration

### Staging Environment (lock-in-dev)

```bash
NODE_ENV=development  # Uses *_DEV Supabase variables
SUPABASE_URL_DEV=https://uszxfuzauetcchwcgufe.supabase.co
SUPABASE_SERVICE_ROLE_KEY_DEV=(from Key Vault)
AZURE_OPENAI_API_KEY=(can reuse same Azure OpenAI resource)
```

### Production Environment (lock-in-backend)

```bash
NODE_ENV=production  # Uses *_PROD Supabase variables
SUPABASE_URL_PROD=https://vtuflatvllpldohhimao.supabase.co
SUPABASE_SERVICE_ROLE_KEY_PROD=(from Key Vault)
AZURE_OPENAI_API_KEY=(same or separate Azure OpenAI resource)
```

---

## 📊 Comparison: Staging vs Production

| Aspect                 | Staging (lock-in-dev)      | Production (lock-in-backend) |
| ---------------------- | -------------------------- | ---------------------------- |
| **Deployment Trigger** | Push to `develop` branch   | Push to `main` branch        |
| **NODE_ENV**           | `development`              | `production`                 |
| **Supabase Project**   | Dev (uszxfuzauetcchwcgufe) | Prod (vtuflatvllpldohhimao)  |
| **Container App Name** | `lock-in-dev`              | `lock-in-backend`            |
| **Resource Group**     | `lock-in-staging`          | `lock-in-production`         |
| **Purpose**            | Pre-production testing     | Live users                   |
| **Data**               | Test data, can be wiped    | Real user data               |
| **Scaling**            | Lower (Consumption tier)   | Higher (Dedicated tier)      |
| **Monitoring**         | Optional                   | Critical (alerts, APM)       |

---

## 🚀 Migration Path (if consolidating)

If you want to move to separate resource groups:

### Phase 1: Create Production Resource Group

```bash
az group create --name lock-in-production --location australiaeast
```

### Phase 2: Create Production Resources

```bash
# Create Container App Environment
az containerapp env create \
  --name lock-in-env-prod \
  --resource-group lock-in-production \
  --location australiaeast

# Create Container App (will be deployed via CI/CD)
az containerapp create \
  --name lock-in-backend \
  --resource-group lock-in-production \
  --environment lock-in-env-prod \
  --image lockinacr.azurecr.io/lock-in-backend:latest \
  --target-port 3000 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3
```

### Phase 3: Update GitHub Secrets

```bash
# Set in GitHub: Settings > Secrets and variables > Actions
AZURE_RESOURCE_GROUP=lock-in-production
AZURE_RESOURCE_GROUP_STAGING=lock-in-dev  # or lock-in-staging
```

### Phase 4: Deploy

- Push to `develop` → deploys to staging
- Merge `develop` → `main` → deploys to production

---

## 🔐 Security Best Practices

1. **Key Vault per Environment**
   - Staging: `lock-in-kv-staging`
   - Production: `lock-in-kv-prod`
   - Store different credentials (Supabase prod keys ONLY in prod vault)

2. **RBAC Separation**
   - Developers: Read/write on staging, read-only on production
   - CI/CD Service Principal: Deploy permissions on both
   - Admins: Full access to production

3. **Network Isolation** (optional, advanced)
   - VNet integration for production
   - Private endpoints for Key Vault and databases

4. **Monitoring**
   - Separate Application Insights per environment
   - Production alerts for errors, latency, availability
   - Staging logs for debugging only

---

## 📝 Checklist

- [ ] Decide: Separate resource groups or shared?
- [ ] Verify current Azure resources: `az containerapp list`
- [ ] Create production resource group (if needed)
- [ ] Set up production Container App
- [ ] Configure GitHub Secrets for both environments
- [ ] Set environment variables in Azure Portal (Key Vault references)
- [ ] Test staging deployment: `git push origin develop`
- [ ] Test production deployment: Merge to `main`
- [ ] Verify health endpoints for both environments

---

## 🆘 Troubleshooting

### "Container failed to become healthy"

- Check logs: `az containerapp logs show --name lock-in-dev --resource-group lock-in-dev`
- Verify environment variables are set correctly
- Ensure `NODE_ENV` matches Supabase variable suffixes

### "Environment validation failed"

- Missing `SUPABASE_URL_DEV` or `SUPABASE_SERVICE_ROLE_KEY_DEV`
- Check Container App configuration in Azure Portal
- Verify Key Vault references are correct

### Docker Compose shows "production" environment

- Fixed in latest Dockerfile (NODE_ENV not hardcoded anymore)
- Restart Docker container: `docker-compose down && docker-compose up`
