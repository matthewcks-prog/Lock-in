# Data Handling

> Updated: 2026-02-28

This document describes what Lock-in collects, where it flows, and how third-party providers are used.

## System Data Flow

## 1. Capture (Extension/UI)

- User-triggered inputs:
  - Highlighted selections
  - Chat prompts
  - Notes/tasks edits
  - Optional file uploads
- Local state is stored in `chrome.storage.sync`, `chrome.storage.local`, and selected `localStorage` keys.

## 2. API Processing (Backend)

- Requests are validated at route boundaries before service execution.
- Protected endpoints require authenticated user context.
- Services persist user-owned records in Supabase with repository-only DB access patterns.

## 3. Provider Processing (AI Services)

Provider usage is runtime-configurable with fallback chains:

- Chat completions: Gemini -> Groq -> OpenAI
- Embeddings: Azure OpenAI -> OpenAI
- Transcription: Azure Speech -> OpenAI Whisper

## 4. Persistence

- Structured records in Supabase Postgres:
  - chats/messages
  - notes/tasks
  - feedback
  - transcript metadata/jobs
- Files in Supabase Storage:
  - note assets
  - chat assets
  - transcript job chunks

## AI Provider Disclosure

## What Is Sent To AI Providers

- Prompt text required to answer a user request (selection, question, and relevant history)
- Attachment payloads explicitly included by the user for analysis:
  - Images (as data URLs/base64 in multimodal message paths)
  - Extracted text from supported text/PDF/code attachments
- Transcription audio segments and language hints during transcript jobs

## What Is Not Sent To AI Providers

- Browser cookies and auth headers from extension/backend contexts
- Background browsing history (no continuous history capture)
- Extension settings keys unrelated to the active request
- Redacted telemetry fields filtered by Sentry scrubbing logic

## Non-AI Third Parties

- Supabase: authentication, database, and storage
- Sentry (optional): error telemetry with privacy scrubbing and user opt-out toggle

## Data Classification (Operational)

- Account data: auth identifiers and session metadata
- Study data: prompts, notes, transcripts, tasks, and feedback
- Technical data: runtime diagnostics and operational metadata

## References

- `PRIVACY.md`
- `SECURITY.md`
- `docs/permissions.md`
- `docs/retention.md`
- `docs/reference/DATABASE.md`
