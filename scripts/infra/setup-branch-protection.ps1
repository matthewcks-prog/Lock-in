#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Sets up branch protection rules for the Lock-in repository following industry best practices.

.DESCRIPTION
    This script configures GitHub branch protection rules for both main and develop branches:
    
    MAIN (Production):
    - All changes go through pull requests with 1 approval
    - CI checks must pass before merging
    - Force pushes prevented
    - Linear history required
    
    DEVELOP (Staging):
    - All changes go through pull requests (0 required approvals for speed)
    - CI checks must pass before merging
    - Force pushes prevented
    - Linear history required

.NOTES
    Requires: GitHub CLI (gh) authenticated with repo admin access
    Usage: 
        ./scripts/setup-branch-protection.ps1              # Set up both branches
        ./scripts/setup-branch-protection.ps1 -Branch main # Set up main only
        ./scripts/setup-branch-protection.ps1 -DryRun      # Preview changes
#>

param(
    [string]$Owner = "matthewcks-prog",
    [string]$Repo = "Lock-in",
    [ValidateSet("main", "develop", "both")]
    [string]$Branch = "both",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "`n🔒 Lock-in Branch Protection Setup" -ForegroundColor Cyan
Write-Host "=" * 50

# Check if gh CLI is installed and authenticated
Write-Host "`n📋 Checking prerequisites..." -ForegroundColor Yellow

try {
    $null = gh auth status 2>&1
    Write-Host "✅ GitHub CLI authenticated" -ForegroundColor Green
} catch {
    Write-Host "❌ GitHub CLI not authenticated. Run 'gh auth login' first." -ForegroundColor Red
    exit 1
}

# Check repo access
try {
    $repoInfo = gh api "repos/$Owner/$Repo" 2>&1 | ConvertFrom-Json
    if ($repoInfo.permissions.admin -ne $true) {
        Write-Host "⚠️  Warning: You may not have admin access to this repository." -ForegroundColor Yellow
        Write-Host "   Branch protection requires admin permissions." -ForegroundColor Yellow
    } else {
        Write-Host "✅ Admin access confirmed" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Cannot access repository $Owner/$Repo" -ForegroundColor Red
    exit 1
}

# Define protection rules for MAIN (Production) - requires approval
$mainProtectionRules = @{
    required_pull_request_reviews = @{
        dismiss_stale_reviews = $true
        require_code_owner_reviews = $false
        required_approving_review_count = 1              # Require 1 approval for production
        require_last_push_approval = $true
    }
    required_status_checks = @{
        strict = $true
        contexts = @(
            "refactor-gate"
            "test (20.x)"
            "test (22.x)"
        )
    }
    enforce_admins = $true
    required_signatures = $false
    required_linear_history = $true
    allow_force_pushes = $false
    allow_deletions = $false
    block_creations = $false
    required_conversation_resolution = $true
    lock_branch = $false
    allow_fork_syncing = $true
}

# Define protection rules for DEVELOP (Staging) - no approval required for speed
$developProtectionRules = @{
    required_pull_request_reviews = @{
        dismiss_stale_reviews = $true
        require_code_owner_reviews = $false
        required_approving_review_count = 0              # No approval needed for staging
        require_last_push_approval = $false
    }
    required_status_checks = @{
        strict = $true
        contexts = @(
            "refactor-gate"
            "test (20.x)"
            "test (22.x)"
        )
    }
    enforce_admins = $false                              # Admins can bypass for hotfixes
    required_signatures = $false
    required_linear_history = $true
    allow_force_pushes = $false
    allow_deletions = $false
    block_creations = $false
    required_conversation_resolution = $false            # Faster iteration on develop
    lock_branch = $false
    allow_fork_syncing = $true
}

function Apply-BranchProtection {
    param(
        [string]$BranchName,
        [hashtable]$Rules,
        [string]$Description
    )
    
    Write-Host "`n🛡️  Protection rules for '$BranchName' ($Description):" -ForegroundColor Yellow
    Write-Host "   • Required approvals: $($Rules.required_pull_request_reviews.required_approving_review_count)" -ForegroundColor White
    Write-Host "   • Require status checks: YES" -ForegroundColor White
    Write-Host "   • Require branch up to date: YES" -ForegroundColor White
    Write-Host "   • Enforce for admins: $($Rules.enforce_admins)" -ForegroundColor White
    Write-Host "   • Allow force pushes: NO" -ForegroundColor White
    
    if ($DryRun) {
        Write-Host "   ⚠️  DRY RUN - Skipping..." -ForegroundColor Yellow
        return
    }
    
    $jsonBody = $Rules | ConvertTo-Json -Depth 10 -Compress
    $jsonFile = [System.IO.Path]::GetTempFileName()
    $jsonBody | Out-File -FilePath $jsonFile -Encoding utf8
    
    try {
        gh api `
            --method PUT `
            "repos/$Owner/$Repo/branches/$BranchName/protection" `
            --input $jsonFile 2>&1 | Out-Null
        
        Write-Host "   ✅ Protection applied!" -ForegroundColor Green
    } catch {
        Write-Host "   ❌ Failed to apply protection: $_" -ForegroundColor Red
    } finally {
        Remove-Item $jsonFile -ErrorAction SilentlyContinue
    }
}

# Apply protection based on selection
if ($Branch -eq "both" -or $Branch -eq "main") {
    Apply-BranchProtection -BranchName "main" -Rules $mainProtectionRules -Description "Production"
}

if ($Branch -eq "both" -or $Branch -eq "develop") {
    # First, ensure develop branch exists
    Write-Host "`n📋 Checking develop branch..." -ForegroundColor Yellow
    try {
        gh api "repos/$Owner/$Repo/branches/develop" 2>&1 | Out-Null
        Write-Host "   ✅ develop branch exists" -ForegroundColor Green
    } catch {
        Write-Host "   ⚠️  develop branch doesn't exist yet" -ForegroundColor Yellow
        Write-Host "   Create it with: git checkout -b develop && git push -u origin develop" -ForegroundColor Yellow
        if (-not $DryRun) {
            Write-Host "   Skipping develop branch protection..." -ForegroundColor Yellow
        }
    }
    
    Apply-BranchProtection -BranchName "develop" -Rules $developProtectionRules -Description "Staging"
}

if ($DryRun) {
    Write-Host "`n⚠️  DRY RUN completed - No changes were made" -ForegroundColor Yellow
    Write-Host "   Remove -DryRun flag to apply changes" -ForegroundColor Yellow
}

Write-Host "`n✨ Done! Branch protection setup complete." -ForegroundColor Cyan
Write-Host "`n📝 Workflow:" -ForegroundColor Yellow
Write-Host "   1. Create feature branch from develop: git checkout develop && git checkout -b feature/xyz" -ForegroundColor White
Write-Host "   2. Push and create PR to develop: gh pr create --base develop" -ForegroundColor White
Write-Host "   3. After merge, changes auto-deploy to staging (lock-in-dev)" -ForegroundColor White
Write-Host "   4. When ready, create PR: develop → main for production deploy" -ForegroundColor White
Write-Host "`n📖 See ENVIRONMENTS.md for full workflow documentation" -ForegroundColor White
