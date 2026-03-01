# ACR Cleanup — Canonical Reference

**ACR cleanup and cost control are documented in the deployment docs.**

- **Pausing deployment and cleaning the registry:** [CICD.md § Pausing and resuming deployment](../../deployment/CICD.md#pausing-and-resuming-deployment-acr-cost-control) and [§ Clean the registry while paused](../../deployment/CICD.md#clean-the-registry-while-paused-recommended).
- **One-time login and clean images:** [CICD.md § One-time: log in and clean ACR images](../../deployment/CICD.md#one-time-log-in-and-clean-acr-images-option-b).

**Scripts:**

- `scripts/cleanup-acr.ps1` — Manual ACR image cleanup (dry run and execute). Requires `az login` and `AZURE_CONTAINER_REGISTRY` (or `-RegistryName`).
- `scripts/monitor-acr-usage.ps1` — ACR usage and cost report.

**Workflow:** `.github/workflows/acr-cleanup.yml` runs only when `DEPLOYMENT_ENABLED` is `true` (see CICD.md).
