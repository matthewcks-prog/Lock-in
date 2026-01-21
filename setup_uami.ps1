$ErrorActionPreference = "Stop"

# Configuration
$SubscriptionId = "473adbd3-1a70-4074-aa01-5451673d058b"
$TenantId = "ef7a487a-77ca-410a-803d-e426b62a587f"
$ResourceGroup = "lock-in-dev"
$AcrName = "lockinacr"
$IdentityName = "lock-in-identity"
$GithubOrg = "matthewcks-prog"
$GithubRepo = "Lock-in"

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

# 3. Create Federated Credentials
Write-Host "`n3. Configuring Federated Credentials..."
$GhObject = "repo:$GithubOrg/$GithubRepo"

function Add-FedCred {
    param($Name, $Subject)
    Write-Host "   Setting credential: $Name..."
    $params = @{
        name = $Name
        issuer = "https://token.actions.githubusercontent.com"
        subject = $Subject
        description = "GitHub Actions $Name"
        audiences = @("api://AzureADTokenExchange")
    } | ConvertTo-Json -Compress

    # Use az identity federated-credential create
    az identity federated-credential create --identity-name $IdentityName --resource-group $ResourceGroup --name $Name --issuer "https://token.actions.githubusercontent.com" --subject $Subject --audiences "api://AzureADTokenExchange" 2>$null | Out-Null
}

Add-FedCred -Name "github-deploy-main" -Subject "$GhObject`::ref:refs/heads/main"
Add-FedCred -Name "github-deploy-develop" -Subject "$GhObject`::ref:refs/heads/develop"
Add-FedCred -Name "github-deploy-pr" -Subject "$GhObject`::pull_request"

# 4. Set GitHub Secrets
Write-Host "`n4. Setting GitHub Secrets..."
Write-Host "   Setting AZURE_CLIENT_ID..."
$ClientId | gh secret set AZURE_CLIENT_ID

# Tenant/Sub might already be set but good to ensure
Write-Host "   Setting AZURE_TENANT_ID..."
$TenantId | gh secret set AZURE_TENANT_ID

Write-Host "   Setting AZURE_SUBSCRIPTION_ID..."
$SubscriptionId | gh secret set AZURE_SUBSCRIPTION_ID

# Remove potentially conflicting old secret
Write-Host "   Removing old AZURE_CREDENTIALS..."
gh secret delete AZURE_CREDENTIALS 2>$null

Write-Host "`n✅ Setup Complete! You can now run the workflow."
