# Architecture

Purpose: Stable guardrails for how Lock-in is structured. Implementation details and current snapshots live in `CODE_OVERVIEW.md` and `docs/STATUS.md`.

## Surfaces

- **Chrome Extension (`/extension` + `/ui/extension`)**: Primary surface. Uses Chrome APIs only inside extension code. React sidebar UI source in `ui/extension/**`, built bundle in `extension/dist/ui/**`.
- **Backend (`/backend`)**: Node/Express API (Supabase-backed) serving chat, notes, and assets.
- **Future Web App (`/web`, placeholder)**: Will reuse `/core` + `/api`; separate UI stack when built.

## Boundaries (must stay stable)

- **Core/API Chrome-free**: `/core` and `/api` must not depend on `chrome` or extension runtime.
- **Extension-only Chrome usage**: Chrome APIs and extension wiring live in `/extension` and the sidebar source `ui/extension/**`.
- **Integrations**: Adapters in `/integrations/adapters/**` are pure DOM/URL logic; registered via `/integrations/index.ts`.
- **Shared UI**: `/shared/ui` is a low-level kit usable by both extension and future web app.
- **Single widget**: One `<LockInSidebar />` component reused across sites; site differences flow through adapters/context, not multiple widgets.
- **Transcript system boundaries**:
  - **Core providers** (`/core/transcripts/providers/`): Pure TypeScript, no Chrome APIs. Business logic (extraction algorithms).
  - **Fetcher interfaces** (`/core/transcripts/fetchers/`): Pure interfaces, no implementations. Dependency injection pattern.
  - **Extension fetcher** (`/extension/background.js`): Chrome-specific implementation. Handles CORS/credentials via ExtensionFetcher class.
  - **Background script** (`/extension/background.js`): Message routing only. Delegates extraction to providers via fetcher.
  - **UI hooks** (`/ui/extension/transcripts/hooks/`): React state management. Orchestrates detection and extraction.

## Build Outputs vs Source

- **Sources**: `ui/extension/**`, `extension/src/**`, `/core`, `/api`, `/integrations`, `/shared/ui`.
- **Build outputs (do not edit)**: `extension/dist/ui/**` (sidebar bundle built from `ui/extension`), `extension/dist/libs/**` (initApi/contentLibs bundles built from `extension/src`).

## Global Contracts

- `window.LockInUI`: Sidebar bundle (from `extension/dist/ui/index.js`).
- `window.LockInAPI` / `window.LockInAuth`: API/auth clients bundled from `/api` via `extension/src/initApi.ts` -> `extension/dist/libs/initApi.js`.
- `window.LockInContent.*`: Content helpers bundled from `extension/src/contentLibs.ts` -> `extension/dist/libs/contentLibs.js`.

## Where to Look for Details

- **Current snapshot**: `CODE_OVERVIEW.md`.
- **In-flight status**: `docs/STATUS.md`.
- **Refactor/guardrail tracking**: `docs/REFACTOR_PLAN.md` + `docs/PROMPT_LOG.md`.
