# ADR-001: Runtime Validation with Zod

**Status**: Accepted  
**Date**: 2026-02-07  
**Authors**: Codex

## Context

Lock-in needs consistent runtime validation at API boundaries and message seams. The codebase
already uses Zod in the backend, but shared layers (api/core/extension) were relying on manual
checks or no validation. This created drift risk between contracts and runtime behavior.

## Decision

Adopt Zod as the standard runtime validation library across shared layers:

- `api/` uses Zod schemas to validate API responses before returning data to callers.
- `extension/` uses Zod-backed message validators for background/content messaging payloads.
- `core/` domain models define Zod schemas to enforce invariants at creation boundaries.

Validation failures are wrapped in `ValidationError` (from `core/errors`) with structured
issue details for debugging.

## Consequences

### Positive

- Consistent, reusable schemas across layers.
- Early detection of contract drift and malformed payloads.
- Improved error telemetry via structured ValidationError details.

### Negative

- Slight increase in bundle size for message schema libraries.
- Additional maintenance effort to keep schemas aligned with backend changes.

### Risks

- Overly strict schemas could reject new fields or edge cases; schemas should use
  passthrough where appropriate and be updated alongside backend changes.
