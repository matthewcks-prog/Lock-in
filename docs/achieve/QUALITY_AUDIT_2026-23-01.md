Critical Issues

Transcript extraction logic is duplicated across background.js, transcriptHandler.ts, panoptoResolver.js, and core/transcripts/providers/\*\* (plus transcriptProviders.js), violating ARCHITECTURE.md and AGENTS.md; this is a major source‑of‑truth conflict.
STATUS.md is referenced by AGENTS.md, ARCHITECTURE.md, README.md, REPO_MAP.md, and transcript troubleshooting docs, but the file is missing; the documentation contract is broken.
Backend transcript processing relies on in‑memory state (transcriptsService.js ACTIVE_JOBS, transcriptsController.js UPLOAD_RATE_WINDOWS, idempotency.js); this won’t scale across instances and risks lost/duplicated jobs.
textUtils.ts uses document.createElement, breaking the “core is Node‑compatible” rule and making /core unsafe to import outside a browser.
Organization Review (misplaced .md)

CHANGELOG.md → move to CHANGELOG.md (or CHANGELOG.md) and update references.
CODE_OVERVIEW.md → move to CODE_OVERVIEW.md and update references in ARCHITECTURE.md + REPO_MAP.md.
CONTRIBUTING.md → move to CONTRIBUTING.md.
DATABASE.MD → move to DATABASE.md and normalize filename case.
WORKFLOW_REVIEW_SUMMARY.md → move to WORKFLOW_REVIEW_SUMMARY.md or WORKFLOW_REVIEW_SUMMARY_2026-01-22.md.
docs/achieve/ looks like a typo; consolidate into docs/archive/.
Refactoring Candidates (files >250 lines)

Use these instead of line count:

1. Responsibility / cohesion test

Split if the file answers “yes” to any:

Does it contain multiple “mini-modules” that could stand alone?

Does it mix domain logic + I/O + wiring + UI/state?

Does it have multiple unrelated exports that don’t share the same reason to change?

2. Change frequency & conflict test

Split if:

multiple people regularly touch different areas of the file

PRs often include unrelated edits “because it’s all in here”

3. Testability test (especially for your repo)

You already identified globals + module-load side effects (chrome/window/self). Those are the real problem, not the line count.
Split if:

code executes on import (listeners registered, timers started, config parsed)

dependencies can’t be injected (fetch, storage, fs, process env, chrome)

4. Boundary rule fit

Your own architecture says “source of truth” belongs in specific places (e.g., transcript extraction in core/transcripts/providers/\*\*). A file gets too big when it violates boundaries.

CODE_OVERVIEW

Practical guidance for your list

background.js (1803): treat size as a symptom. The real fix is to make it mostly routing + wiring and move logic into modules behind interfaces (which also improves testing).

controllers/services (600–400): it’s acceptable to be larger if they are composed of smaller functions and delegate to helpers/repositories. Split when they start accumulating unrelated endpoints/workflows.

providers/resolvers/transcriptHandler: here, size matters more because you’re fighting multiple sources of truth. Splitting and consolidating is warranted even if the result is still >250 in one file.

A good rule of thumb you can adopt

< 300 lines: usually fine if cohesive.

300–600: acceptable when it’s a “composition” module (controller wiring, registry) and is internally clean.

> 600: almost always worth splitting unless it’s generated code or a very stable, well-tested module.

Regardless of size: split immediately when it violates architecture boundaries or becomes hard to test.

Recommendation

Keep “250 lines” as a lint-like warning, not a goal. For refactoring priority, rank files by:

boundary violations / duplicated source of truth

testability blockers (globals + side effects)

then size

background.js (1803)
panoptoResolver.js (868)
lockinController.js (664)
notesController.js (605)
sentry.ts (545)
transcriptHandler.ts (530)
panoptoProvider.test.ts (528)
openaiClient.js (509)
stateStore.test.js (477)
ImageNode.tsx (453)
echo360Provider.test.ts (444)
transcriptsService.js (433)
transcriptsController.js (432)
useChat.ts (426)
NoteToolbar.tsx (396)
useNoteEditorPersistence.ts (390)
notesService.ts (380)
popup.js (357)
setup-ci-cd.ps1 (345)
notesService.test.ts (341)
config.js (340)
index.js (337)
fetcher.ts (330)
provider.ts (318)
ChatSection.tsx (312)
auth.ts (307)
syllabusParser.ts (302)
mediaFetcher.js (299)
FeedbackModal.tsx (293)
setup-env-local.ps1 (288)
chatHistory.test.tsx (285)
useAiTranscription.ts (281)
azure-setup.ps1 (278)
useVideoDetection.ts (277)
azureEmbeddingsClient.js (272)
notesRepository.js (264)
transcriptsController.test.js (262)
useSendMessage.ts (252)
Deletion/Merge Candidates (outdated/duplicate)

TRANSCRIPT_TROUBLESHOOTING.md (duplicate of TROUBLESHOOTING.md).
AZURE_DEPLOYMENT.md (superseded by AZURE.md per AUDIT_SUMMARY.md).
ENVIRONMENT_SETUP.md, ENV_QUICK_REFERENCE.md, ENV_SECURITY_FIXES.md (overlap with ENVIRONMENTS.md).
QUALITY_AUDIT_2026-19-01.md (orphaned; move to docs/archive/ with corrected date naming).
WORKFLOW_REVIEW_SUMMARY.md (overlaps with AUDIT_SUMMARY.md; move to docs/archive).
panoptoResolver.js and legacy transcript logic in background.js (remove after consolidating providers).
Inconsistency Log (Source of Truth)

Transcript extraction logic is split between core/transcripts/providers/**, background.js, and transcriptHandler.ts; source of truth should be core/transcripts/providers/** with ExtensionFetcher in background routing only.
Panopto helpers are duplicated in core/transcripts/providers/panopto/\*, panoptoResolver.js, and transcriptHandler.ts; source of truth should be core panopto utils.
Retry/timeout logic is split between networkUtils.js and raw fetch calls in background.js and transcriptHandler.ts; source of truth should be a single shared retry wrapper.
STATUS.md is referenced widely but missing; either restore it or update all references to the new status location.
Transcript troubleshooting docs exist in two places; source of truth should live under docs/features/transcripts/.
Deployment docs are split between docs/deployment/ and docs/setup/; source of truth should be docs/deployment/ (per AUDIT_SUMMARY.md).
REPO_MAP.md lists files and paths that no longer exist (STATUS.md, SMOKE_CHECKLIST.md, QUALITY_AUDIT_2025-12-16.md path, TRANSCRIPT_TROUBLESHOOTING.md); update to match current structure.
AGENTS.md references AGENTS.\_LIVINGDOC.md, which does not exist; remove the reference or add the file.
Root docs (CODE_OVERVIEW.md, DATABASE.MD) are referenced as canonical in architecture docs but violate the “docs-only” placement rule; choose a single policy and update references accordingly.
Setup scripts overlap (setup.ps1, setup_oidc.ps1, setup_uami.ps1, setup_umi_oidc.ps1, azure-setup.ps1, deploy.ps1); use deploy.ps1 + validate.ps1 as canonical for deployment, and document the others as one‑time bootstrap or legacy.
Scalability & Reliability Risks

In‑memory job tracking and rate limiting (ACTIVE_JOBS, UPLOAD_RATE_WINDOWS, createIdempotencyStore) will diverge across instances and resets; move to persistent storage (DB/Redis/queue).
Transcript chunk storage on local filesystem (TRANSCRIPTION_TEMP_DIR) is not durable across instance restarts and won’t work with scale‑out; use object storage (Azure Blob/S3) or a dedicated job processor.
Several critical fetches lack retry/timeout handling (background.js fetchJsonWithAuth, transcriptHandler.ts, mediaFetcher.js, auth.ts); consolidate under a shared retry/timeout policy.
Large media flows use base64 chunking in content scripts; this can spike memory and UI thread time on big files.
Testability Risk Spots

background.js, panoptoResolver.js, and networkUtils.js rely on globals (chrome, window, self) and execute side effects at module load; hard to unit test.
transcriptsService.js uses filesystem and child processes directly; no abstraction layer for mocking.
openaiClient.js mixes prompt assembly, validation, and I/O; minimal dependency injection.
config.js centralizes env parsing at import time, making isolated testing harder.
Proposed AGENTS.md Updates (not applied)

Add a strict “single transcript source of truth” rule: extraction algorithms live only in core/transcripts/providers/\*\*; background is routing + fetcher only.
Add a “no in‑memory state for cross‑request workflows” rule (jobs, rate limits, idempotency must be persisted in DB/Redis).
Add a “no DOM globals in /core” rule (use pure utils or move to /ui//extension).
Add a “network calls must use shared retry/timeout wrapper” rule for extension + api.
Add a “docs placement + link integrity” rule (only README/AGENTS/LICENSE at root; all other docs under docs/, keep STATUS.md present and updated).
Best Practice Recommendations

Consolidate transcript flow to core providers + fetcher interface only; delete legacy extraction paths and add tests for provider selection and fetcher error cases.
Introduce persistent storage/queue for transcription jobs and rate limiting (Redis + worker or DB‑backed job table).
Standardize retry/timeout handling across extension/background/auth flows; add a small shared fetch wrapper with unit tests.
Clean up docs: move root docs into docs/, restore or replace STATUS.md, and update REPO_MAP.md to reflect reality; add a CI check for broken doc links.
Break up large files (especially background.js, \*.js, openaiClient.js) into smaller modules with focused responsibilities.
