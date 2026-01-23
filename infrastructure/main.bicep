// =============================================================================
// Lock-in Backend - Production-Ready Bicep Template
// Infrastructure as Code following Azure and industry best practices
//
// Features:
//   - Health probes (liveness + readiness)
//   - Auto-scaling with CPU/memory/HTTP concurrency rules
//   - Key Vault integration for secrets (via User Assigned Identity)
//   - Resource tagging for cost tracking and governance
//   - Monitoring and Application Insights
//   - Security hardening (non-root user, HTTPS only)
//
// Usage:
//   az deployment group create \
//     --resource-group <resource-group> \
//     --template-file infrastructure/main.bicep \
//     --parameters environment=staging|production
// =============================================================================

// =============================================================================
// Parameters
// =============================================================================
@description('Azure region for all resources')
param location string = 'australiaeast'

@description('Environment name (staging or production)')
@allowed([
  'staging'
  'production'
])
param environment string = 'staging'

@description('Container image to deploy (with tag)')
param containerImage string = 'lockinacr.azurecr.io/lock-in-backend:latest'

@description('Minimum number of replicas (0 for scale-to-zero)')
param minReplicas int = 0

@description('Maximum number of replicas for autoscaling')
param maxReplicas int = 5

@description('CPU cores allocation per container')
param cpuCores string = '0.5'

@description('Memory allocation per container')
param memorySize string = '1.0Gi'

@description('Key Vault name containing secrets')
param keyVaultName string = 'lock-in-kv'

@description('Project name for resource naming')
param projectName string = 'lock-in'

// =============================================================================
// Variables
// =============================================================================
var environmentConfig = {
  staging: {
    containerAppName: 'lock-in-dev'
    environmentName: 'lock-in-env'  // Existing environment
    resourceGroup: 'lock-in-dev'
    logAnalyticsName: 'lock-in-backend-logs'
    nodeEnv: 'development'
  }
  production: {
    containerAppName: 'lock-in-backend'
    environmentName: 'lock-in-env'  // Existing environment
    resourceGroup: 'lock-in-prod'
    logAnalyticsName: 'lock-in-backend-logs'
    nodeEnv: 'production'
  }
}

var config = environmentConfig[environment]
var acrLoginServer = 'lockinacr.azurecr.io'
var userAssignedIdentityId = '/subscriptions/473adbd3-1a70-4074-aa01-5451673d058b/resourcegroups/lock-in-dev/providers/microsoft.managedidentity/userassignedidentities/id-github-actions-lock-in'

// Resource tags for governance and cost tracking
var commonTags = {
  Project: projectName
  Environment: environment
  ManagedBy: 'Bicep'
  CostCenter: 'Engineering'
  Workload: 'Backend-API'
}

// =============================================================================
// Existing Resources
// =============================================================================
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' existing = {
  name: config.logAnalyticsName
  scope: resourceGroup(config.resourceGroup)
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
  scope: resourceGroup(config.resourceGroup)
}

// Reference existing Container Apps Environment
resource environment_resource 'Microsoft.App/managedEnvironments@2023-05-01' existing = {
  name: config.environmentName
}

// =============================================================================
// Container App
// =============================================================================
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: config.containerAppName
  location: location
  tags: commonTags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userAssignedIdentityId}': {}
    }
  }
  properties: {
    managedEnvironmentId: environment_resource.id

    // =============================================================================
    // Configuration Section
    // =============================================================================
    configuration: {
      // Secrets from Key Vault
      secrets: [
        {
          name: 'azure-openai-api-key'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/AZURE-OPENAI-API-KEY'
          identity: userAssignedIdentityId
        }
        {
          name: 'azure-openai-endpoint'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/AZURE-OPENAI-ENDPOINT'
          identity: userAssignedIdentityId
        }
        {
          name: 'openai-api-key'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/OPENAI-API-KEY'
          identity: userAssignedIdentityId
        }
        {
          name: 'supabase-url'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/SUPABASE-URL-${toUpper(environment == 'production' ? 'PROD' : 'DEV')}'
          identity: userAssignedIdentityId
        }
        {
          name: 'supabase-anon-key'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/SUPABASE-ANON-KEY-${toUpper(environment == 'production' ? 'PROD' : 'DEV')}'
          identity: userAssignedIdentityId
        }
        {
          name: 'supabase-service-role-key'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/SUPABASE-SERVICE-ROLE-KEY-${toUpper(environment == 'production' ? 'PROD' : 'DEV')}'
          identity: userAssignedIdentityId
        }
        {
          name: 'sentry-dsn'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/SENTRY-DSN'
          identity: userAssignedIdentityId
        }
      ]

      // Ingress configuration
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto' // HTTP/2 when possible
        allowInsecure: false // HTTPS only
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
        // CORS configuration
        corsPolicy: {
          allowedOrigins: [
            'https://*.azurecontainerapps.io'
            'https://*.supabase.co'
          ]
          allowedMethods: [
            'GET'
            'POST'
            'PUT'
            'DELETE'
            'OPTIONS'
          ]
          allowedHeaders: [
            '*'
          ]
          maxAge: 3600
        }
      }

      // Registry configuration
      registries: [
        {
          server: acrLoginServer
          identity: userAssignedIdentityId
        }
      ]

      // Active revisions mode
      activeRevisionsMode: 'Single' // Use 'Multiple' for blue-green deployments
    }

    // =============================================================================
    // Template Section
    // =============================================================================
    template: {
      // Container definition
      containers: [
        {
          name: config.containerAppName
          image: containerImage

          // Environment variables
          env: [
            {
              name: 'NODE_ENV'
              value: config.nodeEnv
            }
            {
              name: 'PORT'
              value: '3000'
            }
            {
              name: 'TRANSCRIPTION_TEMP_DIR'
              value: '/tmp/transcripts'
            }
            // Azure OpenAI configuration
            {
              name: 'AZURE_OPENAI_API_KEY'
              secretRef: 'azure-openai-api-key'
            }
            {
              name: 'AZURE_OPENAI_ENDPOINT'
              secretRef: 'azure-openai-endpoint'
            }
            {
              name: 'AZURE_OPENAI_API_VERSION'
              value: '2024-02-01'
            }
            {
              name: 'AZURE_OPENAI_CHAT_DEPLOYMENT'
              value: 'gpt-4o-mini'
            }
            {
              name: 'AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT'
              value: 'text-embedding-3-small'
            }
            {
              name: 'AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT'
              value: 'whisper-1'
            }
            // OpenAI fallback
            {
              name: 'OPENAI_API_KEY'
              secretRef: 'openai-api-key'
            }
            {
              name: 'OPENAI_FALLBACK_ENABLED'
              value: 'true'
            }
            // Supabase configuration
            {
              name: environment == 'production' ? 'SUPABASE_URL_PROD' : 'SUPABASE_URL_DEV'
              secretRef: 'supabase-url'
            }
            {
              name: environment == 'production' ? 'SUPABASE_ANON_KEY_PROD' : 'SUPABASE_ANON_KEY_DEV'
              secretRef: 'supabase-anon-key'
            }
            {
              name: environment == 'production' ? 'SUPABASE_SERVICE_ROLE_KEY_PROD' : 'SUPABASE_SERVICE_ROLE_KEY_DEV'
              secretRef: 'supabase-service-role-key'
            }
            // Sentry configuration
            {
              name: 'SENTRY_DSN'
              secretRef: 'sentry-dsn'
            }
            {
              name: 'SENTRY_ENVIRONMENT'
              value: environment
            }
          ]

          // Resource limits
          resources: {
            cpu: json(cpuCores)
            memory: memorySize
          }

          // =============================================================================
          // Health Probes (CRITICAL for production reliability)
          // =============================================================================
          probes: [
            // Liveness probe - restarts container if failing
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 3000
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 30
              timeoutSeconds: 5
              failureThreshold: 3
              successThreshold: 1
            }
            // Readiness probe - removes from load balancer if failing
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 3000
                scheme: 'HTTP'
              }
              initialDelaySeconds: 5
              periodSeconds: 10
              timeoutSeconds: 3
              failureThreshold: 3
              successThreshold: 1
            }
            // Startup probe - allows slow container startup
            {
              type: 'Startup'
              httpGet: {
                path: '/health'
                port: 3000
                scheme: 'HTTP'
              }
              initialDelaySeconds: 0
              periodSeconds: 5
              timeoutSeconds: 3
              failureThreshold: 12 // 60 seconds to start (12 * 5s)
              successThreshold: 1
            }
          ]
        }
      ]

      // =============================================================================
      // Autoscaling Rules (Industry best practices)
      // =============================================================================
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          // HTTP concurrency-based scaling
          {
            name: 'http-scaling-rule'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
          // CPU-based scaling (backup rule)
          {
            name: 'cpu-scaling-rule'
            custom: {
              type: 'cpu'
              metadata: {
                type: 'Utilization'
                value: '75' // Scale out at 75% CPU
              }
            }
          }
          // Memory-based scaling (backup rule)
          {
            name: 'memory-scaling-rule'
            custom: {
              type: 'memory'
              metadata: {
                type: 'Utilization'
                value: '80' // Scale out at 80% memory
              }
            }
          }
        ]
      }
    }
  }
}

// =============================================================================
// Outputs
// =============================================================================
@description('Container App FQDN')
output containerAppUrl string = containerApp.properties.configuration.ingress.fqdn

@description('Container App Name')
output containerAppName string = containerApp.name

@description('Container App Resource ID')
output containerAppId string = containerApp.id

@description('Environment Name')
output environmentName string = environment_resource.name
