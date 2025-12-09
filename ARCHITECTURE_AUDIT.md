# Lock-in Architecture Audit (Living)

This file is kept in sync with the codebase. Update it whenever architecture or responsibilities change.

## Current Snapshot

- **Extension UI**: Single React sidebar (`ui/extension/index.tsx` → built bundle `extension/ui/index.js`) mounted by the content script. Tabs: chat, notes, settings/history.
- **Content script**: Thin orchestrator (`extension/contentScript-react.js`, ~150 lines) backed by focused helpers under `extension/content/`:
  - `pageContext.js` – resolves site adapter and page context (fallback adapter included).
  - `stateStore.js` – holds sidebar/selection/mode state + storage sync.
  - `sidebarHost.js` – mounts/updates the React bundle and body split classes.
  - `sessionManager.js` – tab ID + session restore/clear via messaging.
  - `interactions.js` – selection + Escape handlers (Ctrl/Cmd + select to trigger).
- **Shared layers**:
  - `/core/domain` types + `Note` model, `/core/utils/textUtils.ts`.
  - Site adapters in `/integrations/adapters` (Moodle, Edstem) with factory in `/integrations/index.ts`.
  - Chrome-specific wrappers in `/extension/libs` (storage, messaging, logger, legacy api/auth).
  - TypeScript API/auth clients in `/api` (not yet wired into the runtime bundle).

## Completed/Resolved

- Legacy monolith content script split into dedicated helpers; orchestrator now delegates DOM, state, and session logic instead of keeping everything in one file.
- React sidebar is the single widget in use (legacy draggable widget removed from the manifest; source lives in `ui/extension`, built bundle consumed from `extension/ui/index.js`).
- Domain layer and adapters exist and are Chrome-agnostic, following the adapter pattern for site detection.

## Outstanding Issues (ordered by impact)

1. **API/client duplication**: The extension still uses `extension/libs/api.js` + `supabaseAuth.js`; the shared `/api` TypeScript clients (`api/client.ts`, `api/auth.ts`, `extension/libs/initApi.ts`) are not yet the source of truth. Consolidate to one client to avoid drift.
2. **Adapter bundling gap**: The content script expects `window.getCurrentAdapter`, but adapters are not bundled into the content scripts yet. Build/export the adapter registry for production instead of relying on the generic fallback.
3. **Testing coverage**: No unit tests for content helpers (state store, interactions) or adapters. Add lightweight Jest/Vitest coverage to lock in behaviour and prevent regressions.
4. **Docs/code drift risk**: Checklists and overview docs must stay aligned with the current layout; keep this file, `CODE_OVERVIEW.md`, and AGENTS docs updated after structural changes.

## Next Actions

1. Wire the `/api` clients into the extension via `extension/libs/initApi.ts`, remove/alias legacy `api.js` and `supabaseAuth.js`, and update manifests to load the compiled bundle.
2. Bundle/register adapters for the content script (export `getCurrentAdapter` from a compiled integrations bundle) and drop the in-script fallback once verified.
3. Add unit tests for `stateStore`, `interactions`, and adapter parsing; add a smoke test that the sidebar host mounts with mocked `window.LockInUI`.
4. Keep living docs synced: when code moves, update `ARCHITECTURE_AUDIT.md`, `CODE_OVERVIEW.md`, and relevant `AGENTS.md` files in the same change.
