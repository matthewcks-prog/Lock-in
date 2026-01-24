# Status

Last updated: 2026-01-25

## Summary

- Current focus: Phase 3 core purity + testability prep.
- Build health: `npm run validate` (2026-01-23) - PASS (lint warnings only).
- Primary risks: core DOM usage, inconsistent retry/timeout handling, and storage lifecycle misconfiguration.

## Recent changes

- Added transcript cache service + API endpoint + UI hook to persist extracted transcripts.
- Persisted transcript job tracking and upload rate limits in Supabase with storage-backed chunks.
- Added heartbeat-based transcript processing recovery and chunk cleanup workflow.
- Switched content-script transcript chunk messaging to binary payloads with backpressure.
- Added Supabase Storage RLS policy for transcript job chunk access window (48h) in migration.

## Open issues

- `/core` still uses DOM APIs (e.g., `core/utils/textUtils.ts`), breaking Node/SSR safety.
- Documentation duplication and typos remain (e.g., `docs/achieve/` vs `docs/archive/`).
- Retry/timeout policies are inconsistent across extension/background/auth flows.
- Supabase storage bucket `transcript-jobs` policies/lifecycle need to be applied in the console.

## Next up

- Remove DOM dependencies from `/core` utilities.
- Consolidate overlapping setup docs and archive legacy files.
- Standardize retry/timeout policies across extension/background/auth flows.
