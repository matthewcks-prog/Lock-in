# Refactor Plan

Tracks refactor-prep work (guardrails, documentation, tests, build scripts).

## Current Phase

**Phase B6: Test Hardening** (in progress)

Focus: Adding critical-path unit tests, reducing lint noise, maintaining refactor gate.

## Completed Phases

### Phase 1: Build and Tooling Guardrails

- [x] Bundle transcript providers for background usage (`vite.config.transcriptProviders.ts`)
- [x] Document provider bundle usage in build docs

### Phase 2: Import Hygiene (C1)

- [x] Normalize `@core/*` and `@shared/ui` path aliases
- [x] Remove deep relative imports

### Phase 3: Documentation Scaffolds (C2)

- [x] Create `docs/ARCHITECTURE.md` - Stable architecture invariants
- [x] Create `docs/REPO_MAP.md` - Repository structure map
- [x] Create `docs/STATUS.md` - Living snapshot of current state

### Phase 4: Shared Vite Config (C3)

- [x] Deduplicate shared Vite configuration
- [x] Centralize build settings

### Phase 5: API Client Layering (C4)

- [x] Layer API client into fetcher + resource clients
- [x] Add contract guardrails (surface keys/signature locked)
- [x] Add retry/abort/conflict/asset mapping tests
- [x] Update documentation

### Phase 6: Content Runtime Versioning (C4C-1, C4C-2)

- [x] Version `window.LockInContent` runtime
- [x] Migrate helpers to canonical API
- [x] Add surface test + ESLint guard
- [x] Remove compat shim (C4C-2)
- [x] ESLint guard now errors on legacy identifiers
- [x] Surface tests enforce canonical-only keys

### Phase 7: Window Globals Contract Tests (C5A, C5B)

- [x] Init API globals contract gate (`window.LockInAPI`/`window.LockInAuth`)
- [x] UI globals contract gate (`window.LockInUI` sidebar factory)
- [x] Surface tests covering keys + contracts

### Phase 8: Manifest and Init Order Guardrails (C5C, C5D)

- [x] Manifest content_scripts order guardrail
- [x] Locks `content_scripts[0].js` sequence
- [x] Critical ordering assertions
- [x] Content bootstrap init-order guardrail
- [x] Tests late UI/runtime availability
- [x] Tests idempotent bootstrap

### Phase 9: CI Refactor Gate (C5E)

- [x] GitHub Actions workflow: lint → test → type-check → build → verify-build
- [x] Backend npm ci/test in CI
- [x] Root `npm run check` mirrors the gate

## Current Work (Phase B6)

### In Progress

- [ ] Add critical-path unit tests (adapters, services, hooks)
- [ ] Keep vitest fast
- [ ] Reduce `any` lint noise by typing globals/edges
- [ ] Align with DoD guardrail (lint clean)

### Next Steps

1. Finish B6 by adding critical-path unit tests
2. Reduce `any` lint noise (126 warnings currently)
3. Keep refactor gate green and extend coverage

## Definition of Done

### Build & Tooling

- [x] Build outputs are reproducible and documented
- [x] Provider bundles are captured in `CODE_OVERVIEW.md`
- [x] Vite configs are deduplicated and maintainable

### Contract Tests

- [x] `window.LockInContent` surface test
- [x] `window.LockInAPI`/`window.LockInAuth` surface tests
- [x] `window.LockInUI` surface test
- [x] Manifest script order test
- [x] Init order dependency test

### Code Quality

- [ ] Lint clean (0 warnings) - **Current: 126 warnings (all `any` types)**
- [x] Type-check clean (0 errors)
- [x] All tests passing (143 tests)
- [x] Build succeeds
- [x] Verify-build passes

### Documentation

- [x] Architecture docs (`docs/ARCHITECTURE.md`)
- [x] Repository map (`docs/REPO_MAP.md`)
- [x] Status tracking (`docs/STATUS.md`)
- [x] Code overview (`CODE_OVERVIEW.md`)
- [x] Database schema (`DATABASE.MD`)
- [x] Troubleshooting guide (`docs/TRANSCRIPT_TROUBLESHOOTING.md`)

### CI/CD

- [x] GitHub Actions refactor gate
- [x] Local `npm run check` command
- [x] Backend tests in CI

## Lint Warning Reduction Plan

### Quick Fixes (Low Risk, High ROI) - ~30 warnings

- [ ] Error handling types (`api/fetcher.ts`, `core/errors/AppError.ts`)
- [ ] Response types (`api/resources/*`)
- [ ] Storage callbacks (`core/storage/storageInterface.ts`)
- [ ] Test mocks (`core/services/__tests__/notesService.test.ts`)

### Medium Refactors (Needs Care) - ~60 warnings

- [ ] API client generics (`api/fetcher.ts`)
- [ ] Storage interface types (`core/storage/storageInterface.ts`, `extension/src/chromeStorage.ts`)
- [ ] Auth callbacks (`api/auth.ts`)
- [ ] UI hooks (`ui/hooks/*`)

### Danger Zones (Editor/Sidebar/Storage/Runtime) - ~36 warnings

- [ ] Editor types (`ui/extension/notes/NoteEditor.tsx`)
- [ ] Sidebar types (`ui/extension/LockInSidebar.tsx`)
- [ ] Storage types (`extension/src/storage.ts`, `extension/src/chromeStorage.ts`)
- [ ] Runtime types (`extension/src/contentRuntime.ts`)
- [ ] Init API types (`extension/src/initApi.ts`)

## Future Phases

### Phase B7: Test Coverage Expansion

- [ ] Unit tests for all adapters
- [ ] Unit tests for all services
- [ ] Integration tests for critical flows
- [ ] E2E tests for UI flows

### Phase B8: Performance Optimization

- [ ] Bundle size optimization
- [ ] Lazy loading for large modules
- [ ] Code splitting improvements

### Phase B9: Documentation Enhancement

- [ ] API documentation (OpenAPI/Swagger)
- [ ] Architecture diagrams
- [ ] Developer onboarding guide

## Notes

- All codex steps (C1-C5E) are documented in `docs/PROMPT_LOG.md`
- Current status tracked in `docs/STATUS.md`
- Quality gates documented in `docs/QUALITY_AUDIT_2025-12-16.md`
