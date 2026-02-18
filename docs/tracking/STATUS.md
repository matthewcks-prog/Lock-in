# Status (Updated 2026-02-18)

## Summary

- Repository structure has been cleaned for clearer ownership:
  - Shared Vite/Vitest helper moved to `config/vite/shared.ts`.
  - Vitest bootstrap moved to `shared/test/setupVitest.ts`.
  - Backend operational docs moved to `docs/backend/`.
- Legacy runtime artifact `backend/server.err` was removed.
- Stale/obsolete path references were updated in architecture/testing docs.

## Quality Gate

`npm run validate` is the required gate for all changes. This includes formatting, doc-link checks, lint/boundary rules, tests, type-checking, and build verification.

## Current Risks

- Some large non-critical files remain and should be refactored incrementally with tests.
- UI/runtime size growth should be monitored before new feature expansion.

## Next Focus

1. Reduce complexity in top hotspot files without API changes.
2. Expand targeted regression tests around refactored modules.
3. Continue deleting stale docs/code as replacements land.
