# Cross-Layer Contracts

## Public Runtime Surfaces

- `window.LockInAPI`: extension-safe API client methods from `/api`
- `window.LockInAuth`: extension auth helpers
- `window.LockInContent`: content runtime helpers for adapter resolution/state/session glue
- `window.LockInSentry`: extension telemetry API surface

## Shared Domain Contracts

- Error taxonomy in `core/errors/*` and backend `AppError` mapping
- Transcript provider contracts in `core/transcripts/providerRegistry.ts`
- Note/chat domain shapes in `core/domain/*` and `/api/resources/*`

## Transcript Boundary Pattern

- `/core/transcripts/*` owns extraction logic and pure parsing
- `/extension/background/*` owns browser/Chrome/network specifics
- `/backend/services/transcripts/*` owns durable AI transcription and storage workflows

## Stability Rules

- Keep `/core` and `/api` platform-agnostic (no `chrome`, no Express concerns)
- Maintain backward-compatible global runtime keys unless intentionally versioned
- Add boundary tests for any new cross-layer API or message contract
