# =============================================================================
# Lock-in Infrastructure Validation Script
# Validates deployed infrastructure health and configuration
#
# Usage:
#   .\infrastructure\validate.ps1 -Environment staging
# =============================================================================

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("staging", "production")]
    [string]$Environment = "staging",

    [Parameter(Mandatory=$false)]
    [string]$SubscriptionId = "473adbd3-1a70-4074-aa01-5451673d058b"
)

$ErrorActionPreference = "Stop"

# =============================================================================
# Configuration
# =============================================================================
$ResourceGroupMap = @{
    "staging" = "lock-in-dev"
    "production" = "lock-in-prod"
}

$ContainerAppMap = @{
    "staging" = "lock-in-dev"
    "production" = "lock-in-backend"
}

$ResourceGroup = $ResourceGroupMap[$Environment]
$ContainerAppName = $ContainerAppMap[$Environment]

# =============================================================================
# Validation Functions
# =============================================================================
function Test-ContainerAppHealth {
    Write-Host "🏥 Checking Container App health..." -ForegroundColor Cyan

    try {
        $app = az containerapp show `
            --name $ContainerAppName `
            --resource-group $ResourceGroup | ConvertFrom-Json

        $fqdn = $app.properties.configuration.ingress.fqdn
        $healthUrl = "https://$fqdn/health"

        Write-Host "  App FQDN: $fqdn" -ForegroundColor Gray
        Write-Host "  Health URL: $healthUrl" -ForegroundColor Gray

        $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 10

        if ($response.StatusCode -eq 200) {
            $health = $response.Content | ConvertFrom-Json
            Write-Host "  ✓ Health check passed" -ForegroundColor Green
            Write-Host "    Status: $($health.status)" -ForegroundColor Gray
            return $true
        }
    } catch {
        Write-Host "  ✗ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }

    Write-Host ""
}

function Test-ContainerAppConfiguration {
    Write-Host "⚙️  Validating Container App configuration..." -ForegroundColor Cyan

    try {
        $app = az containerapp show `
            --name $ContainerAppName `
            --resource-group $ResourceGroup | ConvertFrom-Json

        $issues = @()

        # Check ingress
        if (-not $app.properties.configuration.ingress) {
            $issues += "Ingress not configured"
        } elseif (-not $app.properties.configuration.ingress.external) {
            $issues += "Ingress not external"
        }

        # Check health probes
        $container = $app.properties.template.containers[0]
        if (-not $container.probes) {
            $issues += "No health probes configured"
        } else {
            $probeTypes = $container.probes | ForEach-Object { $_.type }
            if (-not ($probeTypes -contains "Liveness")) {
                $issues += "Missing liveness probe"
            }
            if (-not ($probeTypes -contains "Readiness")) {
                $issues += "Missing readiness probe"
            }
        }

        # Check scaling
        if (-not $app.properties.template.scale.rules) {
            $issues += "No scaling rules configured"
        }

        # Check secrets
        if (-not $app.properties.configuration.secrets) {
            $issues += "No secrets configured"
        }

        if ($issues.Count -eq 0) {
            Write-Host "  ✓ Configuration valid" -ForegroundColor Green
            return $true
        } else {
            Write-Host "  ✗ Configuration issues found:" -ForegroundColor Red
            foreach ($issue in $issues) {
                Write-Host "    - $issue" -ForegroundColor Yellow
            }
            return $false
        }
    } catch {
        Write-Host "  ✗ Failed to retrieve configuration: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }

    Write-Host ""
}

function Test-ContainerAppLogs {
    Write-Host "📋 Checking recent logs..." -ForegroundColor Cyan

    try {
        Write-Host "  Fetching last 10 log entries..." -ForegroundColor Gray

        $logs = az containerapp logs show `
            --name $ContainerAppName `
            --resource-group $ResourceGroup `
            --tail 10 `
            --output table

        if ($logs) {
            Write-Host "  ✓ Logs accessible" -ForegroundColor Green
            Write-Host ""
            Write-Host "  Recent logs:" -ForegroundColor Gray
            Write-Host $logs -ForegroundColor Gray
        }
    } catch {
        Write-Host "  ⚠️  Could not fetch logs: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    Write-Host ""
}

function Test-ContainerAppReplicas {
    Write-Host "📊 Checking replica status..." -ForegroundColor Cyan

    try {
        $replicas = az containerapp replica list `
            --name $ContainerAppName `
            --resource-group $ResourceGroup | ConvertFrom-Json

        $runningReplicas = ($replicas | Where-Object { $_.properties.runningState -eq "Running" }).Count
        $totalReplicas = $replicas.Count

        Write-Host "  Running replicas: $runningReplicas/$totalReplicas" -ForegroundColor Gray

        if ($runningReplicas -gt 0) {
            Write-Host "  ✓ At least one replica running" -ForegroundColor Green

            foreach ($replica in $replicas) {
                $state = $replica.properties.runningState
                $color = if ($state -eq "Running") { "Green" } else { "Yellow" }
                Write-Host "    - $($replica.name): $state" -ForegroundColor $color
            }
        } else {
            Write-Host "  ✗ No replicas running" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ⚠️  Could not check replicas: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    Write-Host ""
}

function Test-KeyVaultAccess {
    Write-Host "🔐 Validating Key Vault access..." -ForegroundColor Cyan

    try {
        $keyVaultName = "lock-in-kv"

        # Check if Key Vault exists
        $kv = az keyvault show --name $keyVaultName | ConvertFrom-Json

        if ($kv) {
            Write-Host "  ✓ Key Vault accessible: $keyVaultName" -ForegroundColor Green

            # Check if managed identity has access
            $app = az containerapp show `
                --name $ContainerAppName `
                --resource-group $ResourceGroup | ConvertFrom-Json

            if ($app.identity.userAssignedIdentities) {
                Write-Host "  ✓ User-assigned identity configured" -ForegroundColor Green
            } else {
                Write-Host "  ✗ No user-assigned identity" -ForegroundColor Red
            }
        }
    } catch {
        Write-Host "  ⚠️  Could not validate Key Vault access: $($_.Exception.Message)" -ForegroundColor Yellow
    }

    Write-Host ""
}

# =============================================================================
# Execution
# =============================================================================
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host " Lock-in Infrastructure Validation" -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Environment: $Environment" -ForegroundColor Yellow
Write-Host "  Resource Group: $ResourceGroup" -ForegroundColor Yellow
Write-Host "  Container App: $ContainerAppName" -ForegroundColor Yellow
Write-Host ""

# Set subscription
az account set --subscription $SubscriptionId

# Run validations
$results = @{
    "Health" = Test-ContainerAppHealth
    "Configuration" = Test-ContainerAppConfiguration
    "Replicas" = Test-ContainerAppReplicas
    "KeyVaultAccess" = Test-KeyVaultAccess
}

Test-ContainerAppLogs

# Summary
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host " Validation Summary" -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""

$passed = 0
$failed = 0

foreach ($check in $results.GetEnumerator()) {
    $icon = if ($check.Value) { "✓" } else { "✗" }
    $color = if ($check.Value) { "Green" } else { "Red" }
    Write-Host "  $icon $($check.Key)" -ForegroundColor $color

    if ($check.Value) { $passed++ } else { $failed++ }
}

Write-Host ""
Write-Host "  Passed: $passed" -ForegroundColor Green
Write-Host "  Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($failed -gt 0) {
    Write-Host "⚠️  Some validations failed. Review the output above." -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "✅ All validations passed!" -ForegroundColor Green
    exit 0
}
