# Quality Audit — 2026-19-01

## Executive summary (top 5 risks)

1. **Hardcoded Supabase anon keys in the extension bundle**
   - **Evidence:** `extension/config.js` embeds production + development anon keys in source.
   - **Impact:** Key rotation requires code changes; increases risk of accidental leakage and environment mismatch.
   - **Recommended fix:** Move keys to build-time environment variables and ensure the extension bundle never ships secrets.
   - **Confidence:** HIGH.

2. **Oversized UI/editor modules and transcript providers**
   - **Evidence:** Large files in `ui/extension/notes` and `core/transcripts/providers` exceed 500–1100 lines.
   - **Impact:** High coupling, difficult code review, higher regression risk.
   - **Recommended fix:** Split into focused submodules (toolbar/plugins/hooks, detection/extraction/parser helpers).
   - **Confidence:** MED.

3. **API response validation is missing**
   - **Evidence:** `api/fetcher.ts` parses JSON and casts directly to `T` without schema validation.
   - **Impact:** Runtime errors on backend contract drift; invalid data can silently propagate.
   - **Recommended fix:** Add schema validation for critical endpoints or per-client type guards.
   - **Confidence:** MED.

4. **Storage interface uses `any`**
   - **Evidence:** `core/storage/storageInterface.ts` uses `any` in `get/set/onChanged` signatures.
   - **Impact:** Type safety erosion across core and extension storage consumers.
   - **Recommended fix:** Replace `any` with generics and explicit change record types.
   - **Confidence:** HIGH.

5. **Observability uses ad-hoc console logging**
   - **Evidence:** `backend/services/transcriptsService.js` and `backend/sentry.js` use `console.log` directly.
   - **Impact:** Unstructured logs, noisy output, reduced ability to filter/trace in production.
   - **Recommended fix:** Route logs through a structured logger with levels and metadata.
   - **Confidence:** HIGH.

---

## Local changes / working tree

- **Working tree status:** Clean at start of audit (no local diffs detected).
- **Focus applied:** Verified existing refactor plan and current source files before updating documentation.

---

## Repo map (observed)

- **`extension/`** — Chrome extension runtime (manifest, background, content orchestration, popup), plus build outputs under `extension/dist/`.
- **`ui/`** — React UI source for the extension sidebar (extension-specific).
- **`core/`** — Domain logic, transcript providers, shared utilities (Chrome-free).
- **`api/`** — API client, auth, fetcher.
- **`integrations/`** — Site adapters.
- **`backend/`** — API server, controllers, services, observability, migrations.
- **`shared/`** — Optional shared UI and utilities.
- **`docs/`** — Architecture, tracking, testing, and feature documentation.
- **`scripts/` / `tools/` / `build/`** — Build and tooling utilities.

---

## Current issues (prioritized)

### P0 — Safety/Correctness

- **Hardcoded Supabase anon keys in extension config**
  - **Evidence:** `extension/config.js` contains prod + dev anon keys.
  - **Impact:** Security/rotation risk; environment mismatch possible.
  - **Fix:** Move to build-time env variables; remove inline keys.
  - **Confidence:** HIGH.

- **Missing runtime validation for API responses**
  - **Evidence:** `api/fetcher.ts` returns `data as T` without schema checks.
  - **Impact:** Runtime exceptions and silent contract drift.
  - **Fix:** Introduce schema validation (zod or type guards) for critical endpoints.
  - **Confidence:** MED.

- **Storage interfaces use `any`**
  - **Evidence:** `core/storage/storageInterface.ts` uses `any` in `get/set/onChanged`.
  - **Impact:** Type safety and refactor fragility.
  - **Fix:** Replace with generics and explicit change record shapes.
  - **Confidence:** HIGH.

### P1 — Structure/Scalability

- **Oversized UI/editor files**
  - **Evidence:** `ui/extension/notes/NoteEditor.tsx` (~1140 lines), `ui/hooks/useNoteEditor.ts` (~703 lines), `ui/extension/notes/NotesPanel.tsx` (~556 lines).
  - **Impact:** Harder to test and maintain; risk of regressions.
  - **Fix:** Extract toolbar/plugins/autosave/offline/conflict logic into separate modules.
  - **Confidence:** MED.

- **Oversized transcript providers/parsers**
  - **Evidence:** `core/transcripts/providers/echo360Provider.ts` (~1074 lines), `core/transcripts/providers/panoptoProvider.ts` (~765 lines), `core/transcripts/parsers/echo360Parser.ts` (~517 lines), `core/transcripts/videoDetection.ts` (~475 lines).
  - **Impact:** Hard to reason about provider behavior; hard to test independently.
  - **Fix:** Split detection/extraction/parsing helpers and keep providers as composition layers.
  - **Confidence:** MED.

### P2 — Quality/Testing/Observability

- **No coverage thresholds configured**
  - **Evidence:** `vitest.config.ts` defines tests but no `coverage` thresholds.
  - **Impact:** Coverage regressions can slip in silently.
  - **Fix:** Add coverage thresholds and enforce in CI.
  - **Confidence:** HIGH.

- **Ad-hoc console logging in backend**
  - **Evidence:** `backend/services/transcriptsService.js`, `backend/sentry.js` use `console.log`.
  - **Impact:** Harder to filter/trace logs in production.
  - **Fix:** Switch to structured logger utilities.
  - **Confidence:** HIGH.

---

## Suggested target architecture (pragmatic)

- **API boundary validation:** Lightweight validation for critical API responses to prevent contract drift.
- **Modular UI/editor:** Break monolithic UI/editor files into subcomponents and hooks, with explicit responsibilities.
- **Provider composition:** Transcript providers should assemble detection/extraction/parser helpers and keep provider modules small.
- **Strict typing at boundaries:** Storage interfaces and API clients should use explicit generics and `unknown` instead of `any`.
- **Structured logging:** Centralized logger with level control and JSON metadata in backend services.

---

## “Do not refactor yet” list (DEFERRED)

- **OpenAI provider plumbing finalization** — dependent on deployment and credential availability.
- **Deployment/infra cleanup** — finalize Azure URLs and deployment scripts once infra targets are locked.
- **Major dependency upgrades** — Lexical/Tailwind/react type upgrades should be scheduled after core refactors.

---

## Checklist to keep `npm run check` green

`npm run check` currently runs:

- `npm run lint` (eslint)
- `npm run test` (vitest run)
- `npm run type-check` (tsc --noEmit)
- `npm run build` (vite + bundled libraries)

**Recommended discipline:**

- Run `npm run check` after each phase or major change.
- If a refactor splits files, update imports + tests in the same commit.
- Keep build-time env variables documented and aligned with `.env.example`.
- Avoid introducing `any` in new code paths; prefer `unknown` with type guards.

