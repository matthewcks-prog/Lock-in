# Refactor Plan (Audit Refresh)

Last updated: 2026-01-18

This plan is based on direct repository inspection. Items are prioritized for stability and scalability and grouped into phased work. Use the acceptance criteria to verify completion before moving on.

---

## Phase 0 — Safety + Correctness (blockers before feature work)

- [x] **Remove hardcoded Supabase anon keys from the extension bundle**
  - **Problem:** `extension/config.js` embeds Supabase anon keys in source, which makes rotation and environment separation brittle.
  - **Files/areas:** `extension/config.js`, build-time env injection (Vite defines), extension build pipeline.
  - **Proposed change:** Move anon keys to build-time environment variables with explicit dev/prod defaults in `.env`/`.env.example`; ensure `config.js` reads from injected constants only.
  - **Acceptance criteria:** No Supabase keys committed in the extension bundle; keys load from build-time env for both dev/prod builds; dev instructions updated.
  - **Risk/migration:** Requires coordinating build pipeline updates and extension deployment scripts.
  - **Confidence:** HIGH.

- [x] **Add runtime validation at API boundaries**
  - **Problem:** API responses are cast to `T` without validation, risking runtime exceptions and hidden contract drift.
  - **Files/areas:** `api/fetcher.ts`, resource clients under `api/resources/`, domain types in `core/domain/`.
  - **Proposed change:** Introduce lightweight schema validation (e.g., zod) for critical responses or implement per-client type guards; return validated types or throw `ValidationError` with context.
  - **Acceptance criteria:** Critical endpoints (notes, chats, assets) have schema validation; invalid payloads are surfaced as `ValidationError` with details.
  - **Risk/migration:** Requires touchpoints across API clients and tests; avoid breaking response shapes.
  - **Confidence:** MED.

- [x] **Tighten storage interface typing**
  - **Problem:** `StorageInterface` and `LocalStorageInterface` use `any`, propagating untyped data across core/extension code.
  - **Files/areas:** `core/storage/storageInterface.ts`, storage wrappers in `extension/` and usage sites.
  - **Proposed change:** Replace `any` with generics and explicit change record types (`Record<string, { oldValue?: unknown; newValue?: unknown }>`); update callers accordingly.
  - **Acceptance criteria:** No `any` in storage interface definitions; storage change callbacks typed; build passes.
  - **Risk/migration:** Might require small refactors in storage consumers.
  - **Confidence:** HIGH.

---

## Phase 1 – Structure + Scalability

- [x] **Decompose oversized UI/editor modules**
  - **Problem:** Several UI files exceed 500–1100 lines, increasing coupling and making regression risk high.
  - **Files/areas:**
    - `ui/extension/notes/NoteEditor.tsx` (~1140 lines)
    - `ui/hooks/useNoteEditor.ts` (~703 lines)
    - `ui/extension/notes/NotesPanel.tsx` (~556 lines)
  - **Proposed change:** Extract focused subcomponents/hooks (toolbar, plugins, autosave, offline queue, conflict resolution, list item components) and keep orchestrators <200–250 lines.
  - **Acceptance criteria:** Each module is split into small, testable units; primary files under 250 lines; no behavior regressions in editor/notes flows.
  - **Risk/migration:** Requires careful refactor around Lexical editor state and hooks.
  - **Confidence:** MED.

- [x] **Split transcript providers and parsers**
  - **Problem:** Transcript providers/parsers are oversized and blend detection, extraction, parsing, and mapping logic.
  - **Files/areas:**
    - `core/transcripts/providers/echo360Provider.ts` (~1074 lines)
    - `core/transcripts/providers/panoptoProvider.ts` (~765 lines)
    - `core/transcripts/parsers/echo360Parser.ts` (~517 lines)
    - `core/transcripts/videoDetection.ts` (~475 lines)
  - **Proposed change:** Separate detection/extraction/parser/helpers per provider; reduce provider files to composition layers.
  - **Acceptance criteria:** Provider files <250 lines, extraction logic isolated, tests continue to pass.
  - **Risk/migration:** Medium refactor cost; ensure provider registry remains unchanged.
  - **Confidence:** MED.

---

## Phase 2 — Quality + Testing + Observability

- [ ] **Introduce coverage targets and enforce them in CI**
  - **Problem:** `vitest.config.ts` does not define coverage thresholds; coverage can regress silently.
  - **Files/areas:** `vitest.config.ts`, test scripts/CI gate.
  - **Proposed change:** Add coverage thresholds by folder (e.g., `ui/hooks` and `ui/extension`), enforce in CI.
  - **Acceptance criteria:** Coverage thresholds configured; CI fails on regression; reporting documented.
  - **Risk/migration:** Might require adding tests to satisfy thresholds.
  - **Confidence:** HIGH.

- [ ] **Expand hook/component tests around notes and chat**
  - **Problem:** Coverage is incomplete for high-traffic UI paths (notes editor, list, chat send/stream).
  - **Files/areas:** `ui/hooks`, `ui/extension/notes`, `ui/extension/chat`.
  - **Proposed change:** Add focused tests for autosave, offline queue, conflict handling, note list filtering, and chat send/stream logic.
  - **Acceptance criteria:** Tests cover critical flows and edge cases; failures reproduce fixed regressions.
  - **Risk/migration:** Moderate; requires robust fixtures/mocks.
  - **Confidence:** MED.

- [ ] **Replace ad-hoc console logging in backend services**
  - **Problem:** `console.log` is used in backend services/sentry setup, reducing structured observability and log hygiene.
  - **Files/areas:** `backend/services/transcriptsService.js`, `backend/sentry.js`.
  - **Proposed change:** Route logging through existing logger/observability utilities with log levels and metadata.
  - **Acceptance criteria:** No direct `console.log` in backend runtime paths; logs emit structured metadata.
  - **Risk/migration:** Low.
  - **Confidence:** HIGH.

---

## Phase 3 — Deferred / Optional (non-blocking)

- [x] **OpenAI provider finalization** (COMPLETED 2026-01-19)
  - **Solution:** Refactored to use dedicated provider factories with proper checks:
    - Chat: OpenAI only (no Azure quota for students)
    - Embeddings: Azure (primary) → OpenAI (fallback) - uses `isAzureEmbeddingsEnabled()`
    - Transcription: Azure Speech (primary) → OpenAI Whisper (fallback)
  - **Files updated:**
    - Created: `backend/services/embeddings.js`
    - Updated: `backend/providers/llmProviderFactory.js` (simplified to OpenAI-only)
    - Updated: `backend/services/transcriptsService.js` (uses transcription.js)
    - Updated: Controllers to use embeddings.js service
    - Removed: Legacy embedText() and transcribeAudioFile() from openaiClient.js
  - **Verification:** All tests pass, build succeeds (`npm run check` ✅)
  - **Documentation:** Updated `docs/AI_SERVICES_ARCHITECTURE.md` with complete architecture
  - **Confidence:** HIGH.

- [ ] **Deployment/infra cleanup** (DEFERRED)
  - **Problem:** Azure deployment scripts and URLs are placeholders pending infra finalization.
  - **Files/areas:** `scripts/`, `backend/README.md`, `extension/config.js`.
  - **Proposed change:** Confirm target infra and finalize URLs/env defaults.
  - **Acceptance criteria:** Deployment scripts and docs are accurate; no TODO placeholders.
  - **Risk/migration:** Depends on infrastructure decisions.
  - **Confidence:** LOW.

---

## Checklist for progress

- [ ] Each phase has an owner and scope defined.
- [ ] Keep `npm run check` green after each task.
- [ ] Update `docs/tracking/PROMPT_LOG.md` for each refactor-prep session.
