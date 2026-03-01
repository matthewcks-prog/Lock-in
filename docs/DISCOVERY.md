# Lock-in Compliance Refactor Discovery

> Updated: 2026-02-28  
> Purpose: prerequisite discovery for compliance + transparency refactor work

## 1) Folder Map

### `extension/` (Chrome glue + MV3 packaging)

- Purpose: browser runtime wrappers, background service worker, popup surface, manifest/permissions.
- Key paths:
  - `extension/manifest.json` (MV3 permissions, host permissions, content scripts)
  - `extension/background/` (routing, handlers, lifecycle, sessions, settings)
  - `extension/content/` + `extension/contentScript-react.js` (page orchestration and sidebar host)
  - `extension/popup.html`, `extension/popup.js`, `extension/popupPrivacy.js` (settings/auth/privacy UI)
  - `extension/src/` (runtime libs: storage, messaging, sentry, init API)
  - `extension/dist/` (built bundles)

### `ui/extension/` (React sidebar feature UI)

- Purpose: sidebar React app features and hooks (chat/notes/tasks/study/transcripts).
- Key paths:
  - `ui/extension/index.tsx` (sidebar entrypoint)
  - `ui/extension/sidebar/` (layout/state/resize + storage-backed UX state)
  - `ui/extension/chat/`, `notes/`, `tasks/`, `study/`, `transcripts/` (feature modules)
  - `ui/hooks/` (cross-feature hooks, including local storage hooks)

### `backend/` (Node.js API server)

- Purpose: authenticated API for chat/notes/tasks/transcripts/feedback/study.
- Key paths:
  - `backend/app.js` (middleware + routes composition)
  - `backend/routes/` (API routes)
  - `backend/controllers/` (HTTP adapters)
  - `backend/services/` (business services)
  - `backend/repositories/` (Supabase data access)
  - `backend/middleware/authMiddleware.js` (Supabase JWT authentication)
  - `backend/observability/` (request logging + Sentry)

### `api/` (shared backend client)

- Purpose: Chrome-agnostic client/auth layer used by extension/UI code.
- Key paths:
  - `api/auth.ts` + `api/auth/*` (session/auth client)
  - `api/client.ts` + `api/resources/*` (resource clients)
  - `api/fetcher/*` (request/execution/retry/parsing)

### `core/` (platform-agnostic domain)

- Purpose: domain models, services, validation/error types, transcript providers, shared utilities.
- Key paths:
  - `core/domain/`, `core/services/`, `core/errors/`, `core/utils/`, `core/transcripts/`

### `integrations/` (site adapters)

- Purpose: page adapter detection/parsing (no chrome APIs, no network calls).
- Key paths:
  - `integrations/adapters/` (Moodle/EdStem/other adapters)
  - `integrations/index.ts` (adapter registry and selection)

## 2) Storage Keys Map

## Notes

- Storage backends currently used:
  - `chrome.storage.sync`
  - `chrome.storage.local`
  - `window.localStorage`
- No IndexedDB usage found (`indexedDB` not referenced in extension/ui/api/core/backend/integrations).
- There is a live key inconsistency that must be preserved/handled during refactor:
  - `lockin_selectedNoteId` (legacy)
  - `lockin_sidebar_selectedNoteId` (current sidebar UI key)

| Key / Pattern                       | Area                                                      | Primary Files                                                                                                | Purpose                                                      | Notes                                                                                   |
| ----------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `lockin_sidebar_isOpen`             | `sync` and `local`                                        | `extension/src/storage.ts`, `extension/content/stateStore.js`, `ui/extension/sidebar/useSidebarState.ts`     | Persist sidebar open/closed state                            | Written through both sync and local paths today (dual behavior).                        |
| `lockin_sidebar_activeTab`          | `sync`                                                    | `extension/src/storage.ts`, `extension/content/stateStore.js`, `ui/extension/sidebar/constants.ts`           | Persist active sidebar tab (`chat/notes/study/tasks`)        | Primary cross-context tab state key.                                                    |
| `lockin_sidebar_activeChatId`       | `sync`                                                    | `ui/extension/chat/types.ts`, `ui/extension/chat/hooks/useChatSessionState.ts`                               | Persist active chat session ID                               | Stored via sidebar storage adapter (`storage.get/set`).                                 |
| `lockin_sidebar_selectedNoteId`     | `sync`                                                    | `ui/extension/sidebar/constants.ts`, `ui/extension/sidebar/useSidebarState.ts`                               | Persist selected note in sidebar                             | Current UI-selected note key.                                                           |
| `lockin_selectedNoteId`             | `sync`                                                    | `extension/src/storage.ts`                                                                                   | Legacy selected note key in extension runtime storage schema | Coexists with `lockin_sidebar_selectedNoteId`.                                          |
| `lockin_sidebar_width`              | `local`                                                   | `ui/extension/sidebar/useResize.ts`, `extension/contentScript-react.js`, `ui/extension/sidebar/constants.ts` | Persist sidebar width in pixels                              | Read at content-script bootstrap for width restoration.                                 |
| `lockinCurrentChatId`               | `local`                                                   | `extension/src/storage.ts`, `extension/content/stateStore.js`                                                | Persist current chat ID in content runtime state store       | Legacy/local runtime chat key.                                                          |
| `lockin_session_<tabId>`            | `local`                                                   | `extension/background/sessions/sessionStore.js`                                                              | Per-tab session snapshot in background                       | Prefix pattern; tab lifecycle cleanup uses this data.                                   |
| `lockin_telemetry_disabled`         | `sync`                                                    | `extension/popupPrivacy.js`, `extension/src/sentry/telemetry.ts`                                             | Telemetry opt-out flag                                       | `true` means telemetry disabled.                                                        |
| `lockinSupabaseSession`             | `sync`                                                    | `api/auth/authClientUtils.ts`, `extension/src/initApi.ts`, `extension/background/auth/authService.js`        | Persist Supabase auth session payload                        | Used as default auth session storage key.                                               |
| `lockin_tasks_viewMode`             | `localStorage` (and optional adapter-backed storage path) | `ui/hooks/useTasksViewMode.ts`                                                                               | Persist tasks view mode (`list`/`board`)                     | `TasksPanel` currently uses localStorage fallback; hook supports adapter when provided. |
| `lockin_transcript_show_timestamps` | `localStorage`                                            | `ui/extension/transcripts/useTranscriptTimestampsPreference.ts`                                              | Persist transcript timestamp visibility preference           | Also listens to `storage` events for cross-tab sync.                                    |
| `lockin_offline_notes_queue`        | `localStorage`                                            | `ui/hooks/noteEditor/constants.ts`, `ui/hooks/noteEditor/offlineQueue.ts`                                    | Queue offline note saves for retry                           | JSON queue with cap/normalization logic.                                                |
| `highlightingEnabled`               | `sync`                                                    | `extension/src/storage.ts`, `extension/content/stateStore.js`                                                | Toggle/remember highlighting behavior                        | Not lockin-prefixed but active in storage schema and state sync.                        |
| `preferredLanguage`                 | `sync`                                                    | `extension/background/settings/settingsStore.js`                                                             | Persist language setting in background settings store        | Not lockin-prefixed but active key in settings path.                                    |

## 3) Permissions Map

### Declared Permissions (`extension/manifest.json`)

- `scripting`
- `storage`
- `contextMenus`
- `tabs`
- `webNavigation`

| Permission      | Files / Features using it                                                                                                                                                                    | Why it exists                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `scripting`     | `extension/background/handlers/seekHandlers.js`, `extension/src/panoptoResolverRuntime.js`                                                                                                   | Uses `chrome.scripting.executeScript` for in-page/frame execution.    |
| `storage`       | `extension/popupPrivacy.js`, `extension/src/storage.ts`, `extension/src/chromeStorage.ts`, `extension/background/sessions/sessionStore.js`, `extension/background/settings/settingsStore.js` | Persists settings/session/UI/runtime state.                           |
| `contextMenus`  | `extension/background/contextMenus.js`                                                                                                                                                       | Creates and handles right-click menu (`Lock-in: Explain`).            |
| `tabs`          | `extension/popup.js`, `extension/src/messaging.ts`, `extension/background/lifecycle.js`                                                                                                      | Query/send messages to tabs, react to tab lifecycle (`onRemoved`).    |
| `webNavigation` | `extension/background/lifecycle.js`                                                                                                                                                          | Clears per-tab session when top-frame origin changes (`onCommitted`). |

### Host Permissions (`extension/manifest.json`)

| Host Pattern Group                                                                          | Features / Files depending on it                                                   |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `http://localhost:3000/*`                                                                   | Dev backend API calls from extension runtime (`window.LockInAPI` usage).           |
| `https://*.supabase.co/*`                                                                   | Supabase auth/token operations (`window.LockInAuth`, auth refresh).                |
| `https://*.panopto.com/*`, `https://*.panopto.aarnet.edu.au/*`, `https://*.aarnet.edu.au/*` | Panopto transcript/media resolution and fetch flows in background/content scripts. |
| `https://echo360*` domains                                                                  | Echo360 transcript/video handling and seek/transcription flows.                    |

### Related Content Script Match Coverage

- Content script is injected only on specific matched hosts from `manifest.json` (Monash Moodle + supported learning/video domains).
- Current popup logic checks active tab on demand (`chrome.tabs.query`) and does not maintain browsing history.

## 4) Existing State (Verified Baseline)

1. Manifest/platform:
   - MV3 confirmed (`manifest_version: 3`).
2. Settings surface:
   - Popup is the active settings/auth/privacy UI (`popup.html` + `popup.js`), no separate options page.
3. Client-side persistence:
   - Mix of `chrome.storage.sync`, `chrome.storage.local`, and `localStorage`.
   - No IndexedDB persistence in current codebase.
4. Backend auth:
   - Backend uses Supabase JWT verification in `backend/middleware/authMiddleware.js`.
   - Main API routes mounted under `/api`.
5. Observability/privacy:
   - Extension Sentry scrubber exists at `extension/src/sentry/privacy.ts`.
   - Scrubber redacts transcript/note/prompt/chat/content-like keys and strips sensitive headers/query params.
6. Current compliance-relevant implementation notes:

- Popup version text is sourced from `chrome.runtime.getManifest().version`.
- Storage key drift exists for selected note key (`lockin_selectedNoteId` vs `lockin_sidebar_selectedNoteId`).
- Compliance docs are present: `PRIVACY.md`, `TERMS.md`, `SECURITY.md`, and docs under `docs/`.

## Discovery Outcome

- Phase 0 prerequisite is complete in doc form.
- Refactor phases in `docs/tracking/REFACTOR_PLAN.md` are feasible with no architectural blockers identified.
- Highest-risk implementation items to sequence carefully:
  - Consent gating across popup/sidebar surfaces without session regression.
  - Storage-key centralization without breaking legacy keys.
  - Permission reduction only after explicit callsite validation.
