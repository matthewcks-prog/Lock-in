<#
.SYNOPSIS
    Azure Container Registry Usage and Cost Monitoring Script

.DESCRIPTION
    Analyzes ACR usage and generates cost estimates. Provides detailed reports
    on image counts, storage usage, and identifies cleanup candidates.

.PARAMETER RegistryName
    Name of the Azure Container Registry (without .azurecr.io)

.PARAMETER Repository
    Repository name to analyze (default: lock-in-backend, use '*' for all)

.PARAMETER ExportCsv
    Export detailed report to CSV file

.PARAMETER CsvPath
    Path for CSV export (default: acr-usage-report.csv)

.EXAMPLE
    .\monitor-acr-usage.ps1 -RegistryName "myacr"

.EXAMPLE
    .\monitor-acr-usage.ps1 -RegistryName "myacr" -Repository "*" -ExportCsv $true
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$RegistryName = $env:AZURE_CONTAINER_REGISTRY,

    [Parameter(Mandatory=$false)]
    [string]$Repository = "lock-in-backend",

    [Parameter(Mandatory=$false)]
    [bool]$ExportCsv = $false,

    [Parameter(Mandatory=$false)]
    [string]$CsvPath = "acr-usage-report.csv"
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

Write-Header "Azure Container Registry Usage Monitor"

Write-Info "Configuration:"
Write-Host "  Registry: $RegistryName"
Write-Host "  Repository: $Repository"
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

# Get all repositories
Write-Info "Fetching repositories..."
try {
    $reposJson = az acr repository list --name $RegistryName --output json 2>$null
    $repos = $reposJson | ConvertFrom-Json

    if ($null -eq $repos -or $repos.Count -eq 0) {
        Write-Warning "No repositories found in registry $RegistryName"
        exit 0
    }

    Write-Success "Found $($repos.Count) repositories"
} catch {
    Write-Error "Failed to fetch repositories: $_"
    exit 1
}

# Filter repositories if specified
if ($Repository -ne "*") {
    $repos = $repos | Where-Object { $_ -eq $Repository }
    if ($repos.Count -eq 0) {
        Write-Error "Repository '$Repository' not found"
        exit 1
    }
}

Write-Header "Repository Analysis"

$totalImages = 0
$totalStorageMB = 0
$allImages = @()

foreach ($repo in $repos) {
    Write-Info "Analyzing repository: $repo"

    # Get all tags
    try {
        $tagsJson = az acr repository show-tags --name $RegistryName --repository $repo --orderby time_desc --output json 2>$null
        $tags = $tagsJson | ConvertFrom-Json

        if ($null -eq $tags -or $tags.Count -eq 0) {
            Write-Warning "  No tags found in $repo"
            continue
        }

        $repoImages = 0
        $repoStorageMB = 0

        foreach ($tag in $tags) {
            try {
                $manifestJson = az acr manifest show --name "${repo}:${tag}" --registry $RegistryName --output json 2>$null
                $manifest = $manifestJson | ConvertFrom-Json

                $createdAt = [DateTime]::Parse($manifest.created)
                $imageSize = [long]$manifest.imageSize
                $sizeMB = [math]::Round($imageSize / 1MB, 2)

                $repoImages++
                $repoStorageMB += $sizeMB

                # Categorize image
                $category = "Other"
                $isCleanupCandidate = $false

                if ($tag -match '^v\d+\.\d+\.\d+') {
                    $category = "Semantic Version"
                } elseif ($tag -like "*-latest") {
                    $category = "Latest Tag"
                } elseif ($tag -like "staging-*") {
                    $category = "Staging"
                    # Cleanup candidate if older than 14 days
                    $isCleanupCandidate = (Get-Date).AddDays(-14) -gt $createdAt
                } elseif ($tag -like "production-*") {
                    $category = "Production"
                    # Cleanup candidate if older than 90 days
                    $isCleanupCandidate = (Get-Date).AddDays(-90) -gt $createdAt
                } else {
                    # Default category, cleanup if older than 14 days
                    $isCleanupCandidate = (Get-Date).AddDays(-14) -gt $createdAt
                }

                $allImages += [PSCustomObject]@{
                    Repository = $repo
                    Tag = $tag
                    Category = $category
                    SizeMB = $sizeMB
                    Created = $createdAt
                    Age = ((Get-Date) - $createdAt).Days
                    CleanupCandidate = $isCleanupCandidate
                }

            } catch {
                Write-Warning "  Could not get manifest info for $tag"
                continue
            }
        }

        Write-Host "  Images: $repoImages"
        Write-Host "  Storage: ${repoStorageMB}MB"

        $totalImages += $repoImages
        $totalStorageMB += $repoStorageMB

    } catch {
        Write-Warning "  Failed to fetch tags: $_"
        continue
    }
}

Write-Header "Summary"

Write-Host "Total Repositories: $($repos.Count)"
Write-Host "Total Images: $totalImages"
Write-Host "Total Storage: $([math]::Round($totalStorageMB, 2))MB ($([math]::Round($totalStorageMB / 1024, 2))GB)"

# Breakdown by category
$categoryCounts = $allImages | Group-Object -Property Category | Select-Object Name, Count, @{Name="StorageMB";Expression={($_.Group | Measure-Object -Property SizeMB -Sum).Sum}}
Write-Host "`nBreakdown by Category:"
foreach ($cat in $categoryCounts) {
    Write-Host "  $($cat.Name): $($cat.Count) images, $([math]::Round($cat.StorageMB, 2))MB"
}

# Cleanup candidates
$cleanupCandidates = $allImages | Where-Object { $_.CleanupCandidate -eq $true }
$cleanupStorageMB = ($cleanupCandidates | Measure-Object -Property SizeMB -Sum).Sum

Write-Header "Cleanup Candidates"
Write-Host "Images eligible for cleanup: $($cleanupCandidates.Count)"
Write-Host "Potential storage savings: $([math]::Round($cleanupStorageMB, 2))MB"

if ($cleanupCandidates.Count -gt 0) {
    Write-Host "`nOldest cleanup candidates:"
    $cleanupCandidates | Sort-Object -Property Created | Select-Object -First 10 | ForEach-Object {
        Write-Host "  $($_.Repository):$($_.Tag) - $($_.Age) days old, $($_.SizeMB)MB"
    }
}

# Cost estimation
Write-Header "Cost Estimation"

$storageGB = $totalStorageMB / 1024
$storageCostPerMonth = $storageGB * 0.10  # $0.10 per GB/month

Write-Host "Storage Costs (estimated):"
Write-Host "  Storage: $([math]::Round($storageGB, 2))GB"
Write-Host "  Storage cost: `$$([math]::Round($storageCostPerMonth, 2))/month"
Write-Host ""
Write-Host "Registry Base Costs (monthly):"
Write-Host "  Basic tier: ~`$5/month + `$$([math]::Round($storageCostPerMonth, 2)) storage = `$$([math]::Round(5 + $storageCostPerMonth, 2))"
Write-Host "  Standard tier: ~`$20/month + `$$([math]::Round($storageCostPerMonth, 2)) storage = `$$([math]::Round(20 + $storageCostPerMonth, 2))"
Write-Host "  Premium tier: ~`$50/month + `$$([math]::Round($storageCostPerMonth, 2)) storage = `$$([math]::Round(50 + $storageCostPerMonth, 2))"

# Potential savings
if ($cleanupStorageMB -gt 0) {
    $savingsGB = $cleanupStorageMB / 1024
    $savingsCost = $savingsGB * 0.10
    Write-Host ""
    Write-Host "Potential Monthly Savings:"
    Write-Host "  After cleanup: $([math]::Round($savingsGB, 2))GB reduction"
    Write-Host "  Cost savings: `$$([math]::Round($savingsCost, 2))/month"
}

# Export to CSV
if ($ExportCsv -and $allImages.Count -gt 0) {
    Write-Info "`nExporting to CSV: $CsvPath"
    $allImages | Export-Csv -Path $CsvPath -NoTypeInformation
    Write-Success "Report exported successfully"
}

Write-Header "Recommendations"

if ($cleanupCandidates.Count -gt 10) {
    Write-Warning "You have $($cleanupCandidates.Count) images eligible for cleanup!"
    Write-Host "  Run: .\scripts\cleanup-acr.ps1 -RegistryName $RegistryName -DryRun `$true"
} elseif ($cleanupCandidates.Count -gt 0) {
    Write-Info "You have $($cleanupCandidates.Count) images that could be cleaned up for optimization"
    Write-Host "  Run: .\scripts\cleanup-acr.ps1 -RegistryName $RegistryName -DryRun `$true"
} else {
    Write-Success "No cleanup candidates found - your registry is well-maintained!"
}

if ($totalImages -gt 100) {
    Write-Warning "Large number of images detected ($totalImages)"
    Write-Host "  Consider more aggressive retention policies or automated cleanup"
}

if ($storageGB -gt 10) {
    Write-Warning "Storage usage is high ($([math]::Round($storageGB, 2))GB)"
    Write-Host "  Review image sizes and consider multi-stage builds"
}

Write-Host ""
Write-Info "For more information, see: .github/workflows/ACR-CLEANUP-GUIDE.md"
