<#
.SYNOPSIS
    Azure Container Registry Manual Cleanup Script (Refactored)

.DESCRIPTION
    Manually clean up old container images from Azure Container Registry.
    Uses 'az acr manifest list-metadata' for efficient, single-query retrieval of image data.
    Supports dry-run mode, OCI multi-arch images, and configurable retention periods.
    Industry-grade error handling and reporting.

.PARAMETER RegistryName
    Name of the Azure Container Registry (without .azurecr.io)

.PARAMETER Repository
    Repository name to clean up (default: lock-in-backend)

.PARAMETER StagingRetentionDays
    Number of days to keep staging images (default: 14)

.PARAMETER ProductionRetentionDays
    Number of days to keep production images (default: 90)

.PARAMETER DryRun
    Preview deletions without executing them (default: true)

.EXAMPLE
    .\cleanup-acr.ps1 -RegistryName "myacr" -DryRun $true
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$RegistryName = $env:AZURE_CONTAINER_REGISTRY,

    [Parameter(Mandatory=$false)]
    [string]$Repository = "lock-in-backend",

    [Parameter(Mandatory=$false)]
    [int]$StagingRetentionDays = 14,

    [Parameter(Mandatory=$false)]
    [int]$ProductionRetentionDays = 90,

    [Parameter(Mandatory=$false)]
    [bool]$DryRun = $true
)

# Set error preference only, strict mode caused environment compatibility issues
$ErrorActionPreference = "Stop"

# Utility functions for formatted output
function Write-Success { param([string]$Message) Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Info { param([string]$Message) Write-Host "[INFO] $Message" -ForegroundColor Cyan }
function Write-Warning { param([string]$Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }
function Write-Header { param([string]$Message) Write-Host "`n========================================" -ForegroundColor Magenta; Write-Host $Message -ForegroundColor Magenta; Write-Host "========================================`n" -ForegroundColor Magenta }

# 1. Validation
if ([string]::IsNullOrEmpty($RegistryName)) {
    Write-Error "Registry name is required. Set AZURE_CONTAINER_REGISTRY env var or use -RegistryName."
    exit 1
}

Write-Header "Azure Container Registry Cleanup (Optimized)"
Write-Info "Configuration:"
Write-Info "  Registry: $RegistryName"
Write-Info "  Repository: $Repository"
Write-Info "  Staging Retention: $StagingRetentionDays days"
Write-Info "  Production Retention: $ProductionRetentionDays days"
Write-Info "  Mode: $(if ($DryRun) { 'DRY RUN (Preview Only)' } else { 'LIVE (Will Delete)' })"

# 2. Login Check
Write-Info "Verifying Azure CLI login..."
try {
    $account = az account show 2>$null | ConvertFrom-Json
    if ($null -eq $account) { throw "Not logged in" }
    Write-Success "Logged in as: $($account.user.name)"
} catch {
    Write-Error "Please run 'az login' to authenticate."
    exit 1
}

# 3. Calculate Cutoff Dates
$now = Get-Date
$stagingCutoff = $now.AddDays(-$StagingRetentionDays)
$productionCutoff = $now.AddDays(-$ProductionRetentionDays)
Write-Info "Cutoffs: Staging < $($stagingCutoff.ToString('yyyy-MM-dd')), Production < $($productionCutoff.ToString('yyyy-MM-dd'))"
Write-Host ""

# 4. Fetch Manifests (Bulk Operation)
Write-Header "Analyzing Images"
Write-Info "Fetching metadata for ALL images (this is efficient)..."

try {
    # Using list-metadata prevents N+1 API calls and handles OCI indices correctly
    # We fetch ALL manifests to ensure we see old ones.
    # Warning: For extremely large repos (10k+ tags), this might take a moment but is still faster than individual calls.
    # We remove 2>$null to see errors if they happen, but usually az handles it.
    $manifestsJson = az acr manifest list-metadata --registry $RegistryName --name $Repository --orderby time_desc --output json

    if (-not $manifestsJson) {
        Write-Warning "No manifests found or repository does not exist."
        exit 0
    }

    $manifests = $manifestsJson | ConvertFrom-Json
    if ($null -eq $manifests) {
        Write-Warning "Manifest list is empty."
        exit 0
    }
    Write-Success "Successfully retrieved $($manifests.Count) manifests."
} catch {
    Write-Error "Failed to fetch manifests. Error: $_"
    exit 1
}

# 5. Process Tags
$toDelete = @()
$stagingStats = @{ Count = 0; SizeMB = 0 }
$prodStats = @{ Count = 0; SizeMB = 0 }

foreach ($manifest in $manifests) {
    # Skip if no tags (dangling images are not target of this specific script logic, though they consume space)
    # Check if tags property exists and is not null/empty
    if ($null -eq $manifest.tags -or $manifest.tags.Count -eq 0) { continue }

    # Use lastUpdateTime as the most reliable indicator of 'age'
    try {
        $lastUpdate = [DateTime]::Parse($manifest.lastUpdateTime)
    } catch {
        Write-Warning "Could not parse date for digest $($manifest.digest), skipping."
        continue
    }

    # Size calculation (handle 0 size for indices by checking if imageSize exists, though metadata usually has it)
    $sizeMB = 0
    if ($manifest | Get-Member -Name "imageSize") {
         $sizeMB = [math]::Round($manifest.imageSize / 1MB, 2)
    }

    foreach ($tag in $manifest.tags) {
        # SKIP Special Tags
        if ($tag -match '^v\d+\.\d+\.\d+' -or $tag -eq "latest" -or $tag -like "*-latest") {
            Write-Success "Preserving: $tag (Semantic Version or Latest)"
            continue
        }

        # Determine Environment Policy
        $isStaging = $true
        $cutoff = $stagingCutoff
        $envType = "staging"

        if ($tag -like "production-*") {
            $isStaging = $false
            $cutoff = $productionCutoff
            $envType = "production"
        }

        # Check Eligibility
        if ($lastUpdate -lt $cutoff) {
            $ageDays = ($now - $lastUpdate).Days
            Write-Warning "Marking for deletion: $tag ($envType, ${ageDays}d old, $sizeMB MB)"

            $toDelete += [PSCustomObject]@{
                Tag = $tag
                Digest = $manifest.digest
                Env = $envType
                SizeMB = $sizeMB
            }

            if ($isStaging) {
                $stagingStats.Count++
                $stagingStats.SizeMB += $sizeMB
            } else {
                $prodStats.Count++
                $prodStats.SizeMB += $sizeMB
            }
        }
    }
}

# 6. Summary and Execution
Write-Header "Cleanup Summary"
Write-Info "Staging to delete:    $($stagingStats.Count) images (~$($stagingStats.SizeMB) MB derived)"
Write-Info "Production to delete: $($prodStats.Count) images (~$($prodStats.SizeMB) MB derived)"
Write-Info "Total items found:    $($toDelete.Count)"

if ($toDelete.Count -eq 0) {
    Write-Success "No images eligible for deletion. Repository is clean!"
    exit 0
}

if (-not $DryRun) {
    Write-Warning "You are about to PERMANENTLY DELETE $($toDelete.Count) tags."
    $confirm = Read-Host "Type 'DELETE' to confirm"
    if ($confirm -ne "DELETE") {
        Write-Info "Operation cancelled."
        exit 0
    }
    Write-Header "Executing Deletions"
} else {
    Write-Header "Preview Deletions (Dry Run)"
}

foreach ($item in $toDelete) {
    $logMsg = "$($item.Tag) ($($item.Env))"

    if ($DryRun) {
        Write-Info "[DRY RUN] Would delete: $logMsg"
    } else {
        try {
            # Deleting the tag. If it's the last tag, ACR usually deletes the manifest too.
            az acr repository delete --name $RegistryName --image "${Repository}:$($item.Tag)" --yes 2>$null | Out-Null
            Write-Success "Deleted: $logMsg"
        } catch {
            Write-Error "Failed to delete $logMsg : $_"
        }
    }
}

Write-Header "Done"
if ($DryRun) {
    Write-Warning "This was a DRY RUN. No changes were made."
    Write-Info "Run with -DryRun `$false to execute cleanup."
} else {
    Write-Success "Cleanup operation completed."
}
