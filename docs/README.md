# Documentation Index

All project documentation lives under `docs/`, with three root exceptions: `AGENTS.md`, `README.md`, and `LICENSE`.

## Canonical Sources

- Stable architecture guardrails: `docs/architecture/ARCHITECTURE.md`
- Repository navigation map: `docs/architecture/REPO_MAP.md`
- Current implementation snapshot: `docs/reference/CODE_OVERVIEW.md`
- Database schema and migration history: `docs/reference/DATABASE.md`
- Current project status: `docs/tracking/STATUS.md`
- Phased refactor plan: `docs/tracking/REFACTOR_PLAN.md`
- Refactor prompt log: `docs/tracking/PROMPT_LOG.md`

## Compliance And Policy

- `PRIVACY.md` - Privacy policy for extension, backend, and provider usage
- `TERMS.md` - Terms of service and academic integrity boundaries
- `SECURITY.md` - Security controls and disclosure guidance
- `docs/data-handling.md` - End-to-end data flow and AI provider disclosure
- `docs/permissions.md` - Manifest permissions mapped to callsites
- `docs/retention.md` - Retention windows and cleanup paths

## Folder Structure

### Architecture (`docs/architecture/`)

- `ARCHITECTURE.md` - Stable invariants, surfaces, and boundaries
- `REPO_MAP.md` - High-level repo map and entrypoints
- `AI_SERVICES_ARCHITECTURE.md` - AI provider architecture and layering
- `MONOREPO.md` - npm workspaces and monorepo conventions

### Reference (`docs/reference/`)

- `CODE_OVERVIEW.md` - Ownership index for implementation snapshots
- `code-overview/` - Section-owned implementation snapshots (extension/backend/cross-layer/operations)
- `DATABASE.md` - Canonical schema, RLS, and migration notes
- `CHANGELOG.md` - Versioned change history
- `CONTRIBUTING.md` - Contribution workflow and guardrails

### Deployment (`docs/deployment/`)

- `ENVIRONMENTS.md` - Canonical environment strategy and configuration
- `AZURE.md` - Azure deployment setup
- `CICD.md` - CI/CD pipeline details
- `CI_CHECKLIST.md` - CI debugging checklist
- `ROLLBACK.md` - Rollback and recovery procedures
- `README.md` - Deployment index

### Backend (`docs/backend/`)

- `AZURE_EMBEDDINGS_SETUP.md` - Azure embeddings setup and verification
- `MIGRATION_CHECKLIST.md` - Backend migration checklist

### Features (`docs/features/`)

- `transcripts/` - Transcript system docs and troubleshooting

### Setup (`docs/setup/`)

- `LOCAL_DEVELOPMENT.md` - Complete local development setup (primary)
- `CODE_FORMATTING.md` - Formatting conventions
- Environment configuration: see `docs/deployment/ENVIRONMENTS.md`

### Testing (`docs/testing/`)

- `BACKEND_TESTING.md` - Backend testing standards and patterns
- `SMOKE_CHECKLIST.md` - Manual smoke tests and validation checklist
- `release-checklist.md` - Release-readiness manual checks for compliance features

### Tracking (`docs/tracking/`)

- `STATUS.md` - Current focus, risks, and recent changes
- `REFACTOR_PLAN.md` - Refactor plan with phase acceptance criteria
- `PROMPT_LOG.md` - Log of refactor-prep sessions

### Archive (`docs/archive/`)

Historical audits, reviews, and one-off investigations that are no longer canonical.

## Root Documents

- `AGENTS.md` - Stable collaboration contract and architectural guardrails
- `README.md` - Project overview and getting started
- `LICENSE` - License text

## Maintenance Rules

- Place new documentation under `docs/` in the most relevant folder.
- Update this index when you add, remove, rename, or move docs.
- Archive historical docs under `docs/archive/`.
