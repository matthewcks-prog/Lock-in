# Operations & Validation Overview

## Required Quality Gate

- `npm run validate`

This executes formatting, doc-link checks, type-check, lint suites, dependency boundary checks, tests, build, and build verification.

## Core Guardrails

- Architecture boundaries: `npm run lint:deps`
- Backend/extension lint: `npm run lint:all`
- Tests: `npm run test:all` and coverage gates in CI
- Build verification: `npm run verify-build`

## Observability Entrypoints

- Backend:
  - `backend/observability/logger.js`
  - `backend/observability/appInsights.js`
  - `backend/observability/sentry.js`
- Extension:
  - `extension/src/sentry.ts` and `extension/src/sentry/*`

## Operational Docs

- Environments: `docs/deployment/ENVIRONMENTS.md`
- CI/CD: `docs/deployment/CICD.md`
- Rollback: `docs/deployment/ROLLBACK.md`
- Backend-specific ops: `docs/backend/*`
