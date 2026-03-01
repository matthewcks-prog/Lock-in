# Data Retention

> Updated: 2026-02-28

This document summarizes current retention behavior for Lock-in data stores.

## Retention Matrix

| Data Category                    | Storage Location                                              | Default Retention                                      | Notes                                                   |
| -------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| Extension settings/UI state      | `chrome.storage.sync`, `chrome.storage.local`, `localStorage` | Until user clears extension/browser data or uninstalls | Includes sidebar/UI preferences and consent timestamps  |
| Auth session cache               | `chrome.storage.sync` (`lockinSupabaseSession`)               | Until sign-out, session expiry, or storage clear       | Session refresh logic updates token lifetimes           |
| Chats/messages                   | Supabase Postgres                                             | No automatic TTL currently                             | User can delete chats; linked messages cascade          |
| Notes/tasks                      | Supabase Postgres                                             | No automatic TTL currently                             | User-managed lifecycle through app actions              |
| Feedback                         | Supabase Postgres                                             | No automatic TTL currently                             | `feedback.user_id` may be set `NULL` if user deleted    |
| Transcript cache (`transcripts`) | Supabase Postgres                                             | 90 days                                                | `expires_at` default is `now() + interval '90 days'`    |
| Failed transcript jobs           | Supabase Postgres                                             | 7 days                                                 | Cleanup function removes old failed jobs                |
| Transcript job chunk binaries    | Supabase Storage (`transcript-jobs`)                          | Soft retention ~48 hours; hard TTL 7 days              | Reaper cleans completed/expired jobs and chunk metadata |
| Idempotency keys                 | Supabase Postgres                                             | 2 minutes (default)                                    | Short TTL deduplication entries with cleanup            |
| Signed chat asset URLs           | Generated signed URLs                                         | 10 minutes (default)                                   | URL expiry is configurable via env                      |

## Cleanup Paths

- SQL function: `clean_expired_transcripts()` deletes expired transcript rows and old failed jobs.
- Backend reaper: `backend/services/transcripts/transcriptReaper.js` enforces job/chunk retention windows and stale job handling.
- Idempotency cleanup is handled by backend utility flows in `backend/utils/idempotency.js`.

## Important Limits

- Transcript retention values are environment-configurable through backend config variables.
- Some product data classes currently rely on user-initiated deletion rather than automatic TTL.

## Related Docs

- `docs/data-handling.md`
- `docs/reference/DATABASE.md`
- `PRIVACY.md`
