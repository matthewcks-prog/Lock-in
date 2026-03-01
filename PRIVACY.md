# Lock-in Privacy Policy

> Effective date: 2026-02-28

This policy explains what data Lock-in handles, how it is used, and where it is stored for the Chrome extension, shared API client, and backend.

## Scope

This policy applies to:

- The Chrome extension runtime in `extension/`
- The sidebar UI bundle in `ui/extension/`
- The backend API in `backend/`
- Project documentation and operational tooling in `docs/`

## Data We Collect

Lock-in handles the following categories of data:

- Account and auth data: Supabase user ID, email, and auth session tokens
- Study content: selected text, chat messages, notes, tasks, transcript requests, and optional feedback
- Attachment data: files uploaded to note/chat flows (images, PDF/text/code files)
- Technical metadata: extension version, runtime errors, coarse request context, and feature preferences

## AI Provider Disclosure

Current provider stack is documented in `docs/data-handling.md` and backed by runtime code in `backend/providers/*`.

### What Is Sent To AI Providers

- Chat prompts and relevant chat history needed to generate a response
- User-provided page context such as `pageUrl` and `courseCode` when included in the request flow
- Attachment content included in a prompt:
  - Image attachments (base64 image payloads)
  - Extracted text from supported documents/code files
- Audio segments for transcription jobs and optional language hints

### What Is Not Sent To AI Providers

- Browser cookies and auth headers from extension/backend request contexts
- Chrome extension storage keys/state that are unrelated to the active AI request
- Full browsing history; popup host checks run on the active tab only when the popup opens
- Raw telemetry payloads from Sentry scrubbing paths that redact transcript/note/prompt/chat-like fields

## Where Data Is Stored

- Browser-side settings/state:
  - `chrome.storage.sync`
  - `chrome.storage.local`
  - `window.localStorage` (feature-specific UI preferences)
- Backend data and files:
  - Supabase Postgres tables (RLS-protected per user)
  - Supabase Storage buckets for note/chat assets and transcript job chunks

Detailed storage and flow mapping is in:

- `docs/data-handling.md`
- `docs/permissions.md`
- `docs/retention.md`

## Diagnostics And Error Reporting

- Anonymous error reporting can be toggled in popup settings.
- Extension and backend Sentry scrubbing removes or redacts sensitive request fields, URLs, headers, and user identifiers before send.

## Data Retention

Retention windows vary by data type. See `docs/retention.md` for current defaults, including transcript TTL and cleanup behavior.

## User Controls

- You can sign out from the popup.
- You can delete supported records (for example chats/notes/tasks) through current app flows.
- Account-level export and delete-account self-service endpoints are planned in later refactor phases.

## Policy Changes

This file is versioned in Git. Material changes should update the effective date and corresponding docs in `docs/`.
