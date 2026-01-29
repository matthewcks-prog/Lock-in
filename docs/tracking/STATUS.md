# Status

Last updated: 2026-01-25

## Summary

- Current focus: Phase 4 network reliability + retry policy alignment.
- Build health: `npm run validate` (2026-01-25) - PASS (lint warnings only).
- Primary risks: inconsistent retry/timeout handling, doc duplication, and storage lifecycle misconfiguration.

## Recent changes

- Replaced DOM-based HTML escaping in `core/utils/textUtils.ts` with a pure escape routine for Node/SSR safety.
- Added injected fetch support to API/auth clients and updated initApi/test wiring to avoid global fetch coupling.
- Added optional logger config injection and moved logger instantiation into explicit init paths.
- Formatted `backend/controllers/transcriptsController.js` and re-verified `npm run validate`.

## Open issues

- Documentation duplication and typos remain (e.g., `docs/achieve/` vs `docs/archive/`).
- Retry/timeout policies are inconsistent across extension/background/auth flows.
- Supabase storage bucket `transcript-jobs` policies/lifecycle need to be applied in the console.

## Next up

- Standardize retry/timeout policies across extension/background/auth flows.
- Consolidate overlapping setup docs and archive legacy files.
