#!/usr/bin/env pwsh
# =============================================================================
# Lock-in Backend - Azure CI/CD Setup Script
# =============================================================================
# This script sets up all required Azure resources and GitHub configurations
# for the CI/CD pipeline.
#
# Prerequisites:
# - Azure CLI installed and logged in (az login)
# - GitHub CLI installed and authenticated (gh auth login)
# - Owner or Contributor role on Azure subscription
# =============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$SubscriptionId,
    
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroupProduction,
    
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroupStaging = $ResourceGroupProduction,
    
    [Parameter(Mandatory=$true)]
    [string]$ContainerRegistryName,
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "australiaeast",
    
    [Parameter(Mandatory=$false)]
    [string]$ServicePrincipalName = "github-actions-lock-in"
)

# Colors for output
$ErrorColor = "Red"
$SuccessColor = "Green"
$InfoColor = "Cyan"
$WarningColor = "Yellow"

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor $InfoColor
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor $SuccessColor
}

function Write-Fail {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor $ErrorColor
}

function Write-Warn {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor $WarningColor
}

# =============================================================================
# Step 1: Verify Prerequisites
# =============================================================================
Write-Step "Verifying prerequisites..."

# Check Azure CLI
try {
    $azVersion = az --version 2>&1 | Select-String "azure-cli" | ForEach-Object { $_.ToString() }
    Write-Success "Azure CLI installed: $azVersion"
} catch {
    Write-Fail "Azure CLI not found. Install from: https://aka.ms/InstallAzureCli"
    exit 1
}

# Check GitHub CLI
try {
    $ghVersion = gh --version 2>&1 | Select-String "gh version" | ForEach-Object { $_.ToString() }
    Write-Success "GitHub CLI installed: $ghVersion"
} catch {
    Write-Fail "GitHub CLI not found. Install from: https://cli.github.com"
    exit 1
}

# Check Azure login
Write-Step "Checking Azure authentication..."
$currentAccount = az account show 2>&1 | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Not logged into Azure. Run: az login"
    exit 1
}
Write-Success "Logged in as: $($currentAccount.user.name)"

# Set subscription
Write-Step "Setting Azure subscription..."
az account set --subscription $SubscriptionId
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Failed to set subscription. Check subscription ID."
    exit 1
}
Write-Success "Using subscription: $SubscriptionId"

# Check GitHub login
Write-Step "Checking GitHub authentication..."
$ghAuth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Not logged into GitHub. Run: gh auth login"
    exit 1
}
Write-Success "Authenticated with GitHub"

# Get repository info
$repoInfo = gh repo view --json nameWithOwner | ConvertFrom-Json
$repoName = $repoInfo.nameWithOwner
Write-Success "Working with repository: $repoName"

# =============================================================================
# Step 2: Create or Verify Resource Groups
# =============================================================================
Write-Step "Setting up resource groups..."

# Production resource group
$rgCheck = az group show --name $ResourceGroupProduction 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating resource group: $ResourceGroupProduction"
    az group create --name $ResourceGroupProduction --location $Location
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Created resource group: $ResourceGroupProduction"
    } else {
        Write-Fail "Failed to create resource group"
        exit 1
    }
} else {
    Write-Success "Resource group exists: $ResourceGroupProduction"
}

# Staging resource group (if different)
if ($ResourceGroupStaging -ne $ResourceGroupProduction) {
    $rgCheck = az group show --name $ResourceGroupStaging 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Creating resource group: $ResourceGroupStaging"
        az group create --name $ResourceGroupStaging --location $Location
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Created resource group: $ResourceGroupStaging"
        } else {
            Write-Fail "Failed to create resource group"
            exit 1
        }
    } else {
        Write-Success "Resource group exists: $ResourceGroupStaging"
    }
}

# =============================================================================
# Step 3: Create or Verify Azure Container Registry
# =============================================================================
Write-Step "Setting up Azure Container Registry..."

$acrCheck = az acr show --name $ContainerRegistryName --resource-group $ResourceGroupProduction 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating ACR: $ContainerRegistryName"
    az acr create `
        --name $ContainerRegistryName `
        --resource-group $ResourceGroupProduction `
        --location $Location `
        --sku Standard `
        --admin-enabled false
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Created ACR: $ContainerRegistryName"
    } else {
        Write-Fail "Failed to create ACR"
        exit 1
    }
} else {
    Write-Success "ACR exists: $ContainerRegistryName"
}

# Get ACR resource ID
$acrId = az acr show `
    --name $ContainerRegistryName `
    --resource-group $ResourceGroupProduction `
    --query "id" -o tsv

# =============================================================================
# Step 4: Create Service Principal for GitHub Actions
# =============================================================================
Write-Step "Creating Service Principal for GitHub Actions..."

# Check if SP already exists
$spCheck = az ad sp list --display-name $ServicePrincipalName --query "[0].appId" -o tsv 2>&1
if ($spCheck -and $LASTEXITCODE -eq 0) {
    Write-Warn "Service Principal already exists: $ServicePrincipalName"
    Write-Host "Fetching existing credentials..."
    $spAppId = $spCheck
    
    # Reset credentials
    $spCredentials = az ad sp credential reset `
        --id $spAppId `
        --query "{clientId: appId, clientSecret: password, tenantId: tenant}" -o json
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Reset Service Principal credentials"
    } else {
        Write-Fail "Failed to reset credentials"
        exit 1
    }
} else {
    # Create new service principal
    Write-Host "Creating new Service Principal..."
    
    # Create with contributor role on resource group
    $spCredentials = az ad sp create-for-rbac `
        --name $ServicePrincipalName `
        --role Contributor `
        --scopes "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroupProduction" `
        --query "{clientId: appId, clientSecret: password, tenantId: tenant}" -o json
    
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Failed to create Service Principal"
        exit 1
    }
    
    Write-Success "Created Service Principal: $ServicePrincipalName"
}

# Parse credentials
$sp = $spCredentials | ConvertFrom-Json
$spAppId = $sp.clientId

# Wait for SP propagation
Write-Host "Waiting for Service Principal propagation..."
Start-Sleep -Seconds 10

# =============================================================================
# Step 5: Assign Roles to Service Principal
# =============================================================================
Write-Step "Assigning roles to Service Principal..."

# Assign AcrPush role
Write-Host "Assigning AcrPush role on ACR..."
$acrRoleCheck = az role assignment list `
    --assignee $spAppId `
    --scope $acrId `
    --role AcrPush `
    --query "[0].id" -o tsv 2>&1

if (-not $acrRoleCheck -or $LASTEXITCODE -ne 0) {
    az role assignment create `
        --assignee $spAppId `
        --scope $acrId `
        --role AcrPush
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Assigned AcrPush role"
    } else {
        Write-Warn "Failed to assign AcrPush role (may already exist)"
    }
} else {
    Write-Success "AcrPush role already assigned"
}

# If staging is different, assign contributor role there too
if ($ResourceGroupStaging -ne $ResourceGroupProduction) {
    Write-Host "Assigning Contributor role on staging resource group..."
    az role assignment create `
        --assignee $spAppId `
        --scope "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroupStaging" `
        --role Contributor 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Assigned Contributor role on staging RG"
    } else {
        Write-Warn "Failed to assign role (may already exist)"
    }
}

# =============================================================================
# Step 6: Create Azure Credentials JSON
# =============================================================================
Write-Step "Creating Azure credentials JSON..."

$azureCredentials = @{
    clientId = $sp.clientId
    clientSecret = $sp.clientSecret
    subscriptionId = $SubscriptionId
    tenantId = $sp.tenantId
} | ConvertTo-Json -Compress

# =============================================================================
# Step 7: Set GitHub Secrets
# =============================================================================
Write-Step "Setting GitHub secrets..."

# Set AZURE_CREDENTIALS
Write-Host "Setting AZURE_CREDENTIALS..."
echo $azureCredentials | gh secret set AZURE_CREDENTIALS
if ($LASTEXITCODE -eq 0) {
    Write-Success "Set AZURE_CREDENTIALS"
} else {
    Write-Fail "Failed to set AZURE_CREDENTIALS"
}

# Set AZURE_CONTAINER_REGISTRY
Write-Host "Setting AZURE_CONTAINER_REGISTRY..."
echo $ContainerRegistryName | gh secret set AZURE_CONTAINER_REGISTRY
if ($LASTEXITCODE -eq 0) {
    Write-Success "Set AZURE_CONTAINER_REGISTRY"
} else {
    Write-Fail "Failed to set AZURE_CONTAINER_REGISTRY"
}

# Set AZURE_RESOURCE_GROUP
Write-Host "Setting AZURE_RESOURCE_GROUP..."
echo $ResourceGroupProduction | gh secret set AZURE_RESOURCE_GROUP
if ($LASTEXITCODE -eq 0) {
    Write-Success "Set AZURE_RESOURCE_GROUP"
} else {
    Write-Fail "Failed to set AZURE_RESOURCE_GROUP"
}

# Set AZURE_RESOURCE_GROUP_STAGING
Write-Host "Setting AZURE_RESOURCE_GROUP_STAGING..."
echo $ResourceGroupStaging | gh secret set AZURE_RESOURCE_GROUP_STAGING
if ($LASTEXITCODE -eq 0) {
    Write-Success "Set AZURE_RESOURCE_GROUP_STAGING"
} else {
    Write-Fail "Failed to set AZURE_RESOURCE_GROUP_STAGING"
}

# =============================================================================
# Step 8: Create GitHub Environments
# =============================================================================
Write-Step "Creating GitHub environments..."

# Create staging environment
Write-Host "Creating 'staging' environment..."
gh api --method PUT "repos/$repoName/environments/staging" 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Success "Created staging environment"
} else {
    Write-Warn "Staging environment may already exist"
}

# Create production environment
Write-Host "Creating 'production' environment..."
gh api --method PUT "repos/$repoName/environments/production" 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Success "Created production environment"
} else {
    Write-Warn "Production environment may already exist"
}

# =============================================================================
# Summary
# =============================================================================
Write-Host "`n" -NoNewline
Write-Host "=============================================" -ForegroundColor $SuccessColor
Write-Host "🎉 CI/CD SETUP COMPLETE!" -ForegroundColor $SuccessColor
Write-Host "=============================================" -ForegroundColor $SuccessColor
Write-Host ""
Write-Host "📋 Configuration Summary:" -ForegroundColor $InfoColor
Write-Host "  Subscription ID:         $SubscriptionId"
Write-Host "  Production RG:           $ResourceGroupProduction"
Write-Host "  Staging RG:              $ResourceGroupStaging"
Write-Host "  Container Registry:      $ContainerRegistryName.azurecr.io"
Write-Host "  Service Principal:       $ServicePrincipalName"
Write-Host ""
Write-Host "🔐 GitHub Secrets Set:" -ForegroundColor $InfoColor
Write-Host "  ✅ AZURE_CREDENTIALS"
Write-Host "  ✅ AZURE_CONTAINER_REGISTRY"
Write-Host "  ✅ AZURE_RESOURCE_GROUP"
Write-Host "  ✅ AZURE_RESOURCE_GROUP_STAGING"
Write-Host ""
Write-Host "🌍 GitHub Environments Created:" -ForegroundColor $InfoColor
Write-Host "  ✅ staging (auto-deploy from develop)"
Write-Host "  ✅ production (deploy from main)"
Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor $InfoColor
Write-Host "  1. Review environment protection rules:"
Write-Host "     https://github.com/$repoName/settings/environments"
Write-Host ""
Write-Host "  2. Add required reviewers for production environment"
Write-Host ""
Write-Host "  3. Create Container Apps (if not exists):"
Write-Host "     az containerapp create \\"
Write-Host "       --name lock-in-dev \\"
Write-Host "       --resource-group $ResourceGroupStaging \\"
Write-Host "       --environment <your-container-app-env> \\"
Write-Host "       --image $ContainerRegistryName.azurecr.io/lock-in-backend:latest \\"
Write-Host "       --target-port 3000"
Write-Host ""
Write-Host "  4. Test the pipeline:"
Write-Host "     git checkout develop"
Write-Host "     git commit --allow-empty -m 'test: trigger CI/CD'"
Write-Host "     git push origin develop"
Write-Host ""
Write-Host "=============================================" -ForegroundColor $SuccessColor
