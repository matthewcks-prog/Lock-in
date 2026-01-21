$ErrorActionPreference = "Stop"

# Configuration
$SubscriptionId = "473adbd3-1a70-4074-aa01-5451673d058b"
$TenantId = "ef7a487a-77ca-410a-803d-e426b62a587f"
$ResourceGroup = "lock-in-dev"
$AcrName = "lockinacr"
$AppName = "github-actions-lock-in-oidc"
$GithubOrg = "matthewcks-prog"
$GithubRepo = "Lock-in"

Write-Host "🚀 Starting OIDC Setup..."
Write-Host "Config: Sub=$SubscriptionId, RG=$ResourceGroup, ACR=$AcrName, Repo=$GithubOrg/$GithubRepo"

# 1. Create or Get Azure AD App
Write-Host "`n1. Checking Azure AD Application..."
$AppId = az ad app list --display-name $AppName --query "[0].appId" -o tsv
if (-not $AppId) {
    Write-Host "   Creating new App: $AppName"
    $AppId = az ad app create --display-name $AppName --query appId -o tsv
} else {
    Write-Host "   Using existing App ID: $AppId"
}

# 2. Create or Get Service Principal
Write-Host "`n2. Checking Service Principal..."
$SpId = az ad sp show --id $AppId --query id -o tsv 2>$null
if (-not $SpId) {
    Write-Host "   Creating new Service Principal..."
    $SpId = az ad sp create --id $AppId --query id -o tsv
} else {
    Write-Host "   Using existing SP ID: $SpId"
}

# 3. Assign Roles
Write-Host "`n3. Assigning Roles..."
# Contributor on Resource Group
$RgId = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup"
Write-Host "   Assigning Contributor on $ResourceGroup..."
az role assignment create --assignee $AppId --role Contributor --scope $RgId --allow-no-principal 2>$null | Out-Null

# AcrPush on ACR
$AcrId = "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.ContainerRegistry/registries/$AcrName"
Write-Host "   Assigning AcrPush on $AcrName..."
az role assignment create --assignee $AppId --role AcrPush --scope $AcrId --allow-no-principal 2>$null | Out-Null

# 4. Create Federated Credentials
Write-Host "`n4. Configuring Federated Credentials..."
$GhObject = "repo:$GithubOrg/$GithubRepo"
$Audiences = "['api://AzureADTokenExchange']"

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

    # Check if exists first to avoid error, or just try create and catch
    # az ad app federated-credential show throws if not found
    az ad app federated-credential create --id $AppId --parameters $params 2>$null | Out-Null
}

Add-FedCred -Name "github-deploy-main" -Subject "$GhObject`::ref:refs/heads/main"
Add-FedCred -Name "github-deploy-develop" -Subject "$GhObject`::ref:refs/heads/develop"
Add-FedCred -Name "github-deploy-pr" -Subject "$GhObject`::pull_request"

# 5. Set GitHub Secrets
Write-Host "`n5. Setting GitHub Secrets..."
Write-Host "   Setting AZURE_CLIENT_ID..."
$AppId | gh secret set AZURE_CLIENT_ID

Write-Host "   Setting AZURE_TENANT_ID..."
$TenantId | gh secret set AZURE_TENANT_ID

Write-Host "   Setting AZURE_SUBSCRIPTION_ID..."
$SubscriptionId | gh secret set AZURE_SUBSCRIPTION_ID

Write-Host "`n✅ Setup Complete! You can now run the workflow."
