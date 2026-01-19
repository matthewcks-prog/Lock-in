#!/usr/bin/env pwsh
# =============================================================================
# Lock-in Backend - CI/CD Configuration Validator
# =============================================================================
# Validates that all required secrets, environments, and Azure resources
# are properly configured for the CI/CD pipeline
# =============================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$SubscriptionId,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipAzure
)

$ErrorActionPreference = "Continue"

# Colors
$ErrorColor = "Red"
$SuccessColor = "Green"
$InfoColor = "Cyan"
$WarningColor = "Yellow"

function Write-Check {
    param([string]$Message)
    Write-Host "`n🔍 Checking: $Message" -ForegroundColor $InfoColor
}

function Write-Pass {
    param([string]$Message)
    Write-Host "  ✅ $Message" -ForegroundColor $SuccessColor
}

function Write-Fail {
    param([string]$Message)
    Write-Host "  ❌ $Message" -ForegroundColor $ErrorColor
}

function Write-Warn {
    param([string]$Message)
    Write-Host "  ⚠️  $Message" -ForegroundColor $WarningColor
}

$issuesFound = 0

Write-Host "=============================================" -ForegroundColor $InfoColor
Write-Host "CI/CD Configuration Validator" -ForegroundColor $InfoColor
Write-Host "=============================================" -ForegroundColor $InfoColor

# =============================================================================
# Check GitHub CLI
# =============================================================================
Write-Check "GitHub CLI installation"
try {
    $ghVersion = gh --version 2>&1 | Select-String "gh version"
    Write-Pass "GitHub CLI installed: $ghVersion"
} catch {
    Write-Fail "GitHub CLI not installed"
    Write-Host "     Install from: https://cli.github.com" -ForegroundColor $WarningColor
    $issuesFound++
}

# =============================================================================
# Check GitHub Authentication
# =============================================================================
Write-Check "GitHub authentication"
$ghAuth = gh auth status 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Pass "Authenticated with GitHub"
} else {
    Write-Fail "Not authenticated with GitHub"
    Write-Host "     Run: gh auth login" -ForegroundColor $WarningColor
    $issuesFound++
}

# Get repo info
try {
    $repoInfo = gh repo view --json nameWithOwner 2>&1 | ConvertFrom-Json
    $repoName = $repoInfo.nameWithOwner
    Write-Pass "Repository: $repoName"
} catch {
    Write-Fail "Not in a GitHub repository or not authenticated"
    $issuesFound++
    $repoName = $null
}

# =============================================================================
# Check GitHub Secrets
# =============================================================================
if ($repoName) {
    Write-Check "GitHub Secrets"
    
    $requiredSecrets = @(
        "AZURE_CREDENTIALS",
        "AZURE_CONTAINER_REGISTRY",
        "AZURE_RESOURCE_GROUP",
        "AZURE_RESOURCE_GROUP_STAGING"
    )
    
    $secretsList = gh secret list --json name 2>&1 | ConvertFrom-Json
    $secretNames = $secretsList | ForEach-Object { $_.name }
    
    foreach ($secret in $requiredSecrets) {
        if ($secretNames -contains $secret) {
            Write-Pass "$secret is set"
        } else {
            Write-Fail "$secret is missing"
            $issuesFound++
        }
    }
}

# =============================================================================
# Check GitHub Environments
# =============================================================================
if ($repoName) {
    Write-Check "GitHub Environments"
    
    $requiredEnvs = @("staging", "production")
    
    try {
        $envsList = gh api "repos/$repoName/environments" 2>&1 | ConvertFrom-Json
        $envNames = $envsList.environments | ForEach-Object { $_.name }
        
        foreach ($env in $requiredEnvs) {
            if ($envNames -contains $env) {
                Write-Pass "$env environment exists"
            } else {
                Write-Fail "$env environment missing"
                $issuesFound++
            }
        }
    } catch {
        Write-Warn "Could not check environments (may need repo admin access)"
    }
}

# =============================================================================
# Check Azure Resources (if not skipped)
# =============================================================================
if (-not $SkipAzure) {
    Write-Check "Azure CLI installation"
    try {
        $azVersion = az --version 2>&1 | Select-String "azure-cli"
        Write-Pass "Azure CLI installed: $azVersion"
    } catch {
        Write-Fail "Azure CLI not installed"
        Write-Host "     Install from: https://aka.ms/InstallAzureCli" -ForegroundColor $WarningColor
        $issuesFound++
        $SkipAzure = $true
    }
    
    if (-not $SkipAzure) {
        Write-Check "Azure authentication"
        $currentAccount = az account show 2>&1 | ConvertFrom-Json
        if ($LASTEXITCODE -eq 0) {
            Write-Pass "Logged in as: $($currentAccount.user.name)"
            
            if ($SubscriptionId) {
                az account set --subscription $SubscriptionId 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    Write-Pass "Using subscription: $SubscriptionId"
                } else {
                    Write-Fail "Could not set subscription"
                    $issuesFound++
                }
            } else {
                Write-Pass "Using subscription: $($currentAccount.name)"
            }
        } else {
            Write-Fail "Not logged into Azure"
            Write-Host "     Run: az login" -ForegroundColor $WarningColor
            $issuesFound++
            $SkipAzure = $true
        }
    }
    
    # Check ACR (if we have secrets)
    if (-not $SkipAzure -and $secretNames -contains "AZURE_CONTAINER_REGISTRY") {
        Write-Check "Azure Container Registry"
        
        # Try to get ACR name from secret (won't show value, but we can test if ACR exists)
        try {
            $acrList = az acr list --query "[].name" -o tsv 2>&1
            if ($LASTEXITCODE -eq 0 -and $acrList) {
                Write-Pass "Found ACR(s): $($acrList -join ', ')"
            } else {
                Write-Warn "No ACRs found in current subscription"
            }
        } catch {
            Write-Warn "Could not list ACRs"
        }
    }
    
    # Check Container Apps
    if (-not $SkipAzure) {
        Write-Check "Container Apps"
        
        $containerApps = az containerapp list --query "[].{name:name, rg:resourceGroup}" -o json 2>&1 | ConvertFrom-Json
        if ($LASTEXITCODE -eq 0 -and $containerApps) {
            foreach ($app in $containerApps) {
                Write-Pass "$($app.name) in $($app.rg)"
            }
        } else {
            Write-Warn "No Container Apps found"
            Write-Host "     You'll need to create these for deployment" -ForegroundColor $WarningColor
        }
    }
}

# =============================================================================
# Check Workflow Files
# =============================================================================
Write-Check "Workflow files"

$workflowFiles = @(
    ".github/workflows/backend-deploy.yml",
    ".github/workflows/backend-rollback.yml"
)

foreach ($file in $workflowFiles) {
    if (Test-Path $file) {
        Write-Pass "$file exists"
    } else {
        Write-Fail "$file missing"
        $issuesFound++
    }
}

# =============================================================================
# Check Dockerfile
# =============================================================================
Write-Check "Dockerfile"

if (Test-Path "backend/Dockerfile") {
    Write-Pass "backend/Dockerfile exists"
    
    # Check for best practices
    $dockerfileContent = Get-Content "backend/Dockerfile" -Raw
    
    if ($dockerfileContent -match "FROM.*alpine") {
        Write-Pass "Using Alpine base image (good)"
    }
    
    if ($dockerfileContent -match "USER.*nodejs") {
        Write-Pass "Running as non-root user (good)"
    }
    
    if ($dockerfileContent -match "HEALTHCHECK") {
        Write-Pass "Health check configured (good)"
    }
} else {
    Write-Fail "backend/Dockerfile missing"
    $issuesFound++
}

# =============================================================================
# Summary
# =============================================================================
Write-Host "`n=============================================" -ForegroundColor $InfoColor
if ($issuesFound -eq 0) {
    Write-Host "✅ All checks passed!" -ForegroundColor $SuccessColor
    Write-Host "=============================================" -ForegroundColor $SuccessColor
    Write-Host ""
    Write-Host "Your CI/CD pipeline is properly configured!" -ForegroundColor $SuccessColor
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor $InfoColor
    Write-Host "  1. Push to develop branch to test staging deployment"
    Write-Host "  2. Create PR to main for production deployment"
    Write-Host "  3. Monitor deployments in GitHub Actions tab"
    Write-Host ""
} else {
    Write-Host "❌ Found $issuesFound issue(s)" -ForegroundColor $ErrorColor
    Write-Host "=============================================" -ForegroundColor $ErrorColor
    Write-Host ""
    Write-Host "Fix the issues above, then run this script again." -ForegroundColor $WarningColor
    Write-Host ""
    Write-Host "For help:" -ForegroundColor $InfoColor
    Write-Host "  - See: docs/QUICK_FIX_CICD.md"
    Write-Host "  - See: .github/workflows/README.md"
    Write-Host "  - Run: scripts/setup-ci-cd.ps1 for automated setup"
    Write-Host ""
}
Write-Host "=============================================" -ForegroundColor $InfoColor

exit $issuesFound
