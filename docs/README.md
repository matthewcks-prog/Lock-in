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

## Folder Structure

### Architecture (`docs/architecture/`)

- `ARCHITECTURE.md` - Stable invariants, surfaces, and boundaries
- `REPO_MAP.md` - High-level repo map and entrypoints
- `AI_SERVICES_ARCHITECTURE.md` - AI provider architecture and layering
- `MONOREPO.md` - npm workspaces and monorepo conventions

### Reference (`docs/reference/`)

- `CODE_OVERVIEW.md` - Living snapshot of implementation details
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

### Features (`docs/features/`)

- `transcripts/` - Transcript system docs and troubleshooting

### Setup (`docs/setup/`)

- `LOCAL_SUPABASE_SETUP.md` - Local Supabase CLI workflow
- `CODE_FORMATTING.md` - Formatting conventions
- Environment configuration: see `docs/deployment/ENVIRONMENTS.md`

### Testing (`docs/testing/`)

- `BACKEND_TESTING.md` - Backend testing standards and patterns
- `SMOKE_CHECKLIST.md` - Manual smoke tests and validation checklist

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
