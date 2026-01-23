# Status

Last updated: 2026-01-23

## Summary

- Current focus: Phase 2 quality/testing/observability guardrails.
- Build health: `npm run validate` (2026-01-23) - PASS (lint warnings only).
- Primary risks: in-memory job state, core DOM usage, and inconsistent retry/timeout handling.

## Recent changes

- Added baseline coverage thresholds and enforced coverage in CI.
- Expanded notes/chat test coverage (notes list hook + empty-send guard).
- Routed backend transcript/Sentry logs through structured observability logger.
- Consolidated transcript extraction into core providers with provider-registry wiring and added Html5Provider tests.

## Open issues

- In-memory job tracking, rate limiting, and idempotency are not durable across instances.
- `/core` still uses DOM APIs (e.g., `core/utils/textUtils.ts`), breaking Node/SSR safety.
- Documentation duplication and typos remain (e.g., `docs/achieve/` vs `docs/archive/`).
- Retry/timeout policies are inconsistent across extension/background/auth flows.

## Next up

- Move job/rate-limit state to persistent storage (DB/Redis/queue).
- Remove DOM dependencies from `/core` utilities.
- Consolidate overlapping setup docs and archive legacy files.
