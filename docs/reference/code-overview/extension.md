# Extension Runtime Overview

## Entrypoints

- `extension/contentScript-react.js`: thin orchestrator injected into pages
- `extension/background.js`: MV3 service worker entrypoint
- `extension/popup.html` + `extension/popup.js`: settings/auth popup
- `ui/extension/index.tsx`: sidebar React entrypoint (bundled to `extension/dist/ui/index.js`)

## Core Responsibilities

- Site context detection and adapter selection (`integrations/*` via bundled content runtime)
- Sidebar lifecycle/state mounting (`extension/content/*`)
- Background message routing and transcript orchestration (`extension/background/*`)
- API/auth global surfaces via bundled runtime libs:
  - `window.LockInAPI`
  - `window.LockInAuth`
  - `window.LockInContent`
  - `window.LockInSentry`

## Key Boundaries

- No business logic in extension wrappers; delegate to `/core` and `/api`.
- Background script remains orchestration-first; handler logic stays in `extension/background/handlers/*`.
- Content script keeps browser/DOM glue only; no backend internals.

## Feature Hotspots

- Transcript extraction and AI fallback:
  - Providers in `core/transcripts/providers/*`
  - Background fetch/transcription orchestration in `extension/background/transcripts/*`
  - UI hooks/components in `ui/extension/transcripts/*`
- Notes editor/export:
  - Editor UI in `ui/extension/notes/*`
  - Export pipeline in `ui/extension/notes/export/*`
