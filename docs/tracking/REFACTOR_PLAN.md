# Refactor Plan (Quality Audit 2026-01-23)

Last updated: 2026-01-27

This plan is derived from `docs/archive/QUALITY_AUDIT_2026-01-23.md`, updated to reflect work already completed and the remaining backlog. Phases are ordered by risk reduction, scalability, and architectural alignment. Use the acceptance criteria to verify completion before moving to the next phase.

---

## Phase 0 -- Completed Foundations (DONE)

- [x] **Restore status + doc link integrity**
  - **Problem:** `docs/tracking/STATUS.md` missing; REPO_MAP + troubleshooting links stale.
  - **Outcome:** `docs/tracking/STATUS.md` restored; REPO_MAP updated; legacy troubleshooting marked non-canonical.
  - **Acceptance criteria:** `docs/tracking/STATUS.md` exists; doc links resolve; canonical transcript troubleshooting is under `docs/features/transcripts/`.

- [x] **Remove hardcoded Supabase keys from extension bundle**
  - **Problem:** Extension config embedded anon keys.
  - **Outcome:** Keys moved to build-time env; bundle no longer ships keys.
  - **Acceptance criteria:** No anon keys committed in extension output; dev/prod builds load env-injected values.

- [x] **Add API response validation**
  - **Problem:** API responses were cast to `T` without validation.
  - **Outcome:** Validation/type guards added for critical endpoints.
  - **Acceptance criteria:** Invalid payloads surface as typed errors; tests cover validation.

- [x] **Tighten storage interface typing**
  - **Problem:** Storage interfaces used `any`.
  - **Outcome:** Storage typing moved to generics and explicit change record shapes.
  - **Acceptance criteria:** Storage interfaces compile without `any` usage.

- [x] **Split oversized notes editor modules**
  - **Problem:** Notes editor and hooks exceeded 500-1100 lines.
  - **Outcome:** Notes editor modules decomposed into focused subcomponents/hooks.
  - **Acceptance criteria:** Editor modules are cohesive and independently testable.

- [x] **Split transcript providers/parsers**
  - **Problem:** Providers/parsers blended detection/extraction/parsing.
  - **Outcome:** Providers reduced to composition layers with helper modules.
  - **Acceptance criteria:** Provider files stay small and tests continue to pass.

- [x] **Coverage thresholds + CI enforcement**
  - **Problem:** Coverage could regress silently.
  - **Outcome:** Baseline coverage thresholds added in `vitest.config.ts`; CI coverage step enforced.
  - **Acceptance criteria:** `npm run test:coverage` passes locally; CI fails on coverage regression.

- [x] **Structured logging in backend runtime paths**
  - **Problem:** `console.log` used in runtime services.
  - **Outcome:** `backend/services/transcriptsService.js` and `backend/sentry.js` log via observability logger.
  - **Acceptance criteria:** No direct `console.log`/`console.error` in backend runtime paths.

- [x] **Targeted notes/chat test coverage**
  - **Problem:** Critical UI paths lacked coverage.
  - **Outcome:** Notes list hook tests and chat send empty-guard test added.
  - **Acceptance criteria:** Regression tests cover notes list load/rollback and chat send guard.

- [x] **Align extension JSX runtime in Vite builds**
  - **Problem:** Local builds could emit `jsxDEV` calls while bundling the production runtime, causing `jsxDEV is not a function` crashes.
  - **Outcome:** Vite UI build now forces `NODE_ENV` to match mode and sets `esbuild.jsxDev` by mode to keep JSX transform/runtime aligned.
  - **Acceptance criteria:** Production builds avoid `jsxDEV` calls; dev builds use a matching dev runtime.

- [x] **Harden CI/CD environment setup + deployment verification**
  - **Problem:** `setup_uami.ps1` attempted environment creation without checking GitHub auth/admin access; deployment verification could wait for hours and hang on missing ingress.
  - **Outcome:** Environment creation is idempotent with auth/admin checks and guidance; staging/production verification uses bounded backoff with per-request timeouts and fails fast on missing FQDNs. Runtime identity permissions are scoped to AcrPull + Key Vault secrets get/list only.
  - **Acceptance criteria:** `setup_uami.ps1` skips or creates environments cleanly and enforces runtime least privilege; deployment verification exits within 10 minutes with actionable logs.

- [x] **Parameterize infra for environment split**
  - **Problem:** Bicep and infra scripts hardcoded runtime identity and resource group names, making production separation error-prone.
  - **Outcome:** Added staging/production parameters for resource groups and runtime identity IDs in `infrastructure/main.bicep`; `deploy.ps1` and `validate.ps1` accept overrides while preserving staging defaults.
  - **Acceptance criteria:** Staging deploys unchanged by default; production can be configured via parameters without code edits.

---

## Phase 1 -- Transcript Single Source of Truth (P0)

**Goal:** Eliminate duplicate transcript extraction logic and enforce `/core/transcripts/providers/**` as the sole source of truth.

- [x] **Consolidate extraction flow into core providers**
  - **Problem:** Logic duplicated across `extension/background.js`, `transcriptHandler.ts`, `panoptoResolver.js`, and providers.
  - **Work:**
    - Move any extraction/parsing logic out of extension/background into core providers.
    - Make `background.js` fetcher + routing only.
    - Remove legacy extraction paths in `transcriptHandler.ts` and `panoptoResolver.js` after parity is achieved.
  - **Acceptance criteria:** Extension uses provider registry + fetcher only; no duplicate extraction logic outside `/core/transcripts/providers/**`.

- [x] **Consolidate Panopto helpers**
  - **Problem:** Helpers duplicated across core and extension.
  - **Work:** Route all Panopto URL parsing/extraction via core provider utilities.
  - **Acceptance criteria:** Panopto extraction helpers exist only in core provider modules.

- [x] **Add provider selection + fetcher error tests**
  - **Problem:** Behavior changes can regress silently.
  - **Work:** Add tests that validate provider selection and fetcher error handling.
  - **Acceptance criteria:** Tests prove correct provider selection and resilient fetcher error behavior.

---

## Phase 2 -- Scalability + Reliability (P0/P1)

**Goal:** Remove in-memory cross-request state and make transcript processing durable across instances.

- [x] **Replace in-memory job tracking and rate limiting**
  - **Problem:** `ACTIVE_JOBS`, `UPLOAD_RATE_WINDOWS`, `createIdempotencyStore` are in-memory.
  - **Work:** Persist job state + rate limits in DB/Redis/queue.
  - **Acceptance criteria:** No cross-request state stored in memory; multi-instance safe.

- [x] **Durable transcript storage + job processing**
  - **Problem:** Transcript chunks stored on local filesystem; not durable.
  - **Work:** Use a dedicated Supabase Storage bucket for raw chunks, with very short retention:
    Bucket: transcript-jobs (private).
    For e.g (You can ammend if you have a better way).
    Path: <user_id>/<job_id>/<chunk_index>.bin or <user_id>/<job_id>.webm if you merge chunks server-side.
    Add a column storage_path (or similar) to transcript_jobs if you need a pointer.
    Retention:
    Delete raw blobs immediately after transcript status becomes done + a small grace period (e.g. 24–72h for retry/debug).
    Hard TTL on blobs via a scheduled job (or storage lifecycle): delete anything older than, say, 7 days regardless of status.
    Worker behavior:
    Job status + chunks live in transcript_jobs / transcript_job_chunks (already durable).
    Worker resumes by:
    Looking up job + chunk indices in Supabase.
    Reading missing or all chunks from the storage bucket.
    No dependency on any local filesystem.
    Access control:
    Keep bucket private and allow authenticated users to read their own objects only within a short access window (e.g., 48h).
  - **Acceptance criteria:** Job resume/retry works across restarts; no local-only chunk dependency.

- [x] **Large media handling improvements**
  - **Problem:** Base64 chunking can spike memory/CPU on large files.
  - **Work:** Streamed uploads where possible; enforce chunk sizing and backpressure; add server-side chunk size guard + rate-limit tests.
  - **Acceptance criteria:** Large media uploads do not block UI thread; memory spikes reduced.

- [x] **External transcript cache endpoint + UI hook**
  - **Problem:** External-provider transcripts could be lost between sessions.
  - **Work:** Add `/api/transcripts/cache` service/controller/route and `useTranscriptCache` hook to persist transcripts on feature actions.
  - **Acceptance criteria:** Transcript cache records are upserted when features call the cache hook.

- [x] **Docs consistency**
  - Make sure CODE_OVERVIEW.md,DATABASE.md, AGENTS.md or any other docs are consistent with what is implemented and updated.

- [x] **No feature breaks or regression**
  - Ensure npm run validate still passes. Add more tests if needed.

---

## Phase 3 -- Core Purity + Testability (P1)

**Goal:** Ensure `/core` and `/api` are Node/SSR safe and testable.

- [x] **Remove DOM usage from core**
  - **Problem:** `core/utils/textUtils.ts` uses `document.createElement`.
  - **Work:** Move DOM-dependent logic to UI/extension or provide pure utilities.
  - **Acceptance criteria:** `/core` imports succeed in Node without DOM globals.

- [x] **Eliminate module-load side effects**
  - **Problem:** Listeners/timers/config parse on import make testing hard.
  - **Work:** Refactor to explicit initialization functions with dependency injection.
  - **Acceptance criteria:** Modules are inert on import; behavior only on explicit init.

- [x] **Dependency injection for globals**
  - **Problem:** Hard dependencies on `fetch`, `chrome`, `window`, env at import time.
  - **Work:** Inject fetch/storage/env into modules; add lightweight interfaces.
  - **Acceptance criteria:** Tests can stub dependencies without global hacks.

- [x] **No feature breaks or regression**
  - Ensure npm run validate still passes. Add more tests if needed.

---

## Phase 4 -- Network Reliability + Retry Policy (P1)

**Goal:** Standardize retry/timeout behavior across extension + backend.

- [ ] **Single shared retry/timeout wrapper**
  - **Problem:** Retry logic split between `networkUtils.js` and ad-hoc fetch calls.
  - **Work:** Consolidate to one wrapper used by background/auth/transcripts flows.
  - **Acceptance criteria:** No raw fetches in critical paths without wrapper; consistent timeout + retry policy.

  - Key Advice for your implementation:
    Don't delete mediaFetcher.js logic blindly: I noticed mediaFetcher.js has very specific logic for handling "manual" redirects (Moodle -> CDN) and "same-origin" vs "omit" credentials. A generic wrapper might break this.
    Solution: Your standardized wrapper should accept a config object that allows disabling default behaviors (like followRedirects: false) so specialised callers can still use the retry machinery without losing their custom logic.
    Make it Universal: Ensure
    background.js, transcriptHandler.ts, and your Backend all import the same logic (or equivalent logic).
    If there is a better solution you propose feel free to do it, these were just my observations, but i want my code to really be scalable, reliable and bulletproof.

---

## Phase 5 -- Documentation Consolidation + Structure (P2)

**Goal:** Remove doc duplication, fix placement, and align with docs-only rule.

- [x] **Remove legacy CI/CD auth artifacts**
  - **Outcome:** Removed deprecated SP-based setup scripts and duplicate Azure deployment doc; updated workflows/docs to OIDC managed identity and environment-scoped federated credentials.
  - **Acceptance criteria:** No `AZURE_CREDENTIALS` usage; rollback workflow uses OIDC; Azure deployment docs point to `docs/deployment/AZURE.md`.

- [x] **Resolve docs/achieve typo + archive legacy audits**
  - **Outcome:** Moved `docs/achieve/*` into `docs/archive/` with corrected date naming:
    `QUALITY_AUDIT_2026-01-19.md` and `QUALITY_AUDIT_2026-01-23.md`.
  - **Acceptance criteria:** No canonical references point to `docs/achieve/`.

- [x] **Remove duplicated docs + establish canonical sources**
  - Transcript troubleshooting: canonical docs live under `docs/features/transcripts/`.
  - Deployment: deployment and environment guidance is centralized under `docs/deployment/`.
  - Environment setup: canonical guidance is `docs/deployment/ENVIRONMENTS.md`.

- [x] **Root docs policy decision**
  - **Policy:** Root contains only `AGENTS.md`, `README.md`, and `LICENSE`.
  - **Outcome:** Moved root docs into `docs/reference/` and archived legacy reviews.
  - **Acceptance criteria:** `docs/architecture/ARCHITECTURE.md`, `docs/architecture/REPO_MAP.md`, and `docs/README.md` reflect the chosen policy.

- [x] **Whole repo**
  - Consolidated documentation into canonical locations.
  - Standardized reference docs under `docs/reference/` and archives under `docs/archive/`.
  - Aligned environment files and templates: sanitized `.env` and clarified `.env.example` and `.env.example.local`.
  - Verified doc link integrity locally with `npm run docs:check-links`.

- [x] **CI link integrity check**
  - **Outcome:** Added `scripts/check-doc-links.mjs`, a `docs:check-links` npm script, and a CI step in `.github/workflows/quality-gate.yml`.
  - **Acceptance criteria:** CI fails fast on broken local doc links.

---

## Phase 6 -- Cohesion-Driven Module Splits (P2)

**Goal:** Apply responsibility/cohesion/testability/boundary rules to split high-risk files.

- [ ] **Extension background + transcript handler**
  - Target: `extension/background.js`, `extension/src/transcripts/transcriptHandler.ts`.
  - Split by responsibility (routing vs extraction vs networking), keep background as wiring only.

- [ ] **Backend controllers/services**
  - Target: `backend/controllers/*.js`, `backend/services/*.js`, `backend/openaiClient.js`.
  - Split by workflow boundaries and dependency injection.

- [ ] **Large UI modules**
  - Target: `ui/extension/notes/*`, `ui/extension/chat/*`, `ui/extension/sidebar/*`.
  - Split by cohesive subcomponents/hooks; ensure test coverage for extracted units.

---

## Progress checklist

- [ ] Keep `npm run validate` green after each phase.
- [ ] Update `docs/tracking/PROMPT_LOG.md` for each refactor-prep session.
- [ ] Update `docs/tracking/STATUS.md` when phase focus changes.
