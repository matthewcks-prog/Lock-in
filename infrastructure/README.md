# Lock-in Infrastructure

Infrastructure as Code (IaC) for the Lock-in backend using Azure Bicep.

## 📁 Files

- **`main.bicep`**: Production-ready Bicep template for Container App deployment
- **`deploy.ps1`**: Deployment script with validation and health checks
- **`validate.ps1`**: Post-deployment validation script

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Azure Container Apps                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          Container App (lock-in-backend)              │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  • Health Probes (Liveness, Readiness, Startup)      │  │
│  │  • Auto-scaling (HTTP, CPU, Memory)                   │  │
│  │  • Scale-to-zero (min: 0, max: 5)                     │  │
│  │  • HTTPS only, CORS configured                        │  │
│  │  • User Assigned Identity for Key Vault             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      Managed Environment (lock-in-env)                │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │  • Log Analytics integration                          │  │
│  │  • Shared networking and compute                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Logs
                            ▼
            ┌───────────────────────────────┐
            │    Log Analytics Workspace     │
            └───────────────────────────────┘

                            │
                            │ Secrets
                            ▼
            ┌───────────────────────────────┐
            │        Azure Key Vault         │
            ├───────────────────────────────┤
            │  • AZURE_OPENAI_API_KEY       │
            │  • SUPABASE_SERVICE_ROLE_KEY  │
            │  • SENTRY_DSN                 │
            └───────────────────────────────┘

                            │
                            │ Images
                            ▼
            ┌───────────────────────────────┐
            │  Azure Container Registry      │
            │       (lockinacr.io)          │
            └───────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

1. Azure CLI installed and logged in
2. Appropriate permissions on Azure subscription
3. Key Vault with required secrets configured
4. Container image pushed to ACR

### Deploy to Staging

```powershell
.\infrastructure\deploy.ps1 -Environment staging
```

### Deploy to Production

```powershell
.\infrastructure\deploy.ps1 -Environment production
```

### What-If Analysis (No Changes)

```powershell
.\infrastructure\deploy.ps1 -Environment staging -WhatIf
```

### Validate Deployment

```powershell
.\infrastructure\validate.ps1 -Environment staging
```

## 📋 Deployment Options

```powershell
.\infrastructure\deploy.ps1 `
  -Environment staging `             # Required: 'staging' or 'production'
  -ContainerImage <image:tag> `      # Optional: Override container image
  -SubscriptionId <sub-id> `         # Optional: Azure subscription ID
  -WhatIf `                          # Optional: Preview changes only
  -SkipValidation                    # Optional: Skip template validation
```

## 🏗️ Infrastructure Features

### Health Probes

The template configures **three types of health probes** for maximum reliability:

1. **Liveness Probe** - Restarts container if failing
   - Path: `/health`
   - Interval: 30s
   - Timeout: 5s
   - Failure threshold: 3

2. **Readiness Probe** - Removes from load balancer if failing
   - Path: `/health`
   - Interval: 10s
   - Timeout: 3s
   - Failure threshold: 3

3. **Startup Probe** - Allows slow container startup (60s grace period)
   - Path: `/health`
   - Interval: 5s
   - Failure threshold: 12 (60 seconds total)

### Auto-Scaling

Configured with **three scaling rules** for optimal performance:

1. **HTTP Concurrency Rule** (Primary)
   - Scale out when concurrent requests > 100

2. **CPU Utilization Rule** (Backup)
   - Scale out when CPU usage > 75%

3. **Memory Utilization Rule** (Backup)
   - Scale out when memory usage > 80%

**Scale range**: 0-5 replicas (scale-to-zero enabled)

### Secrets Management

All secrets are stored in Azure Key Vault and accessed via User-Assigned Managed Identity:

- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_ENDPOINT`
- `OPENAI_API_KEY`
- `SUPABASE_URL_PROD` / `SUPABASE_URL_DEV`
- `SUPABASE_ANON_KEY_PROD` / `SUPABASE_ANON_KEY_DEV`
- `SUPABASE_SERVICE_ROLE_KEY_PROD` / `SUPABASE_SERVICE_ROLE_KEY_DEV`
- `SENTRY_DSN`

**No secrets are stored in Bicep templates or source code.**

### Resource Tagging

All resources are tagged for governance and cost tracking:

- `Project: lock-in`
- `Environment: staging|production`
- `ManagedBy: Bicep`
- `CostCenter: Engineering`
- `Workload: Backend-API`

### Security Features

- ✅ HTTPS only (no HTTP)
- ✅ Non-root container user
- ✅ CORS configured
- ✅ Key Vault integration
- ✅ User-Assigned Managed Identity
- ✅ Network isolation via Container Apps Environment
- ✅ Minimal container image (Alpine-based)

## 🔧 Maintenance

### Update Container Image

```powershell
# Deploy specific image
.\infrastructure\deploy.ps1 `
  -Environment staging `
  -ContainerImage "lockinacr.azurecr.io/lock-in-backend:v1.2.3"
```

### Scale Configuration

Edit `main.bicep` parameters:

```bicep
@description('Minimum number of replicas (0 for scale-to-zero)')
param minReplicas int = 0

@description('Maximum number of replicas for autoscaling')
param maxReplicas int = 5
```

### View Deployment History

```bash
az deployment group list \
  --resource-group lock-in-dev \
  --output table
```

### Rollback to Previous Deployment

```bash
# List revisions
az containerapp revision list \
  --name lock-in-dev \
  --resource-group lock-in-dev \
  --output table

# Activate previous revision
az containerapp revision activate \
  --name lock-in-dev \
  --resource-group lock-in-dev \
  --revision <revision-name>
```

## 📊 Monitoring

### View Logs

```bash
# Real-time logs
az containerapp logs show \
  --name lock-in-dev \
  --resource-group lock-in-dev \
  --follow

# Last 50 entries
az containerapp logs show \
  --name lock-in-dev \
  --resource-group lock-in-dev \
  --tail 50
```

### Check Replica Status

```bash
az containerapp replica list \
  --name lock-in-dev \
  --resource-group lock-in-dev \
  --output table
```

### View Metrics

```bash
# Open in Azure Portal
az containerapp show \
  --name lock-in-dev \
  --resource-group lock-in-dev \
  --query "properties.configuration.ingress.fqdn" \
  --output tsv
```

## 🐛 Troubleshooting

### Container Not Starting

1. Check logs:

   ```bash
   az containerapp logs show --name lock-in-dev --resource-group lock-in-dev --tail 100
   ```

2. Check replica status:

   ```bash
   az containerapp replica list --name lock-in-dev --resource-group lock-in-dev
   ```

3. Verify Key Vault access:
   ```bash
   az keyvault secret show --vault-name lock-in-kv --name AZURE-OPENAI-API-KEY
   ```

### Health Checks Failing

1. Test health endpoint directly:

   ```bash
   curl https://lock-in-dev.australiaeast.azurecontainerapps.io/health
   ```

2. Check container logs for errors
3. Verify environment variables are set correctly
4. Check if Supabase/OpenAI credentials are valid

### Deployment Failures

1. Run validation:

   ```powershell
   .\infrastructure\deploy.ps1 -Environment staging -WhatIf
   ```

2. Check Azure activity log:

   ```bash
   az monitor activity-log list \
     --resource-group lock-in-dev \
     --max-events 10
   ```

3. Verify prerequisites:
   - Key Vault exists and is accessible
   - Log Analytics workspace exists
   - Container image exists in ACR
   - User-Assigned Identity has correct permissions

## 🔐 Security Best Practices

1. **Secrets**: Always use Key Vault, never hardcode
2. **RBAC**: Grant least privilege to managed identities
3. **HTTPS**: Enforce HTTPS-only traffic
4. **Updates**: Keep base images updated
5. **Scanning**: Run Trivy security scans in CI/CD
6. **Audit**: Review Azure activity logs regularly

## 📚 Additional Resources

- [Azure Container Apps Documentation](https://learn.microsoft.com/en-us/azure/container-apps/)
- [Bicep Documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/)
- [Azure Key Vault Best Practices](https://learn.microsoft.com/en-us/azure/key-vault/general/best-practices)
- [Container Apps Health Probes](https://learn.microsoft.com/en-us/azure/container-apps/health-probes)

## 🆘 Support

For issues or questions:

1. Check logs and metrics
2. Run validation script
3. Review troubleshooting section
4. Contact the infrastructure team
