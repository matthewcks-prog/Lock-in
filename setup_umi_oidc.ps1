$ErrorActionPreference = "Stop"

# Configuration
$SubscriptionId = "473adbd3-1a70-4074-aa01-5451673d058b"
$TenantId = "ef7a487a-77ca-410a-803d-e426b62a587f"
$ResourceGroup = "lock-in-dev"
$AcrName = "lockinacr"
$IdentityName = "id-github-actions-lock-in"
$GithubOrg = "matthewcks-prog"
$GithubRepo = "Lock-in"

Write-Host "🚀 Starting UAMI OIDC Setup..."
Write-Host "Config: Sub=$SubscriptionId, RG=$ResourceGroup, Identity=$IdentityName"

# 1. Create User-Assigned Managed Identity
Write-Host "`n1. Creating/Checking Managed Identity..."
# Use tr/catch or just force create if we suspect it doesn't exist, but checking is nicer.
# We suppress the error action for this specific command
$IdentityId = try { az identity show --name $IdentityName --resource-group $ResourceGroup --query id -o tsv 2>$null } catch { $null }

if (-not $IdentityId) {
    Write-Host "   Creating new Identity: $IdentityName"
    $IdentityId = az identity create --name $IdentityName --resource-group $ResourceGroup --query id -o tsv
} else {
    Write-Host "   Using existing Identity: $IdentityId"
}

$ClientId = az identity show --name $IdentityName --resource-group $ResourceGroup --query clientId -o tsv
Write-Host "   Client ID: $ClientId"

# 2. Assign Roles
Write-Host "`n2. Assigning Roles..."
$PrincipalId = az identity show --name $IdentityName --resource-group $ResourceGroup --query principalId -o tsv

# Contributor on Resource Group
$RgId = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup"
Write-Host "   Assigning Contributor on $ResourceGroup..."
az role assignment create --assignee $PrincipalId --role Contributor --scope $RgId 2>$null | Out-Null

# AcrPush on ACR
$AcrId = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.ContainerRegistry/registries/$AcrName"
Write-Host "   Assigning AcrPush on $AcrName..."
az role assignment create --assignee $PrincipalId --role AcrPush --scope $AcrId 2>$null | Out-Null

# 3. Configure Federated Credentials
Write-Host "`n3. Configuring Federated Credentials..."
$GhObject = "repo:$GithubOrg/$GithubRepo"
$Audiences = "['api://AzureADTokenExchange']"

function Add-FedCred {
    param($Name, $Subject)
    Write-Host "   Setting credential: $Name..."

    # Delete if exists
    az identity federated-credential delete --name $Name --identity-name $IdentityName --resource-group $ResourceGroup -y 2>$null | Out-Null

    # Create with explicit flags (avoiding JSON/parameter file issues)
    az identity federated-credential create `
        --name $Name `
        --identity-name $IdentityName `
        --resource-group $ResourceGroup `
        --issuer "https://token.actions.githubusercontent.com" `
        --subject $Subject `
        --audiences "api://AzureADTokenExchange" `
        2>$null | Out-Null
}

Add-FedCred -Name "github-deploy-main" -Subject "$GhObject`:ref:refs/heads/main"
Add-FedCred -Name "github-deploy-develop" -Subject "$GhObject`:ref:refs/heads/develop"
Add-FedCred -Name "github-deploy-pr" -Subject "$GhObject`:pull_request"

# 4. Set GitHub Secrets
Write-Host "`n4. Setting GitHub Secrets..."
Write-Host "   Setting AZURE_CLIENT_ID..."
$ClientId | gh secret set AZURE_CLIENT_ID

Write-Host "   Setting AZURE_TENANT_ID..."
$TenantId | gh secret set AZURE_TENANT_ID

Write-Host "   Setting AZURE_SUBSCRIPTION_ID..."
$SubscriptionId | gh secret set AZURE_SUBSCRIPTION_ID

Write-Host "`n✅ Setup Complete! Your workflow should now use the Managed Identity."
