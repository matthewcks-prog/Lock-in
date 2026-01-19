#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Sets up branch protection rules for the Lock-in repository following industry best practices.

.DESCRIPTION
    This script configures GitHub branch protection rules to ensure:
    - All changes go through pull requests
    - CI checks must pass before merging
    - Code review is required
    - Force pushes are prevented

.NOTES
    Requires: GitHub CLI (gh) authenticated with repo admin access
    Usage: ./scripts/setup-branch-protection.ps1
#>

param(
    [string]$Owner = "matthewcks-prog",
    [string]$Repo = "Lock-in",
    [string]$Branch = "main",
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

# Define protection rules following industry best practices
$protectionRules = @{
    # Require pull request reviews before merging
    required_pull_request_reviews = @{
        dismiss_stale_reviews = $true                    # Dismiss approvals when new commits pushed
        require_code_owner_reviews = $false              # Set to true if you have CODEOWNERS file
        required_approving_review_count = 1              # At least 1 approval required
        require_last_push_approval = $true               # Last pusher can't self-approve
    }
    
    # Require status checks to pass before merging
    required_status_checks = @{
        strict = $true                                   # Branch must be up to date before merging
        contexts = @(
            "refactor-gate"                              # Your main CI workflow
            "test (20.x)"                                # Tests on Node 20
            "test (22.x)"                                # Tests on Node 22
        )
    }
    
    # Enforce rules for administrators too
    enforce_admins = $true
    
    # Require signed commits (optional but recommended)
    required_signatures = $false                         # Set to true if team uses GPG signing
    
    # Require linear history (prevents merge commits)
    required_linear_history = $true                      # Encourages rebase workflow
    
    # Allow force pushes - NEVER for main
    allow_force_pushes = $false
    
    # Allow deletions - NEVER for main
    allow_deletions = $false
    
    # Block creation of matching branches
    block_creations = $false
    
    # Require conversation resolution before merging
    required_conversation_resolution = $true
    
    # Lock branch (for archive branches only)
    lock_branch = $false
    
    # Allow fork syncing
    allow_fork_syncing = $true
}

Write-Host "`n🛡️  Protection rules to apply:" -ForegroundColor Yellow
Write-Host "   • Require pull request reviews: YES (1 approval)" -ForegroundColor White
Write-Host "   • Dismiss stale reviews on new commits: YES" -ForegroundColor White
Write-Host "   • Require status checks (refactor-gate, tests): YES" -ForegroundColor White
Write-Host "   • Require branch to be up to date: YES" -ForegroundColor White
Write-Host "   • Enforce for administrators: YES" -ForegroundColor White
Write-Host "   • Require linear history (rebase): YES" -ForegroundColor White
Write-Host "   • Allow force pushes: NO" -ForegroundColor White
Write-Host "   • Allow deletions: NO" -ForegroundColor White
Write-Host "   • Require conversation resolution: YES" -ForegroundColor White

if ($DryRun) {
    Write-Host "`n⚠️  DRY RUN - No changes will be made" -ForegroundColor Yellow
    Write-Host "   Remove -DryRun flag to apply changes" -ForegroundColor Yellow
    exit 0
}

Write-Host "`n🚀 Applying branch protection rules..." -ForegroundColor Yellow

# Convert to JSON
$jsonBody = $protectionRules | ConvertTo-Json -Depth 10 -Compress

try {
    # Apply protection rules via GitHub API
    $result = gh api `
        --method PUT `
        "repos/$Owner/$Repo/branches/$Branch/protection" `
        --input - `
        2>&1 <<< $jsonBody
    
    Write-Host "✅ Branch protection applied successfully!" -ForegroundColor Green
} catch {
    # Try alternative approach with explicit JSON
    Write-Host "   Trying alternative API approach..." -ForegroundColor Yellow
    
    $jsonFile = [System.IO.Path]::GetTempFileName()
    $jsonBody | Out-File -FilePath $jsonFile -Encoding utf8
    
    try {
        gh api `
            --method PUT `
            "repos/$Owner/$Repo/branches/$Branch/protection" `
            --input $jsonFile
        
        Write-Host "✅ Branch protection applied successfully!" -ForegroundColor Green
    } finally {
        Remove-Item $jsonFile -ErrorAction SilentlyContinue
    }
}

Write-Host "`n📋 Verification:" -ForegroundColor Yellow
try {
    $protection = gh api "repos/$Owner/$Repo/branches/$Branch/protection" 2>&1 | ConvertFrom-Json
    Write-Host "✅ Branch protection is now active on '$Branch'" -ForegroundColor Green
    Write-Host "   Required status checks: $($protection.required_status_checks.contexts -join ', ')" -ForegroundColor White
    Write-Host "   Required approvals: $($protection.required_pull_request_reviews.required_approving_review_count)" -ForegroundColor White
} catch {
    Write-Host "⚠️  Could not verify protection rules. Check GitHub settings manually." -ForegroundColor Yellow
}

Write-Host "`n✨ Done! Your main branch is now protected." -ForegroundColor Cyan
Write-Host "`n📝 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Create feature branches for new work: git checkout -b feature/my-feature" -ForegroundColor White
Write-Host "   2. Push and create PRs: gh pr create" -ForegroundColor White
Write-Host "   3. Wait for CI checks to pass before merging" -ForegroundColor White
Write-Host "   4. Consider adding CODEOWNERS file for automatic reviewers" -ForegroundColor White
