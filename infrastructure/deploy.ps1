# =============================================================================
# Lock-in Infrastructure Deployment Script
# Deploys Container App infrastructure using Bicep with validation
#
# Usage:
#   .\infrastructure\deploy.ps1 -Environment staging
#   .\infrastructure\deploy.ps1 -Environment production -WhatIf
# =============================================================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("staging", "production")]
    [string]$Environment = "staging",

    [Parameter(Mandatory=$false)]
    [string]$SubscriptionId = "473adbd3-1a70-4074-aa01-5451673d058b",

    [Parameter(Mandatory=$false)]
    [string]$ContainerImage = "lockinacr.azurecr.io/lock-in-backend:latest",

    [Parameter(Mandatory=$false)]
    [switch]$WhatIf,

    [Parameter(Mandatory=$false)]
    [switch]$SkipValidation
)

$ErrorActionPreference = "Stop"

# =============================================================================
# Configuration
# =============================================================================
$ResourceGroupMap = @{
    "staging" = "lock-in-dev"
    "production" = "lock-in-prod"
}

$ResourceGroup = $ResourceGroupMap[$Environment]
$TemplateFile = "./infrastructure/main.bicep"

# =============================================================================
# Validation Functions
# =============================================================================
function Test-Prerequisites {
    Write-Host "Checking prerequisites..." -ForegroundColor Cyan

    # Check Azure CLI
    try {
        $azVersion = az version | ConvertFrom-Json
        Write-Host "  OK Azure CLI: $($azVersion.'azure-cli')" -ForegroundColor Green
    } catch {
        Write-Host "  ERROR Azure CLI not found. Please install: https://aka.ms/install-azure-cli" -ForegroundColor Red
        exit 1
    }

    # Check logged in
    try {
        $account = az account show | ConvertFrom-Json
        Write-Host "  OK Logged in as: $($account.user.name)" -ForegroundColor Green
    } catch {
        Write-Host "  ERROR Not logged in. Run: az login" -ForegroundColor Red
        exit 1
    }

    # Check template file exists
    if (-not (Test-Path $TemplateFile)) {
        Write-Host "  ERROR Template file not found: $TemplateFile" -ForegroundColor Red
        exit 1
    }
    Write-Host "  OK Template file found" -ForegroundColor Green

    # Check resource group exists
    $rgExists = az group exists --name $ResourceGroup
    if ($rgExists -eq "false") {
        Write-Host "  ERROR Resource group '$ResourceGroup' does not exist" -ForegroundColor Red
        exit 1
    }
    Write-Host "  OK Resource group '$ResourceGroup' exists" -ForegroundColor Green

    Write-Host ""
}

function Test-BicepTemplate {
    Write-Host "Validating Bicep template..." -ForegroundColor Cyan

    try {
        az deployment group validate `
            --resource-group $ResourceGroup `
            --template-file $TemplateFile `
            --parameters environment=$Environment containerImage=$ContainerImage `
            --output none

        Write-Host "  OK Template validation passed" -ForegroundColor Green
    } catch {
        Write-Host "  ERROR Template validation failed" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        exit 1
    }

    Write-Host ""
}

function Show-WhatIfChanges {
    Write-Host "What-If Analysis..." -ForegroundColor Cyan
    Write-Host ""

    az deployment group what-if `
        --resource-group $ResourceGroup `
        --template-file $TemplateFile `
        --parameters environment=$Environment containerImage=$ContainerImage

    Write-Host ""
}

# =============================================================================
# Main Deployment
# =============================================================================
function Start-Deployment {
    Write-Host "Starting Bicep Deployment..." -ForegroundColor Cyan
    Write-Host "  Environment: $Environment" -ForegroundColor Yellow
    Write-Host "  Resource Group: $ResourceGroup" -ForegroundColor Yellow
    Write-Host "  Subscription: $SubscriptionId" -ForegroundColor Yellow
    Write-Host "  Container Image: $ContainerImage" -ForegroundColor Yellow
    Write-Host ""

    # Ensure we are in the correct subscription
    az account set --subscription $SubscriptionId

    # Deploy
    $deploymentName = "lock-in-deployment-$(Get-Date -Format 'yyyyMMddHHmmss')"

    Write-Host "  Deployment name: $deploymentName" -ForegroundColor Gray
    Write-Host ""

    $result = az deployment group create `
        --name $deploymentName `
        --resource-group $ResourceGroup `
        --template-file $TemplateFile `
        --parameters environment=$Environment containerImage=$ContainerImage `
        --output json | ConvertFrom-Json

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Deployment failed!" -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "Deployment Complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Deployment Outputs:" -ForegroundColor Cyan
    Write-Host "  Container App URL: https://$($result.properties.outputs.containerAppUrl.value)" -ForegroundColor Yellow
    Write-Host "  Container App Name: $($result.properties.outputs.containerAppName.value)" -ForegroundColor Yellow
    Write-Host "  Environment: $($result.properties.outputs.environmentName.value)" -ForegroundColor Yellow
    Write-Host ""

    return $result
}

function Test-Deployment {
    param($DeploymentResult)

    Write-Host "Testing deployment..." -ForegroundColor Cyan

    $appUrl = "https://$($DeploymentResult.properties.outputs.containerAppUrl.value)"
    $healthUrl = "$appUrl/health"

    Write-Host "  Health endpoint: $healthUrl" -ForegroundColor Gray
    Write-Host "  Waiting for container to be ready..." -ForegroundColor Yellow

    $maxAttempts = 12
    $attempt = 0
    $waitTime = 10

    while ($attempt -lt $maxAttempts) {
        $attempt++
        Write-Host "  Attempt $attempt/$maxAttempts..." -ForegroundColor Gray

        try {
            $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Host "  OK Health check passed!" -ForegroundColor Green
                Write-Host ""
                Write-Host "Deployment successful and healthy!" -ForegroundColor Green
                Write-Host "  URL: $appUrl" -ForegroundColor Yellow
                return $true
            }
        } catch {
            # Ignore and retry
        }

        if ($attempt -lt $maxAttempts) {
            Start-Sleep -Seconds $waitTime
        }
    }

    Write-Host "  WARNING Health check timed out. Deployment may still be starting." -ForegroundColor Yellow
    Write-Host "  Check manually: $healthUrl" -ForegroundColor Yellow
    return $false
}

# =============================================================================
# Execution
# =============================================================================
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host " Lock-in Infrastructure Deployment" -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""

# Pre-flight checks
Test-Prerequisites

if (-not $SkipValidation) {
    Test-BicepTemplate
}

# What-if analysis
if ($WhatIf) {
    Show-WhatIfChanges
    Write-Host "INFO What-If mode: No changes made." -ForegroundColor Cyan
    exit 0
}

# Deploy
$deploymentResult = Start-Deployment

# Post-deployment validation
Test-Deployment -DeploymentResult $deploymentResult

Write-Host ""
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host " Deployment Complete" -ForegroundColor Green
Write-Host "===============================================================" -ForegroundColor Cyan
