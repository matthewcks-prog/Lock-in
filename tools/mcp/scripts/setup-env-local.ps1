#Requires -Version 5.1
<#
.SYNOPSIS
    Sets up the .env.local file for Lock-in MCP servers with dynamic path detection.

.DESCRIPTION
    This script:
    1. Detects the repository root dynamically
    2. Prompts for Supabase connection string
    3. Generates .env.local with proper path escaping for Windows
    4. Validates the generated configuration

.EXAMPLE
    .\setup-env-local.ps1
    
    Runs the setup interactively.

.EXAMPLE
    .\setup-env-local.ps1 -ConnectionString "postgresql://..."
    
    Uses provided connection string without prompting.

.EXAMPLE
    .\setup-env-local.ps1 -Force
    
    Overwrites existing .env.local without confirmation.

.NOTES
    Author: Lock-in Project
    Part of MCP Cross-IDE setup tools
#>

[CmdletBinding()]
param(
    [Parameter(HelpMessage = "Supabase read-only connection string")]
    [string]$ConnectionString,
    
    [Parameter(HelpMessage = "Overwrite existing .env.local without confirmation")]
    [switch]$Force,
    
    [Parameter(HelpMessage = "Output directory for .env.local (defaults to repo root)")]
    [string]$OutputDir
)

# --- Helper Functions ---

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Type = "Info"
    )
    
    switch ($Type) {
        "Success" { Write-Host "✓ $Message" -ForegroundColor Green }
        "Warning" { Write-Host "⚠ $Message" -ForegroundColor Yellow }
        "Error"   { Write-Host "✗ $Message" -ForegroundColor Red }
        "Info"    { Write-Host "→ $Message" -ForegroundColor Cyan }
        "Header"  { Write-Host "`n$Message" -ForegroundColor Magenta }
        default   { Write-Host $Message }
    }
}

function Find-RepoRoot {
    <#
    .SYNOPSIS
        Finds the Lock-in repository root by looking for key files.
    #>
    
    # Start from script location and work upward
    $searchPath = $PSScriptRoot
    
    # If script is in tools/mcp/scripts, go up 3 levels
    if ($searchPath -like "*tools*mcp*scripts*") {
        $searchPath = (Get-Item $searchPath).Parent.Parent.Parent.FullName
    }
    
    # Validate by checking for key repo files
    $markers = @("package.json", "AGENTS.md", "extension")
    $foundMarkers = 0
    
    foreach ($marker in $markers) {
        if (Test-Path (Join-Path $searchPath $marker)) {
            $foundMarkers++
        }
    }
    
    if ($foundMarkers -ge 2) {
        return $searchPath
    }
    
    # Fallback: search upward from current directory
    $currentDir = Get-Location
    while ($currentDir -and $currentDir.Path.Length -gt 3) {
        $hasPackageJson = Test-Path (Join-Path $currentDir.Path "package.json")
        $hasAgentsMd = Test-Path (Join-Path $currentDir.Path "AGENTS.md")
        
        if ($hasPackageJson -and $hasAgentsMd) {
            return $currentDir.Path
        }
        
        $currentDir = $currentDir.Parent
    }
    
    return $null
}

function Get-EscapedPath {
    <#
    .SYNOPSIS
        Escapes a Windows path for use in .env files (double backslashes).
    #>
    param([string]$Path)
    
    return $Path -replace '\\', '\\'
}

function Get-SupabaseProjectRef {
    <#
    .SYNOPSIS
        Extracts Supabase project reference from extension/config.js if available.
    #>
    param([string]$RepoRoot)
    
    $configPath = Join-Path $RepoRoot "extension\config.js"
    
    if (Test-Path $configPath) {
        $content = Get-Content $configPath -Raw
        
        # Match SUPABASE_URL pattern
        if ($content -match 'https://([a-z0-9]+)\.supabase\.co') {
            return $Matches[1]
        }
    }
    
    return $null
}

function Validate-ConnectionString {
    <#
    .SYNOPSIS
        Validates PostgreSQL connection string format.
    #>
    param([string]$ConnString)
    
    if ([string]::IsNullOrWhiteSpace($ConnString)) {
        return $false
    }
    
    # Basic format check: postgresql://user:pass@host:port/db
    $pattern = '^postgresql://[^:]+:[^@]+@[^:]+:\d+/\w+(\?.*)?$'
    return $ConnString -match $pattern
}

# --- Main Script ---

Write-ColorOutput "Lock-in MCP Environment Setup" "Header"
Write-ColorOutput "=============================="

# Step 1: Find repository root
Write-ColorOutput "Detecting repository root..." "Info"
$repoRoot = Find-RepoRoot

if (-not $repoRoot) {
    Write-ColorOutput "Could not find Lock-in repository root." "Error"
    Write-ColorOutput "Please run this script from within the Lock-in repository." "Error"
    exit 1
}

Write-ColorOutput "Repository root: $repoRoot" "Success"

# Step 2: Determine output location
if (-not $OutputDir) {
    $OutputDir = $repoRoot
}

$envLocalPath = Join-Path $OutputDir ".env.local"

# Step 3: Check for existing .env.local
if ((Test-Path $envLocalPath) -and -not $Force) {
    Write-ColorOutput ".env.local already exists at: $envLocalPath" "Warning"
    $response = Read-Host "Overwrite? (y/N)"
    if ($response -notmatch '^[Yy]') {
        Write-ColorOutput "Aborted. Use -Force to overwrite without confirmation." "Info"
        exit 0
    }
}

# Step 4: Get Supabase project reference
$projectRef = Get-SupabaseProjectRef -RepoRoot $repoRoot
if ($projectRef) {
    Write-ColorOutput "Detected Supabase project: $projectRef" "Success"
} else {
    Write-ColorOutput "Could not auto-detect Supabase project reference." "Warning"
    $projectRef = Read-Host "Enter Supabase project reference (e.g., abcdefgh12345)"
}

# Step 5: Get connection string
if (-not $ConnectionString) {
    Write-ColorOutput "`nSupabase Connection String" "Header"
    Write-Host "Format: postgresql://readonly_user:PASSWORD@db.$projectRef.supabase.co:5432/postgres"
    Write-Host ""
    Write-Host "To create a read-only user, see: tools/mcp/docs/SUPABASE_READONLY_SETUP.md"
    Write-Host ""
    
    $ConnectionString = Read-Host "Enter connection string (or press Enter to skip database setup)"
}

$hasValidConnection = Validate-ConnectionString $ConnectionString
if ($ConnectionString -and -not $hasValidConnection) {
    Write-ColorOutput "Connection string format appears invalid." "Warning"
    Write-ColorOutput "Expected: postgresql://user:pass@host:port/database" "Info"
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -notmatch '^[Yy]') {
        exit 1
    }
}

# Step 6: Build paths
$extensionPath = Join-Path $repoRoot "extension"
$corePath = Join-Path $repoRoot "core"
$apiPath = Join-Path $repoRoot "api"
$docsPath = Join-Path $repoRoot "docs"
$integrationsPath = Join-Path $repoRoot "integrations"

# Step 7: Generate .env.local content
$envContent = @"
# Lock-in MCP Environment Variables
# Generated by setup-env-local.ps1 on $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
# This file is gitignored and should never be committed

# =============================================================================
# REPOSITORY PATHS (auto-detected)
# =============================================================================

# Repository root (double backslashes for Windows compatibility)
LOCKIN_REPO_ROOT=$(Get-EscapedPath $repoRoot)

# Key directories
LOCKIN_EXTENSION_PATH=$(Get-EscapedPath $extensionPath)
LOCKIN_CORE_PATH=$(Get-EscapedPath $corePath)
LOCKIN_API_PATH=$(Get-EscapedPath $apiPath)
LOCKIN_DOCS_PATH=$(Get-EscapedPath $docsPath)
LOCKIN_INTEGRATIONS_PATH=$(Get-EscapedPath $integrationsPath)

# =============================================================================
# SUPABASE CONFIGURATION
# =============================================================================

# Project reference (extracted from extension/config.js)
LOCKIN_SUPABASE_PROJECT_REF=$projectRef

# Supabase URL
LOCKIN_SUPABASE_URL=https://$projectRef.supabase.co

# Read-only connection string for MCP database server
# Create a read-only user first - see tools/mcp/docs/SUPABASE_READONLY_SETUP.md
$(if ($hasValidConnection) { "SUPABASE_READONLY_CONNECTION_STRING=$ConnectionString" } else { "# SUPABASE_READONLY_CONNECTION_STRING=postgresql://readonly_user:PASSWORD@db.$projectRef.supabase.co:5432/postgres" })

# =============================================================================
# DATABASE SERVER SETTINGS
# =============================================================================

LOCKIN_DB_MAX_ROWS=1000
LOCKIN_DB_TIMEOUT_MS=5000
LOCKIN_DB_READONLY=true

# =============================================================================
# BUILD SERVER SETTINGS
# =============================================================================

LOCKIN_BUILD_TIMEOUT_MS=300000
LOCKIN_BUILD_MAX_OUTPUT_BYTES=1048576

# =============================================================================
# BACKEND (for local development)
# =============================================================================

BACKEND_URL=http://localhost:3000

# =============================================================================
# EXTENSION PATH (for Playwright MCP server)
# =============================================================================

# Windows path (used by Playwright for extension testing)
EXTENSION_PATH=$(Get-EscapedPath $extensionPath)

"@

# Step 8: Write .env.local
try {
    $envContent | Out-File -FilePath $envLocalPath -Encoding UTF8 -NoNewline
    Write-ColorOutput ".env.local created at: $envLocalPath" "Success"
} catch {
    Write-ColorOutput "Failed to write .env.local: $_" "Error"
    exit 1
}

# Step 9: Validate generated file
Write-ColorOutput "`nValidating generated configuration..." "Info"

$validationErrors = @()

if (-not (Test-Path $extensionPath)) {
    $validationErrors += "Extension path not found: $extensionPath"
}

if (-not (Test-Path $corePath)) {
    $validationErrors += "Core path not found: $corePath"
}

if (-not $hasValidConnection) {
    $validationErrors += "Database connection string not configured (optional)"
}

if ($validationErrors.Count -gt 0) {
    Write-ColorOutput "`nWarnings:" "Warning"
    foreach ($error in $validationErrors) {
        Write-ColorOutput "  - $error" "Warning"
    }
} else {
    Write-ColorOutput "All paths validated successfully!" "Success"
}

# Step 10: Summary
Write-ColorOutput "`nSetup Complete!" "Header"
Write-ColorOutput "==============="
Write-Host ""
Write-Host "Generated: $envLocalPath"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Review the generated .env.local file"
if (-not $hasValidConnection) {
    Write-Host "  2. Add your Supabase read-only connection string"
    Write-Host "     See: tools/mcp/docs/SUPABASE_READONLY_SETUP.md"
}
Write-Host "  3. Run: .\tools\mcp\scripts\validate-mcp-setup.ps1"
Write-Host ""
