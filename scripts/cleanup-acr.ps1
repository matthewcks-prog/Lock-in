<#
.SYNOPSIS
    Azure Container Registry Manual Cleanup Script

.DESCRIPTION
    Manually clean up old container images from Azure Container Registry.
    Supports dry-run mode, configurable retention periods, and detailed reporting.

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

.EXAMPLE
    .\cleanup-acr.ps1 -RegistryName "myacr" -StagingRetentionDays 7 -DryRun $false
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
    [bool]$DryRun = $true,

    [Parameter(Mandatory=$false)]
    [switch]$Verbose
)

# Set strict mode
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Color functions
function Write-Success { param([string]$Message) Write-Host "✅ $Message" -ForegroundColor Green }
function Write-Info { param([string]$Message) Write-Host "ℹ️  $Message" -ForegroundColor Cyan }
function Write-Warning { param([string]$Message) Write-Host "⚠️  $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message) Write-Host "❌ $Message" -ForegroundColor Red }
function Write-Header { param([string]$Message) Write-Host "`n========================================" -ForegroundColor Magenta; Write-Host $Message -ForegroundColor Magenta; Write-Host "========================================`n" -ForegroundColor Magenta }

# Validate parameters
if ([string]::IsNullOrEmpty($RegistryName)) {
    Write-Error "Registry name is required. Set AZURE_CONTAINER_REGISTRY environment variable or use -RegistryName parameter."
    exit 1
}

Write-Header "Azure Container Registry Cleanup"

Write-Info "Configuration:"
Write-Host "  Registry: $RegistryName"
Write-Host "  Repository: $Repository"
Write-Host "  Staging Retention: $StagingRetentionDays days"
Write-Host "  Production Retention: $ProductionRetentionDays days"
Write-Host "  Mode: $(if ($DryRun) { 'DRY RUN (Preview Only)' } else { 'LIVE (Will Delete)' })"
Write-Host ""

# Check if logged in to Azure
Write-Info "Verifying Azure CLI login..."
try {
    $account = az account show 2>$null | ConvertFrom-Json
    if ($null -eq $account) {
        Write-Error "Not logged in to Azure. Run 'az login' first."
        exit 1
    }
    Write-Success "Logged in as: $($account.user.name)"
} catch {
    Write-Error "Azure CLI not found or not logged in. Install Azure CLI and run 'az login'."
    exit 1
}

# Calculate cutoff dates
$stagingCutoff = (Get-Date).AddDays(-$StagingRetentionDays)
$productionCutoff = (Get-Date).AddDays(-$ProductionRetentionDays)

Write-Info "Cutoff Dates:"
Write-Host "  Staging: $($stagingCutoff.ToString('yyyy-MM-dd HH:mm:ss'))"
Write-Host "  Production: $($productionCutoff.ToString('yyyy-MM-dd HH:mm:ss'))"
Write-Host ""

# Get all tags
Write-Info "Fetching tags from repository: $Repository"
try {
    $tagsJson = az acr repository show-tags --name $RegistryName --repository $Repository --orderby time_desc --output json 2>$null
    $tags = $tagsJson | ConvertFrom-Json

    if ($null -eq $tags -or $tags.Count -eq 0) {
        Write-Warning "No tags found in repository $Repository"
        exit 0
    }

    Write-Success "Found $($tags.Count) tags"
} catch {
    Write-Error "Failed to fetch tags: $_"
    exit 1
}

# Initialize counters
$stagingDeleted = 0
$productionDeleted = 0
$stagingSpaceSaved = 0
$productionSpaceSaved = 0
$toDelete = @()

Write-Header "Analyzing Images"

# Process each tag
foreach ($tag in $tags) {
    # Skip semantic version tags
    if ($tag -match '^v\d+\.\d+\.\d+') {
        Write-Success "Preserving semantic version: $tag"
        continue
    }

    # Skip latest tags
    if ($tag -like "*-latest" -or $tag -eq "latest") {
        Write-Success "Preserving latest tag: $tag"
        continue
    }

    # Get manifest details
    try {
        $manifestJson = az acr manifest show --name "${Repository}:${tag}" --registry $RegistryName --output json 2>$null
        $manifest = $manifestJson | ConvertFrom-Json

        $createdAt = [DateTime]::Parse($manifest.created)
        $imageSize = [long]$manifest.imageSize
        $sizeMB = [math]::Round($imageSize / 1MB, 2)

    } catch {
        Write-Warning "Could not get manifest info for $tag, skipping"
        continue
    }

    # Determine environment and cutoff
    $isStaging = $false
    $isProduction = $false
    $cutoff = $stagingCutoff

    if ($tag -like "staging-*") {
        $isStaging = $true
        $cutoff = $stagingCutoff
    } elseif ($tag -like "production-*") {
        $isProduction = $true
        $cutoff = $productionCutoff
    } else {
        # Default to staging (shorter retention)
        $isStaging = $true
        $cutoff = $stagingCutoff
    }

    # Check if older than cutoff
    if ($createdAt -lt $cutoff) {
        $envType = if ($isStaging) { "staging" } else { "production" }
        Write-Warning "Marking for deletion: $tag ($envType, created $($createdAt.ToString('yyyy-MM-dd')), ${sizeMB}MB)"

        $toDelete += [PSCustomObject]@{
            Tag = $tag
            Environment = $envType
            CreatedAt = $createdAt
            SizeMB = $sizeMB
            IsStaging = $isStaging
        }

        if ($isStaging) {
            $stagingDeleted++
            $stagingSpaceSaved += $sizeMB
        } else {
            $productionDeleted++
            $productionSpaceSaved += $sizeMB
        }
    } else {
        Write-Success "Keeping recent image: $tag (created $($createdAt.ToString('yyyy-MM-dd')))"
    }
}

# Show summary and confirm
Write-Header "Cleanup Summary"
Write-Host "Staging images to delete: $stagingDeleted (${stagingSpaceSaved}MB)"
Write-Host "Production images to delete: $productionDeleted (${productionSpaceSaved}MB)"
Write-Host "Total images to delete: $($toDelete.Count)"
Write-Host "Total space to save: $([math]::Round($stagingSpaceSaved + $productionSpaceSaved, 2))MB"
Write-Host ""

if ($toDelete.Count -eq 0) {
    Write-Success "No images to delete!"
    exit 0
}

# Confirm deletion
if (-not $DryRun) {
    Write-Warning "This will PERMANENTLY DELETE $($toDelete.Count) images from ACR!"
    $confirmation = Read-Host "Type 'DELETE' to confirm"

    if ($confirmation -ne "DELETE") {
        Write-Info "Cleanup cancelled by user"
        exit 0
    }
}

# Execute deletions
Write-Header "$(if ($DryRun) { 'Preview' } else { 'Executing' }) Deletions"

foreach ($item in $toDelete) {
    if ($DryRun) {
        Write-Info "[DRY RUN] Would delete: $($item.Tag)"
    } else {
        try {
            az acr repository delete --name $RegistryName --image "${Repository}:$($item.Tag)" --yes 2>$null | Out-Null
            Write-Success "Deleted: $($item.Tag)"
        } catch {
            Write-Error "Failed to delete $($item.Tag): $_"
        }
    }
}

# Final summary
Write-Header "Cleanup Complete"
Write-Success "$(if ($DryRun) { 'Preview completed' } else { 'Cleanup completed successfully' })"
Write-Host ""
Write-Host "Staging images processed: $stagingDeleted"
Write-Host "Production images processed: $productionDeleted"
Write-Host "Total space saved: $([math]::Round($stagingSpaceSaved + $productionSpaceSaved, 2))MB"

if ($DryRun) {
    Write-Host ""
    Write-Warning "This was a dry run. No images were actually deleted."
    Write-Info "Run with -DryRun `$false to execute the cleanup."
}
