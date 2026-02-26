# ADR-003: Deployment Gate via Repository Variable (ACR Cost Control)

**Status**: Accepted  
**Date**: 2026-02-22  
**Authors**: Codex

## Context

Azure Container Registry (ACR) incurs cost for the registry tier and storage. The backend-deploy workflow pushes images to ACR on push to `main` (and workflow_dispatch); the acr-cleanup workflow runs weekly. There was no way to pause ACR usage from the repository without editing workflow files or removing secrets, which is error-prone and not easily reversible.

Requirements:

- Pause ACR push and deploy without breaking build/test.
- Single place to control “deployment on/off” (scalability, maintainability).
- Resume when ready for staging without code changes (toggle variable only).
- Low coupling: gate is a single repository variable; workflows stay independent of Azure resource lifecycle.

## Decision

Introduce a **repository variable** as the single source of truth for enabling ACR push and deploy:

- **Variable**: `DEPLOYMENT_ENABLED` (Settings → Secrets and variables → Actions → Variables).
- **Semantics**: Only when `DEPLOYMENT_ENABLED == 'true'` do we push to ACR and run deploy jobs. When unset or any other value (e.g. `false`), those jobs are skipped. Build, test, Trivy, and container health check always run.
- **Scope**:
  - `backend-deploy.yml`: `push-to-acr` job runs only if `vars.DEPLOYMENT_ENABLED == 'true'` and branch/dispatch indicates staging or production. `deploy-staging` and `deploy-production` depend on `push-to-acr`, so they are implicitly gated.
  - `acr-cleanup.yml`: cleanup job runs only if `vars.DEPLOYMENT_ENABLED == 'true'`, so no ACR API calls when deployment is paused.
- **Default**: Variable unset → skip ACR and deploy (pause). No need to create the variable to pause.
- **Documentation**: CICD.md documents the variable, pause/resume steps, and that Azure billing for ACR stops only when the registry is deleted or downsized in Azure.

## Consequences

### Positive

- Single toggle for pausing/resuming deployment and ACR usage; no workflow edits required.
- Build and test remain runnable and validated when deployment is paused (testability).
- Modular: gate is one variable; workflows stay decoupled from each other and from Azure resource creation/deletion.
- Reversible and auditable: variable change is visible in Settings; no secret rotation needed.

### Negative

- Teams must know to set `DEPLOYMENT_ENABLED = true` when enabling staging/production (documented in CICD.md and deployment README).

### Risks

- If the variable is deleted, behavior defaults to “paused” (skip). Existing deployments are unaffected; only new pushes/deploys stop until the variable is set again.
