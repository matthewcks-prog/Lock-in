# Refactor Plan

## How to use this doc

This document outlines the phased approach to prepare the codebase for a Codex refactor while maintaining extension and backend functionality. Use this as a reference when planning refactoring work and tracking progress through each phase.

---

## Goal

Prepare the codebase for Codex refactor without breaking extension/backend functionality.

---

## Phases

### Phase B1: Persistent docs (plan + prompt log)

- Create `docs/REFACTOR_PLAN.md` to track phased approach
- Create `docs/PROMPT_LOG.md` to log all refactor-prep prompts
- Establish documentation structure for tracking progress

### Phase B2: Globals typing + alias parity

- Add TypeScript type definitions for all global variables and window properties
- Ensure path aliases in `tsconfig.json` match those in `vite.config.ts` (and other build configs)

### Phase B3: Verify-build script + npm script wiring

- Create `verify-build` script in `package.json`
- Ensure script runs successfully and validates build output
- Wire up npm scripts for build verification

### Phase B4: Smoke checklist ✅

- [x] Create smoke test checklist document (`docs/SMOKE_CHECKLIST.md`)
- [x] Include manual verification steps for critical extension/backend functionality
- [x] Add debug tips section for common issues

### Phase B5: ESLint + boundary rules ✅

- [x] **B5A**: Add ESLint baseline tooling with minimal noise (warnings-first)
- [x] **B5B**: Add boundary rules to enforce architecture
  - Examples: no Chrome APIs in `/core`, no direct DOM manipulation in services
  - Configure rules to catch violations during development

### Phase B6: Minimal unit test harness (optional but recommended) 🚧

- [x] **B6A**: Set up basic unit test infrastructure
  - [x] Add vitest, @vitest/coverage-v8, jsdom dev dependencies
  - [x] Add test scripts (test, test:watch, test:coverage)
  - [x] Configure vitest with jsdom environment
- [x] Add anchor tests: textUtils.test.ts, moodleAdapter.test.ts
- [x] Add unit tests for critical paths: adapters, state management, core services
- [x] Add UI chat history component tests (history load/select/restore)
- [x] Ensure tests can run in CI/CD pipeline

## Codex Phase

- **C1: Import hygiene + alias normalization** - Complete (deep relative imports in extension notes files replaced with path aliases; added @shared/ui tsconfig paths; docs clarified around extension UI output).
- **C2: Doc scaffolds** - Complete (added ARCHITECTURE, REPO_MAP, STATUS; refreshed AGENTS hierarchy and refactor logs).
- **C3: Shared Vite config** - Complete (centralized aliases/ascii plugin/IIFE defaults into `build/viteShared.ts`; initApi/contentLibs/UI configs now reuse helpers with identical outputs).
- **C4B-1: API client contract guardrails** - Complete (added Vitest surface/invariant tests to lock `createApiClient` keys, signature, retry/abort/conflict/no-content behaviors ahead of the fetcher split).
- **C4B-2: API client layering (fetcher + resources)** - Complete (split `api/client.ts` into `api/fetcher.ts` + resource clients under `api/resources/` while preserving identical public surface and semantics).
- **C4B-3: API client regression traps + docs** - Complete (added targeted tests for asset mapping and If-Unmodified-Since/409 semantics; updated STATUS with invariants and smoke reminders).
- **C4C-1: Content runtime contract** - Complete (added versioned `window.LockInContent` runtime with compat shims, migrated helpers to canonical API, added surface test + ESLint guard, ran lint/test/type-check/build/verify-build).
- **C4C-2: Content runtime compat removal** - Complete (removed legacy `Storage`/`MessageTypes` aliases, tightened ESLint guard to error, added tests for canonical-only `window.LockInContent` surface, updated docs/logs).
- **C5A: Init API global contract tests** - Complete (added Vitest surface test locking `window.LockInAPI`/`window.LockInAuth` method bags and compat aliases using shared API key fixture).
- **C5B: UI global contract tests** - Complete (added Vitest surface test for `window.LockInUI` keys + factory contract to guard sidebar bootstrap surface).
- **C5C: Manifest content_scripts order contract** - Complete (added manifest order guardrail test to lock script list and critical ordering constraints ahead of init sequence).
- **C5D: Content bootstrap init-order guardrail** - Complete (Vitest suite covering late UI/runtime availability and idempotent bootstrap to prevent race regressions).
- **C5E: Refactor gate (CI + local check)** - Complete (added GitHub Actions refactor gate running lint → test → type-check → build → verify-build plus backend npm ci/test, and a root `check` script mirroring the gate).
- **C5F: Extension build output contract** - Complete (moved UI/libs bundles to `extension/dist/**`, updated build configs, manifest/script references, tests, and docs to match).
- **C5G: Build output banner guardrail** - Complete (added generated-file banner to Vite IIFE outputs to discourage manual edits and clarify source-of-truth entries).

---

## Documentation Status

- **`AGENTS._LIVINGDOC.md`** is deprecated and will be removed after guardrails are in place. All guidance has been migrated to `/AGENTS.md` and `docs/*`.

## Definition of Done for Guardrails

Before considering guardrails complete, verify all items below:

- [ ] **Globals typed**: All global variables and window properties have TypeScript type definitions
- [ ] **tsconfig/vite alias parity**: Path aliases in `tsconfig.json` match those in `vite.config.ts` (and any other build configs)
- [x] **verify-build exists + passes**: A `verify-build` script exists in `package.json` and runs successfully (enforced via `npm run check` and CI refactor gate)
- [x] **smoke checklist exists**: A smoke test checklist document exists (`docs/SMOKE_CHECKLIST.md`) with manual verification steps
- [x] **eslint boundary rules exist**: ESLint rules enforce architectural boundaries (e.g., no Chrome APIs in `/core`, no direct DOM manipulation in services)
- [x] **minimal unit tests exist** (optional but recommended): At least basic unit tests exist for critical paths (adapters, state management, core services)
