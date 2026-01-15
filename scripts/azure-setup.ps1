# =============================================================================
# Lock-in Backend - Azure Container Apps Infrastructure Setup
# Run this script to create all required Azure resources
# =============================================================================
# Prerequisites:
#   - Azure CLI installed and logged in (az login)
#   - Sufficient permissions to create resources
# =============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroup,
    
    [Parameter(Mandatory=$true)]
    [string]$Location,
    
    [string]$AppName = "lock-in-backend",
    [string]$AcrName = "lockinacr",
    [string]$EnvironmentName = "lock-in-env",
    [string]$KeyVaultName = "lock-in-kv"
)

$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Lock-in Azure Infrastructure Setup" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# =============================================================================
# Step 1: Create Resource Group
# =============================================================================
Write-Host "[1/7] Creating Resource Group: $ResourceGroup" -ForegroundColor Yellow

az group create `
    --name $ResourceGroup `
    --location $Location `
    --output none

Write-Host "[OK] Resource Group created" -ForegroundColor Green

# =============================================================================
# Step 2: Create Azure Container Registry
# =============================================================================
Write-Host "[2/7] Creating Azure Container Registry: $AcrName" -ForegroundColor Yellow

az acr create `
    --resource-group $ResourceGroup `
    --name $AcrName `
    --sku Basic `
    --admin-enabled true `
    --output none

$acrLoginServer = az acr show --name $AcrName --query loginServer -o tsv
$acrUsername = az acr credential show --name $AcrName --query username -o tsv
$acrPassword = az acr credential show --name $AcrName --query "passwords[0].value" -o tsv

Write-Host "[OK] ACR created: $acrLoginServer" -ForegroundColor Green

# =============================================================================
# Step 3: Create Azure Key Vault for Secrets
# =============================================================================
Write-Host "[3/7] Creating Azure Key Vault: $KeyVaultName" -ForegroundColor Yellow

az keyvault create `
    --resource-group $ResourceGroup `
    --name $KeyVaultName `
    --location $Location `
    --enable-rbac-authorization false `
    --output none

Write-Host "[OK] Key Vault created" -ForegroundColor Green
Write-Host ""
Write-Host "[!] ACTION REQUIRED: Add secrets to Key Vault:" -ForegroundColor Yellow
Write-Host "   az keyvault secret set --vault-name $KeyVaultName --name OPENAI-API-KEY --value 'your-key'" -ForegroundColor Gray
Write-Host "   az keyvault secret set --vault-name $KeyVaultName --name SUPABASE-URL --value 'your-url'" -ForegroundColor Gray
Write-Host "   az keyvault secret set --vault-name $KeyVaultName --name SUPABASE-SERVICE-ROLE-KEY --value 'your-key'" -ForegroundColor Gray
Write-Host "   az keyvault secret set --vault-name $KeyVaultName --name SENTRY-DSN --value 'your-dsn'" -ForegroundColor Gray
Write-Host ""

# =============================================================================
# Step 4: Create Log Analytics Workspace
# =============================================================================
Write-Host "[4/7] Creating Log Analytics Workspace" -ForegroundColor Yellow

$workspaceName = "$AppName-logs"
az monitor log-analytics workspace create `
    --resource-group $ResourceGroup `
    --workspace-name $workspaceName `
    --location $Location `
    --output none

$workspaceId = az monitor log-analytics workspace show `
    --resource-group $ResourceGroup `
    --workspace-name $workspaceName `
    --query customerId -o tsv

$workspaceKey = az monitor log-analytics workspace get-shared-keys `
    --resource-group $ResourceGroup `
    --workspace-name $workspaceName `
    --query primarySharedKey -o tsv

Write-Host "[OK] Log Analytics Workspace created" -ForegroundColor Green

# =============================================================================
# Step 5: Create Container Apps Environment
# =============================================================================
Write-Host "[5/7] Creating Container Apps Environment: $EnvironmentName" -ForegroundColor Yellow

az containerapp env create `
    --resource-group $ResourceGroup `
    --name $EnvironmentName `
    --location $Location `
    --logs-workspace-id $workspaceId `
    --logs-workspace-key $workspaceKey `
    --output none

Write-Host "[OK] Container Apps Environment created" -ForegroundColor Green

# =============================================================================
# Step 6: Build and Push Initial Image
# =============================================================================
Write-Host "[6/7] Building and pushing initial Docker image" -ForegroundColor Yellow

# Login to ACR
az acr login --name $AcrName

# Build and push from project root
az acr build `
    --registry $AcrName `
    --image "${AppName}:initial" `
    --file backend/Dockerfile `
    .

Write-Host "[OK] Initial image pushed to ACR" -ForegroundColor Green

# =============================================================================
# Step 7: Create Container App
# =============================================================================
Write-Host "[7/7] Creating Container App: $AppName" -ForegroundColor Yellow

az containerapp create `
    --resource-group $ResourceGroup `
    --name $AppName `
    --environment $EnvironmentName `
    --image "${acrLoginServer}/${AppName}:initial" `
    --registry-server $acrLoginServer `
    --registry-username $acrUsername `
    --registry-password $acrPassword `
    --target-port 3000 `
    --ingress external `
    --min-replicas 1 `
    --max-replicas 5 `
    --cpu 1.0 `
    --memory 2.0Gi `
    --env-vars NODE_ENV=production PORT=3000 TRANSCRIPTION_TEMP_DIR=/tmp/transcripts `
    --output none

Write-Host "[OK] Container App created" -ForegroundColor Green

# =============================================================================
# Get App URL and Summary
# =============================================================================
$appUrl = az containerapp show `
    --resource-group $ResourceGroup `
    --name $AppName `
    --query "properties.configuration.ingress.fqdn" -o tsv

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Resources Created:" -ForegroundColor White
Write-Host "  - Resource Group:     $ResourceGroup" -ForegroundColor Gray
Write-Host "  - Container Registry: $acrLoginServer" -ForegroundColor Gray
Write-Host "  - Key Vault:          $KeyVaultName" -ForegroundColor Gray
Write-Host "  - Container App:      https://$appUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Add secrets to Key Vault - see commands above" -ForegroundColor White
Write-Host "  2. Configure Container App secrets from Key Vault" -ForegroundColor White
Write-Host "  3. Update environment variables to reference secrets" -ForegroundColor White
Write-Host "  4. Configure GitHub Actions secrets:" -ForegroundColor White
Write-Host "     AZURE_CONTAINER_REGISTRY = $AcrName" -ForegroundColor Gray
Write-Host "     AZURE_RESOURCE_GROUP     = $ResourceGroup" -ForegroundColor Gray
Write-Host "     ACR_USERNAME             = $acrUsername" -ForegroundColor Gray
Write-Host "     ACR_PASSWORD             = [saved securely]" -ForegroundColor Gray
Write-Host "  5. Run database migrations in Supabase" -ForegroundColor White
Write-Host "  6. Create Supabase Storage buckets: note-assets, chat-assets" -ForegroundColor White
Write-Host "  7. Update api/client.ts with new API URL" -ForegroundColor White
Write-Host ""
Write-Host "Test your deployment:" -ForegroundColor Yellow
Write-Host "  curl https://$appUrl/health" -ForegroundColor Gray
Write-Host ""

# Output values for reference
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Configuration Values - save these:" -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "ACR_LOGIN_SERVER=$acrLoginServer"
Write-Host "ACR_USERNAME=$acrUsername"
Write-Host "ACR_PASSWORD=$acrPassword"
Write-Host "APP_URL=https://$appUrl"


