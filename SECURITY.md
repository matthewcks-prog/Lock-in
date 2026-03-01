# Lock-in Security Overview

> Updated: 2026-02-28

This document summarizes implemented security controls and responsible disclosure guidance for Lock-in.

## Security Model

Lock-in uses a layered model:

- Extension layer (`extension/`): Chrome-specific runtime glue and UI surfaces
- Shared/API layers (`core/`, `api/`): typed contracts and validation
- Backend layer (`backend/`): authenticated API, service/repository boundaries, provider integration
- Data layer (Supabase): RLS-enforced per-user access policies

## Key Controls

## 1. Authentication And Access

- Supabase JWT authentication is required on protected backend routes.
- User-scoped data access is enforced via RLS and ownership checks.
- Session tokens are stored in extension-managed storage and refreshed with expiry checks.

## 2. Secret Management

- AI provider keys remain server-side in backend config.
- The extension does not directly hold backend AI keys.
- Runtime config is environment-scoped via build-time variables.

## 3. Data Protection

- Request boundaries are schema-validated.
- Transcript and chat content are protected by data-model ownership and storage controls.
- Transcript upload and processing flows include chunk tracking and cleanup routines.

## 4. Logging And Telemetry Safety

- Extension Sentry scrubber redacts transcript/note/prompt/chat-like fields and strips sensitive headers/query params.
- Backend Sentry sanitization removes request bodies, query strings, sensitive headers, and user identifiers.
- Telemetry is user-toggleable in popup settings (`lockin_telemetry_disabled`).

## 5. Extension Permission Posture

Manifest permissions are documented with file-level callsites in `docs/permissions.md`.

## Security Testing And Validation

Before shipping changes:

- Run `npm run validate`
- Run `npm run lint:deps`
- Run `npm run test:coverage`

## Responsible Disclosure

For non-sensitive bugs, use GitHub issues. For sensitive security vulnerabilities, use private GitHub security reporting for this repository when available.

Include:

- Reproduction steps
- Impact assessment
- Proposed remediation (if known)

## Hardening Roadmap

Planned follow-up work includes:

- Further permission minimization after callsite audit completion
- Additional logging redaction and safety checks
- Account-level export/delete controls (tracked in `docs/tracking/REFACTOR_PLAN.md`)
