$ErrorActionPreference = "Stop"

# Configuration
$SubscriptionId = "473adbd3-1a70-4074-aa01-5451673d058b"
$TenantId = "ef7a487a-77ca-410a-803d-e426b62a587f"
$ResourceGroup = "lock-in-dev"     # Staging Resource Group
$ResourceGroupProd = "lock-in-dev" # Production Resource Group (Default to same, update if different)
$AcrName = "lockinacr"
$IdentityName = "lock-in-identity"
$RuntimeIdentityName = "id-github-actions-lock-in"
$KeyVaultName = "lock-in-kv"
$GithubOrg = "matthewcks-prog"
$GithubRepo = "Lock-in"
$StagingEnvironmentName = "staging"
$ProductionEnvironmentName = "production"

function Get-GithubTokenScopes {
    $statusOutput = gh auth status --hostname github.com 2>&1
    if ($LASTEXITCODE -ne 0) {
        return $null
    }

    $scopeLine = ($statusOutput | Select-String "Token scopes").Line
    if (-not $scopeLine) {
        return @()
    }

    if ($scopeLine -match "Token scopes:\\s*(.+)$") {
        return $Matches[1].Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
    }

    return @()
}

function Test-GithubRepoAdmin {
    param([string]$RepoName)

    $adminValue = gh api "repos/$RepoName" --jq ".permissions.admin" 2>$null
    if ($LASTEXITCODE -ne 0) {
        return $null
    }

    return $adminValue -eq "true"
}

function Ensure-GithubEnvironment {
    param(
        [string]$RepoName,
        [string]$EnvironmentName
    )

    $envApi = "repos/$RepoName/environments/$EnvironmentName"

    $envResponse = gh api $envApi 2>$null | ConvertFrom-Json
    if ($LASTEXITCODE -eq 0 -and $envResponse) {
        Write-Host "   Environment '$EnvironmentName' already exists."
        return $true
    }

    gh api --method PUT $envApi 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   Environment '$EnvironmentName' created."
        return $true
    }

    Write-Host "   Could not create '$EnvironmentName' environment (check GitHub auth/permissions)." -ForegroundColor DarkGray
    return $false
}

Write-Host "🚀 Starting UAMI OIDC Setup..."

# 1. Get Identity Details
Write-Host "`n1. Getting Identity Details..."
$Identity = az identity show --name $IdentityName --resource-group $ResourceGroup | ConvertFrom-Json
$ClientId = $Identity.clientId
$PrincipalId = $Identity.principalId
$IdentityId = $Identity.id

Write-Host "   Client ID: $ClientId"
Write-Host "   Principal ID: $PrincipalId"

# 2. Assign Roles
Write-Host "`n2. Assigning Roles..."
# Contributor on Resource Group
$RgId = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup"
Write-Host "   Assigning Contributor on $ResourceGroup..."
az role assignment create --assignee $PrincipalId --role Contributor --scope $RgId 2>$null | Out-Null

# AcrPush on ACR
$AcrId = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.ContainerRegistry/registries/$AcrName"
Write-Host "   Assigning AcrPush on $AcrName..."
az role assignment create --assignee $PrincipalId --role AcrPush --scope $AcrId 2>$null | Out-Null

# 2b. Assign Runtime Identity Roles (least privilege)
Write-Host "`n2b. Assigning Runtime Identity Roles..."
try {
    $RuntimeIdentity = az identity show --name $RuntimeIdentityName --resource-group $ResourceGroup | ConvertFrom-Json
    $RuntimePrincipalId = $RuntimeIdentity.principalId

    Write-Host "   Assigning AcrPull on $AcrName..."
    az role assignment create --assignee $RuntimePrincipalId --role AcrPull --scope $AcrId 2>$null | Out-Null

    Write-Host "   Removing Contributor/AcrPush from runtime identity (if present)..."
    az role assignment delete --assignee $RuntimePrincipalId --role Contributor --scope $RgId 2>$null | Out-Null
    az role assignment delete --assignee $RuntimePrincipalId --role AcrPush --scope $AcrId 2>$null | Out-Null

    if ($KeyVaultName) {
        Write-Host "   Granting Key Vault secrets get/list on $KeyVaultName..."
        az keyvault delete-policy --name $KeyVaultName --object-id $RuntimePrincipalId 2>$null | Out-Null
        az keyvault set-policy --name $KeyVaultName --object-id $RuntimePrincipalId --secret-permissions get list 2>$null | Out-Null
    }
} catch {
    Write-Host "   (Runtime identity '$RuntimeIdentityName' not found or access denied, skipping)" -ForegroundColor DarkGray
}

# 3. Create Federated Credentials
Write-Host "`n3. Configuring Federated Credentials..."
$GhObject = "repo:$GithubOrg/$GithubRepo"

function Add-FedCred {
    param($Name, $Subject)
    Write-Host "   Setting credential: $Name..."

    # Delete existing credential first so updates apply cleanly
    az identity federated-credential delete --identity-name $IdentityName --resource-group $ResourceGroup --name $Name -y 2>$null | Out-Null

    # Use az identity federated-credential create
    az identity federated-credential create --identity-name $IdentityName --resource-group $ResourceGroup --name $Name --issuer "https://token.actions.githubusercontent.com" --subject $Subject --audiences "api://AzureADTokenExchange" 2>$null | Out-Null
}

Add-FedCred -Name "github-deploy-main" -Subject "$GhObject`:ref:refs/heads/main"
Add-FedCred -Name "github-deploy-develop" -Subject "$GhObject`:ref:refs/heads/develop"
Add-FedCred -Name "github-deploy-pr" -Subject "$GhObject`:pull_request"
Add-FedCred -Name "github-env-staging" -Subject "$GhObject`:environment:$StagingEnvironmentName"
Add-FedCred -Name "github-env-production" -Subject "$GhObject`:environment:$ProductionEnvironmentName"

# 4. Set GitHub Secrets
Write-Host "`n4. Setting GitHub Secrets..."

Write-Host "   Setting AZURE_CLIENT_ID..."
$ClientId | gh secret set AZURE_CLIENT_ID

Write-Host "   Setting AZURE_TENANT_ID..."
$TenantId | gh secret set AZURE_TENANT_ID

Write-Host "   Setting AZURE_SUBSCRIPTION_ID..."
$SubscriptionId | gh secret set AZURE_SUBSCRIPTION_ID

Write-Host "   Setting AZURE_CONTAINER_REGISTRY..."
$AcrName | gh secret set AZURE_CONTAINER_REGISTRY

Write-Host "   Setting AZURE_RESOURCE_GROUP_STAGING..."
$ResourceGroup | gh secret set AZURE_RESOURCE_GROUP_STAGING

Write-Host "   Setting AZURE_RESOURCE_GROUP..."
$ResourceGroupProd | gh secret set AZURE_RESOURCE_GROUP

# Remove potentially conflicting old secret
Write-Host "   Removing old AZURE_CREDENTIALS..."
try {
    gh secret delete AZURE_CREDENTIALS 2>$null
} catch {
    Write-Host "   (AZURE_CREDENTIALS not found, skipping removal)" -ForegroundColor DarkGray
}


Write-Host "`n5. Ensuring GitHub Environments..."
$repoName = $null
$ghScopes = Get-GithubTokenScopes

if ($null -eq $ghScopes) {
    Write-Host "   Skipping environment creation (GitHub CLI not authenticated). Run: gh auth login" -ForegroundColor DarkGray
} else {
    $hasRepoScope = $true
    if ($ghScopes.Count -gt 0) {
        $hasRepoScope = ($ghScopes -contains "repo") -or ($ghScopes -contains "public_repo")
    }

    if (-not $hasRepoScope) {
        Write-Host "   Skipping environment creation (missing repo scope). Run: gh auth refresh -s repo,workflow" -ForegroundColor DarkGray
    } else {
        try {
            $repoInfo = gh repo view --json nameWithOwner | ConvertFrom-Json
            $repoName = $repoInfo.nameWithOwner
        } catch {
            Write-Host "   Skipping environment creation (could not read repo info)." -ForegroundColor DarkGray
        }
    }
}

if ($repoName) {
    $isAdmin = Test-GithubRepoAdmin -RepoName $repoName
    if ($isAdmin -eq $false) {
        Write-Host "   Skipping environment creation (repo admin access required)." -ForegroundColor DarkGray
        Write-Host "   Ask an admin to create: $StagingEnvironmentName, $ProductionEnvironmentName" -ForegroundColor DarkGray
    } elseif ($null -eq $isAdmin) {
        Write-Host "   Skipping environment creation (could not verify repo permissions)." -ForegroundColor DarkGray
    } else {
        Ensure-GithubEnvironment -RepoName $repoName -EnvironmentName $StagingEnvironmentName | Out-Null
        Ensure-GithubEnvironment -RepoName $repoName -EnvironmentName $ProductionEnvironmentName | Out-Null

        $prodEnv = gh api "repos/$repoName/environments/$ProductionEnvironmentName" 2>$null | ConvertFrom-Json
        if ($LASTEXITCODE -eq 0 -and $prodEnv) {
            $reviewerRule = $null
            if ($prodEnv.protection_rules) {
                $reviewerRule = $prodEnv.protection_rules | Where-Object { $_.type -eq "required_reviewers" }
            }

            $hasReviewers = $false
            if ($reviewerRule) {
                foreach ($rule in @($reviewerRule)) {
                    if ($rule.reviewers -and $rule.reviewers.Count -gt 0) {
                        $hasReviewers = $true
                        break
                    }
                }
            }

            if (-not $hasReviewers) {
                Write-Host "   Warning: production environment has no required reviewers configured." -ForegroundColor DarkGray
                Write-Host "   Add reviewers in Settings > Environments > $ProductionEnvironmentName." -ForegroundColor DarkGray
            }
        }
    }
}

Write-Host "`n✅ Setup Complete! You can now run the workflow."
