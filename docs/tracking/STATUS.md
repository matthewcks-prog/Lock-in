# Status (Updated 2026-02-07)

## Completed in this pass

- Added Zod-based runtime validation for API responses, with schemas split into focused modules.
- Added extension message schema bundle and wired background validators to use it (fallback preserved).
- Added ADR-001 documenting runtime validation with Zod.
- Added core timeout utility + TimeoutError and enforced timeboxing in API fetcher.
- Removed remaining explicit `any` usage in extension Sentry + feedback UI.
- Added domain invariant validation for `Note` and normalized note types/versions.
- Added LLM provider circuit breaker and standardized provider-chain errors on AppError (deadline/parse/rate limit).
- Cleaned backend migration checklist docs (removed duplicate legacy copy).
- Added core network retry wrapper and aligned backend/extension retry utilities with it.
- Added circuit breakers for Supabase fetch and transcription providers (fallback-aware).
- Split API fetcher request execution into a dedicated module to keep `/api` files under line limits.

## Checks Run

- `npm run type-check` (pass)
- `node --test backend/providers/llm/__tests__/providerChain.test.js backend/providers/llm/__tests__/contracts.test.js backend/providers/llm/__tests__/circuitBreaker.test.js` (pass)
- `npm run lint:deps` (pass)
- `npm run validate` (pass)

## Remaining Work (By Phase)

### Phase 1: Guardrail Hardening

- Verify `npm run lint:deps` and `npm run validate` are green after recent changes.

### Phase 2: Runtime Validation

- Add Zod validation for:
  - Chrome storage reads/writes (settings/session payloads).
  - External API responses (Supabase client responses).
  - Any remaining backend/controller boundary responses not covered by API client.

### Phase 3: Lint Warning Resolution

- Systematically clear lint warnings by folder, then upgrade remaining warnings to errors.

### Phase 4: Module Splits

- Audit remaining oversized files in `/ui` and split to meet line limits.

### Phase 5: Reliability Patterns

- Add circuit breaker coverage for remaining external APIs (e.g., embeddings).
- Ensure all async operations (backend + extension) use `withTimeout()`.
- Remove any remaining hidden shared state (module-level mutable state).

### Phase 6: Test Coverage Boost

- Raise Vitest coverage thresholds to the target levels.
- Add contract tests for API client ↔ backend and extension message schemas.
- Add regression test template and coverage for recent bug fixes.
- Optional: mutation testing setup (Stryker) for core/domain.

### Phase 7: Type Safety Hardening

- Audit JS (backend/extension) for unsafe patterns and tighten typings where possible.

## Notes

- New build target: `npm run build:messageSchemas` (included in `build:libs`).
