# Lock-in Architecture Audit (Living)

This file is kept in sync with the codebase. Update it whenever architecture or responsibilities change.

## Current Snapshot

- **Extension UI**: Single React sidebar (`ui/extension/index.tsx` ƒ+' built bundle `extension/ui/index.js`) mounted by the content script. Tabs: chat, notes, settings/history.
- **Content script**: Thin orchestrator (`extension/contentScript-react.js`, ~150 lines) backed by focused helpers under `extension/content/`:
  - `pageContext.js` ƒ?" resolves site adapter and page context (fallback adapter included).
  - `stateStore.js` ƒ?" holds sidebar/selection/mode state + storage sync.
  - `sidebarHost.js` ƒ?" mounts/updates the React bundle and body split classes.
  - `sessionManager.js` ƒ?" tab ID + session restore/clear via messaging.
  - `interactions.js` ƒ?" selection + Escape handlers (Ctrl/Cmd + select to trigger).
- **Shared layers**:
  - `/core/domain` types + `Note` model, `/core/utils/textUtils.ts`.
  - Site adapters in `/integrations/adapters` (Moodle, Edstem) with factory in `/integrations/index.ts`.
  - Chrome-specific wrappers in `/extension/libs` (storage, messaging, logger, init bundle).
  - TypeScript API/auth clients in `/api` bundled for the extension via `extension/libs/initApi.js` (global `LockInAPI`/`LockInAuth`).
- **Backend note assets**:
  - Upload settings in `backend/config.js` (bucket `note-assets` by default, max size, MIME allow-list, MIMEƒ+'extension map).
  - In-memory multer middleware at `backend/middleware/uploadMiddleware.js` enforcing size/type.
  - Asset CRUD via `backend/controllers/noteAssetsController.js` + `backend/repositories/noteAssetsRepository.js` using Supabase Storage paths `<user>/<note>/<asset>.<ext>`.
  - Routes in `backend/routes/noteRoutes.js`: upload/list per note, delete by asset id; all behind Supabase auth.
  - Frontend: Typed `NoteAsset` interface in `/core/domain/types.ts` with camelCase fields; API client methods (`uploadNoteAsset`, `listNoteAssets`, `deleteNoteAsset`) return typed `NoteAsset` objects, mapping backend snake_case to frontend camelCase. Notes sidebar consumes assets via `useNoteAssets` (`ui/hooks/useNoteAssets.ts`) to upload/list/delete and auto-insert Markdown for images.

## Completed/Resolved

- Legacy monolith content script split into dedicated helpers; orchestrator now delegates DOM, state, and session logic instead of keeping everything in one file.
- React sidebar is the single widget in use (legacy draggable widget removed from the manifest; source lives in `ui/extension`, built bundle consumed from `extension/ui/index.js`).
- Domain layer and adapters exist and are Chrome-agnostic, following the adapter pattern for site detection.
- Backend supports generic note assets (images/docs) with validation + Supabase Storage/DB, and the extension UI now uploads/lists/deletes them via `useNoteAssets` with inline Markdown insertion for images.
- Extension now loads the shared `/api` TypeScript client/auth bundle via `libs/initApi.js`; legacy `supabaseAuth.js` and `libs/api.js` were removed.
- Site adapters are bundled into the content script via `extension/content/pageContext.ts` importing `/integrations`; no global `window.getCurrentAdapter` dependency.
- **Scalability & Security (Dec 2024)**: Database indexes applied (`002_performance_indexes.sql`), Row Level Security enabled on all tables (`003_row_level_security.sql`), API client retry with exponential backoff, offline save queue, optimistic locking for concurrent edit detection.

## Outstanding Issues (ordered by impact)

1. **Testing coverage**: No unit tests for content helpers (state store, interactions) or adapters. Add lightweight Jest/Vitest coverage to lock in behaviour and prevent regressions.
2. **Docs/code drift risk**: Checklists and overview docs must stay aligned with the current layout; keep this file, `CODE_OVERVIEW.md`, and AGENTS docs updated after structural changes.
3. **Attachment UX depth**: Attachments render as a basic list (no previews/drag-drop/markdown preview). Plan a richer pass and reuse `useNoteAssets` in the future web app.

## Next Actions

1. Add unit tests for `stateStore`, `interactions`, and adapter parsing; add a smoke test that the sidebar host mounts with mocked `window.LockInUI`.
2. Keep living docs synced: when code moves, update `ARCHITECTURE_AUDIT.md`, `CODE_OVERVIEW.md`, and relevant `AGENTS.md` files in the same change.
3. Evolve attachments UX: previews/drag-drop + mirror the `useNoteAssets` hook in the future web app surfaces.
