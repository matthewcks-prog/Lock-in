# Repository Hardening Plan

> Updated: 2026-02-18
> Scope: Entire Lock-in repository

## Active Objectives

1. Keep `npm run validate` green on every change.
2. Preserve strict layer boundaries (`core/api/backend/extension/integrations/ui`).
3. Reduce complexity/file-size hotspots without changing public behavior.
4. Remove dead code/docs in the same PR that replaces them.

## Current Enforcement

- Formatting: `npm run format:check`
- Docs links: `npm run docs:check-links`
- Lint + architecture boundaries: `npm run lint:all`
- Tests: `npm run test:all`
- Type-check: `npm run type-check`
- Build verification: `npm run build` + `npm run verify-build`

## Phased Execution

### Phase 1: Structure and Source-of-Truth Cleanup

- Consolidate tooling config (`config/vite/shared.ts`).
- Consolidate test bootstrap (`shared/test/setupVitest.ts`).
- Consolidate backend docs under `docs/backend/`.
- Remove tracked runtime artifacts and stale folders.

### Phase 2: High-Risk Maintainability Hotspots

- Refactor largest/highest-complexity files first.
- Add regression tests for each behavioral refactor.
- Keep each refactor slice independently releasable.

### Phase 3: Reliability and Boundary Hardening

- Audit network/file/storage boundaries for timeout and validation coverage.
- Add/expand contract tests for extension <-> background and api <-> backend seams.
- Remove remaining compatibility shims once all callsites migrate.

## Exit Criteria

- `npm run validate` passes.
- No architecture/lint boundary violations.
- Docs reflect current live structure and ownership.
- Remaining follow-ups are captured directly in `docs/tracking/STATUS.md` and scoped per PR.

## Historical Snapshot

- Previous plan snapshot moved to: `docs/archive/REFACTOR_PLAN_2026-02-17.md`
