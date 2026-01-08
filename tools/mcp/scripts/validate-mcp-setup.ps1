# Lock-in MCP Setup Validator
# Validates MCP configuration for CI integration
# Exit codes: 0 = success, 1 = validation failed, 2 = missing files

param(
    [switch]$Verbose,
    [switch]$CI
)

$ErrorActionPreference = "Continue"
$RepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$McpRoot = Join-Path $RepoRoot "tools\mcp"
$ConfigDir = Join-Path $McpRoot "config"
$EnvPath = Join-Path $McpRoot ".env.local"

$validationErrors = 0
$validationWarnings = 0

# Color output helpers (silent in CI mode)
function Write-Success { 
    param($msg) 
    if (-not $CI) { Write-Host "✓ $msg" -ForegroundColor Green }
}
function Write-Error { 
    param($msg) 
    Write-Host "✗ $msg" -ForegroundColor Red
    $script:validationErrors++
}
function Write-Info { 
    param($msg) 
    if (-not $CI) { Write-Host "ℹ $msg" -ForegroundColor Cyan }
}
function Write-Warn { 
    param($msg) 
    Write-Host "⚠ $msg" -ForegroundColor Yellow
    $script:validationWarnings++
}

if (-not $CI) {
    Write-Host "`n================================" -ForegroundColor Cyan
    Write-Host "   MCP Setup Validator" -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host ""
}

# ============================================================================
# Phase 1: Environment File Validation
# ============================================================================

Write-Info "Phase 1: Validating .env.local..."

if (-not (Test-Path $EnvPath)) {
    Write-Error ".env.local not found at: $EnvPath"
    Write-Host "  Run setup-env-local.ps1 first" -ForegroundColor Yellow
} else {
    Write-Success ".env.local exists"
    
    $envContent = Get-Content $EnvPath -Raw
    
    # Check for placeholders
    $placeholders = @(
        "your_password",
        "your_user",
        "YOUR_",
        "PLACEHOLDER"
    )
    
    foreach ($placeholder in $placeholders) {
        if ($envContent -match $placeholder) {
            Write-Warn ".env.local contains placeholder: $placeholder"
        }
    }
    
    # Validate connection string format
    if ($envContent -match 'LOCKIN_DB_CONNECTION_STRING=(.+)') {
        $connString = $matches[1].Trim()
        if ($connString -match '^postgresql://[^:]+:[^@]+@[^:]+:\d+/\w+$') {
            Write-Success "Connection string format is valid"
        } else {
            Write-Warn "Connection string format may be invalid"
        }
    } else {
        Write-Error "LOCKIN_DB_CONNECTION_STRING not found in .env.local"
    }
    
    # Check required environment variables
    $requiredVars = @(
        "LOCKIN_DB_CONNECTION_STRING",
        "LOCKIN_REPO_ROOT",
        "LOCKIN_EXTENSION_PATH",
        "LOCKIN_CORE_PATH",
        "LOCKIN_API_PATH",
        "LOCKIN_DOCS_PATH"
    )
    
    foreach ($var in $requiredVars) {
        if ($envContent -match "$var=(.+)") {
            if ($Verbose) { Write-Success "Found: $var" }
        } else {
            Write-Error "Missing required variable: $var"
        }
    }
}

# ============================================================================
# Phase 2: Server Config Files Validation
# ============================================================================

Write-Info "`nPhase 2: Validating server config files..."

$requiredConfigs = @(
    "db-server-config.json",
    "files-server-config.json",
    "build-server-config.json",
    "docs-server-config.json"
)

foreach ($configFile in $requiredConfigs) {
    $configPath = Join-Path $ConfigDir $configFile
    if (-not (Test-Path $configPath)) {
        Write-Error "Config file not found: $configFile"
        Write-Host "  Run setup-mcp-configs.ps1 to generate" -ForegroundColor Yellow
    } else {
        Write-Success "Found: $configFile"
        
        # Validate JSON format
        try {
            $config = Get-Content $configPath -Raw | ConvertFrom-Json
            if ($Verbose) { Write-Success "  Valid JSON structure" }
            
            # Validate required fields
            if (-not $config.server) {
                Write-Error "  Missing 'server' field in $configFile"
            }
            if (-not $config.version) {
                Write-Error "  Missing 'version' field in $configFile"
            }
            if (-not $config.security) {
                Write-Error "  Missing 'security' field in $configFile"
            }
        } catch {
            Write-Error "Invalid JSON in $configFile : $_"
        }
    }
}

# ============================================================================
# Phase 3: Path Accessibility Validation
# ============================================================================

Write-Info "`nPhase 3: Validating repository paths..."

if (Test-Path $EnvPath) {
    $envContent = Get-Content $EnvPath -Raw
    
    $pathVars = @(
        @{ Name = "LOCKIN_REPO_ROOT"; Pattern = "LOCKIN_REPO_ROOT=(.+)" },
        @{ Name = "LOCKIN_EXTENSION_PATH"; Pattern = "LOCKIN_EXTENSION_PATH=(.+)" },
        @{ Name = "LOCKIN_CORE_PATH"; Pattern = "LOCKIN_CORE_PATH=(.+)" },
        @{ Name = "LOCKIN_API_PATH"; Pattern = "LOCKIN_API_PATH=(.+)" },
        @{ Name = "LOCKIN_DOCS_PATH"; Pattern = "LOCKIN_DOCS_PATH=(.+)" }
    )
    
    foreach ($pathVar in $pathVars) {
        if ($envContent -match $pathVar.Pattern) {
            $path = $matches[1].Trim().Replace('\\\\', '\')
            if (Test-Path $path) {
                if ($Verbose) { Write-Success "$($pathVar.Name) is accessible" }
            } else {
                Write-Error "$($pathVar.Name) path not accessible: $path"
            }
        }
    }
}

# ============================================================================
# Phase 4: Documentation Validation
# ============================================================================

Write-Info "`nPhase 4: Validating documentation..."

$requiredDocs = @(
    "tools\mcp\docs\README.md",
    "tools\mcp\docs\USAGE_GUIDELINES.md",
    "tools\mcp\docs\SUPABASE_READONLY_SETUP.md",
    "tools\mcp\docs\TROUBLESHOOTING.md"
)

foreach ($docPath in $requiredDocs) {
    $fullPath = Join-Path $RepoRoot $docPath
    if (Test-Path $fullPath) {
        if ($Verbose) { Write-Success "Found: $docPath" }
    } else {
        Write-Warn "Documentation missing: $docPath"
    }
}

# ============================================================================
# Validation Summary
# ============================================================================

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "   Validation Summary" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

if ($validationErrors -eq 0 -and $validationWarnings -eq 0) {
    Write-Success "All validations passed!"
    exit 0
} elseif ($validationErrors -eq 0) {
    Write-Warn "Validation passed with $validationWarnings warning(s)"
    exit 0
} else {
    Write-Error "Validation failed with $validationErrors error(s) and $validationWarnings warning(s)"
    Write-Host ""
    Write-Host "To fix errors:" -ForegroundColor Yellow
    Write-Host "1. Run setup-env-local.ps1 to create .env.local" -ForegroundColor White
    Write-Host "2. Run setup-mcp-configs.ps1 to generate server configs" -ForegroundColor White
    Write-Host "3. Review tools\mcp\docs\README.md for setup instructions" -ForegroundColor White
    Write-Host ""
    exit 1
}
