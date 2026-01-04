# Lock-in Code Overview

This is a living overview of the current codebase. Update it whenever files move or responsibilities change.

## High-Level Architecture

- **Chrome Extension** (`extension/`) runs in the browser, renders the Lock-in sidebar UI, and communicates with the backend.
- **Backend API** (`backend/`) is a Node.js/Express server that handles auth, rate limiting, and chat storage backed by Supabase.

**Data Flow:**

1. User highlights text (Ctrl/Cmd + select) -> extension captures selection.
2. Extension builds payload (mode, text, user/session info, chat state).
3. Request goes to backend (`/api/lockin` and related chat endpoints).
4. Backend validates/authenticates, calls OpenAI, stores/loads chat, returns JSON.
5. Extension updates sidebar with response and chat history.

## Extension Structure (`extension/`)

### Core Files

- **`manifest.json`**

  - Chrome Extension manifest (permissions, content scripts, background service worker, icons).

- **`config.js`**

  - Exposes `window.LOCKIN_CONFIG` (backend URL, Supabase URL, Supabase anon key).
  - Single source of truth for runtime URLs.

- **`contentScript-react.js`**

  - Thin orchestrator injected into webpages.
  - Delegates to helpers in `extension/content/` for adapter resolution, state, interactions, and session restore.
  - Hands off rendering to the built React bundle.

- **`content/` helpers**

  - `pageContext.js` (adapter + page context resolution, imports `/integrations` bundle with fallback inference).
  - `stateStore.js` (sidebar/selection/mode state + storage sync).
  - `sidebarHost.js` (mounts/upgrades React sidebar, injects the page wrapper used for layout shifts, and keeps new body nodes inside it).
  - `sessionManager.js` (tab ID + session restore/clear).
  - `interactions.js` (selection + Escape handlers).

- **`background.js`**

  - Service worker for background tasks, context menus, and session routing.

- **`popup.js`**

  - Toolbar popup UI logic, settings, and auth UI.

- **`dist/ui/index.js`**
  - Built React sidebar bundle consumed by the content script (source entry in `ui/extension/index.tsx`, sidebar orchestration in `ui/extension/LockInSidebar.tsx`, Lexical note editor in `ui/extension/notes/`).

### Shared Modules

- **`messaging.js`**

  - Typed message system for extension communication.

- **`storage.js`**

  - Wrapper for `chrome.storage` with defaults and async/await helpers.

- **`contentRuntime.ts` + `contentLibs.ts`**

  - Canonical versioned content runtime exposed as `window.LockInContent` (storage/messaging/session/logger + adapter resolver); bundled to `extension/dist/libs/contentLibs.js`. Legacy compat aliases have been removed (canonical API only).

- **`dist/libs/initApi.js` + `/api` (TS)**

  - Bundled TypeScript API/auth clients that expose `window.LockInAPI` and `window.LockInAuth` (source in `/api` and `extension/src/initApi.ts`).
  - API client is layered: `api/fetcher.ts` contains retry/abort/optimistic-locking/error parsing logic, resource clients live in `api/resources/` (lockin/chats/notes/assets), and `api/client.ts` composes them to keep the same public method bag.

- **`src/` (TypeScript source)**
  - `initApi.ts` - Entry point for bundled API/auth clients
  - `chromeStorage.ts` - Chrome storage adapter implementing `StorageInterface`

### Transcripts (`core/transcripts/` + `ui/extension/transcripts/` + `extension/background.js`)

- **`core/transcripts/types.ts`** - Domain types for transcripts (TranscriptSegment, DetectedVideo, etc.)
- **`core/transcripts/webvttParser.ts`** - WebVTT parsing with HTML entity decoding
- **`core/transcripts/providers/panoptoProvider.ts`** - Panopto detection + caption URL extraction (VTT)
- **`core/transcripts/videoDetection.ts`** - Panopto + HTML5 video detection from DOM context
- **`ui/extension/transcripts/`** - UI components (VideoListPanel, TranscriptMessage, useTranscripts hook) plus HTML5 DOM textTracks extractor (`extractHtml5TranscriptFromDom.ts`)
- **`extension/background.js`** - Caption extraction (Panopto/HTML5) and AI transcription pipeline. Panopto uses `PanoptoMediaResolver` (viewer/embed fetch + MAIN-world probe + GET Range validation) before starting AI transcription.
- **AI fallback**: `useTranscripts.ts` triggers `FETCH_PANOPTO_MEDIA_URL` when captions are missing, then `TRANSCRIBE_MEDIA_AI` streams media to backend transcript jobs.

### Styling

- **`contentScript.css`**
  - Sidebar and UI styling, responsive breakpoints, and page split layout.

## Backend Structure (`backend/`)

### Entry Point

- **`index.js`**
  - Server entry point that loads config, creates HTTP server, and starts listening.

### Application Setup

- **`app.js`**

  - Express application factory.
  - Configures middleware (CORS, JSON parsing, logging).
  - Wires up routes and error handling.

- **`config.js`**
  - Centralized configuration (env vars, rate limits, CORS origins).
  - Asset upload settings: bucket name (`NOTE_ASSETS_BUCKET`), max size, and MIME allow-list.

### Routes & Controllers

- **`routes/lockinRoutes.js`**

  - HTTP route definitions and middleware wiring.

- **`routes/noteRoutes.js`**

  - Authenticated routes for notes CRUD, search, note chat, and note asset upload/list/delete.

- **`routes/transcriptsRoutes.js`**

  - Authenticated routes for transcript job creation, chunk upload, finalize, cancel, and status polling.

- **`controllers/lockinController.js`**

  - Handlers for AI processing, chat listing/deletion, chat messages, and chat title generation (OpenAI summarization + persistence).
  - Input validation and error handling.

- **`controllers/notesController.js`**

  - Notes CRUD, including embeddings.

- **`controllers/notesChatController.js`**

  - Handles chat over notes.

- **`controllers/noteAssetsController.js`**
  - Handles note asset upload/list/delete via Supabase Storage with validation.
  - Returns assets with snake_case fields (note_id, mime_type, storage_path, created_at) that are mapped to camelCase in the API client.

- **`controllers/transcriptsController.js`**
  - Transcript job lifecycle handlers (create, upload chunks, finalize, cancel, status) with quota enforcement and chunk integrity checks.

### Data Layer

- **`chatRepository.js`**

  - Database access layer for chats and chat messages (Supabase).

- **`notesRepository.js`**

  - Data access for notes, embeddings, and ownership checks.

- **`noteAssetsRepository.js`**

  - Data access for the `note_assets` table (create/list/get/delete).

- **`transcriptsRepository.js`**

  - Data access for per-user transcript cache, transcript job records, and chunk tracking.

- **`supabaseClient.js`**
  - Configured Supabase client instance used across the data layer.

### Services

- **`services/transcriptsService.js`**
  - Handles ffmpeg audio extraction, segmentation, OpenAI STT, job cleanup/cancellation, and stale job reaping.

### External Services

- **`openaiClient.js`**
  - OpenAI SDK wrapper, prompt construction, response formatting, and audio transcription.

### Middleware

- **`authMiddleware.js`**

  - Validates Supabase JWT tokens and attaches user context.

- **`rateLimiter.js`**

  - Per-user rate limiting backed by Supabase.

- **`middleware/uploadMiddleware.js`**
  - Multer-based in-memory upload handler with size and MIME validation for note assets.

## Key Design Patterns

### Extension

1. **Adapter pattern**: Site-specific adapters in `/integrations` (Moodle, Edstem) selected by the content script.
2. **Single widget**: One React sidebar bundle rendered via `contentScript-react.js` and `sidebarHost.js`.
3. **Storage/messaging abstractions**: `storage.js` and `messaging.js` hide Chrome APIs behind async helpers.
4. **Separation of concerns**: Orchestrator delegates state, session, and UI responsibilities to dedicated helpers.
5. **API abstraction**: Shared `/api` TypeScript client is bundled into `dist/libs/initApi.js` and exposed as `window.LockInAPI/LockInAuth`.
6. **Notes architecture**: Note domain types live in `core/domain/Note.ts`, backend calls are wrapped by `core/services/notesService.ts` (writes `content_json`/`editor_version`, lazy-migrates legacy HTML), autosave/editing flows run through `useNoteEditor`/`useNotesList`, and the Lexical editor resides in `ui/extension/notes/` with inline attachment/image nodes (resizable images, paperclip insertion).
7. **Notes filtering**: The backend fetches ALL user notes (no server-side filtering by course/page). Client-side filtering in `NotesPanel.tsx` handles "This course", "All notes", and "Starred" filters. This ensures users can see all their notes regardless of which page/course they're currently viewing, and filters update dynamically as they navigate.
8. **Transcript extraction**: Captions-first flow for Panopto/HTML5. Panopto caption URLs are extracted from embed HTML; if captions are missing, `PanoptoMediaResolver` resolves podcast/download URLs (viewer/embed HTML + MAIN-world probe + range validation) and the background AI pipeline uploads media to the backend. UI shows the video list and exposes AI fallback when captions are unavailable.
9. **Cross-tab sync**: `useCrossTabSync` uses `chrome.storage.local` as a lightweight event bus to refresh notes/chat state across tabs without duplicating feature-specific wiring.

### Backend

1. **Layered architecture**: Routes -> Controllers -> Repository -> Database.
2. **Middleware chain**: Auth -> Rate Limit -> Validation -> Handler.
3. **Centralized error handling**: `middleware/errorHandler.js` provides consistent error responses with proper codes and status mapping.
4. **Configuration**: All env vars accessed through `config.js`.
5. **Optimistic locking**: Notes support `If-Unmodified-Since` header for conflict detection.
6. **Input validation**: UUID validation, content length limits, tag sanitization.

## Scalability Features

The system is designed to handle thousands of concurrent users:

### API Client (`/api/client.ts`)

- **Exponential backoff with jitter**: Retries transient failures (429, 502, 503, 504) with randomized delays to prevent thundering herd.
- **Request deduplication**: AbortController cancels in-flight requests when new ones are triggered.
- **Optimistic locking**: `ConflictError` thrown when concurrent edits are detected.

### Error Types (`/core/errors/`)

- **Standardized error codes**: `ErrorCodes` constants for consistent error identification across the stack.
- **Typed error classes**: `AppError`, `AuthError`, `ValidationError`, `NetworkError`, `NotFoundError`, `ConflictError`, `RateLimitError`.
- **User-friendly messages**: `getUserMessage()` method converts technical errors to user-facing text.
- **Error utilities**: `isAppError()` and `wrapError()` helpers for error handling.

### Logging (`/core/utils/logger.ts`)

- **Centralized logging**: Shared logger for core/api modules with level gating via `LOCKIN_CONFIG.DEBUG` (and optional `LOCKIN_CONFIG.LOG_LEVEL`).

### Note Editor (`/ui/hooks/useNoteEditor.ts`)

- **Offline queue**: Failed saves are queued in localStorage and synced when back online.
- **Fingerprint deduplication**: Content changes are fingerprinted to prevent unnecessary saves.
- **Debounced autosave**: 1500ms debounce limits API calls to ~40/minute per active user.

### Backend (`/backend`)

- **Optimistic locking**: Notes repository checks `updated_at` before updates to detect conflicts.
- **Database indexes**: Applied via `migrations/002_performance_indexes.sql` - composite indexes on all tables for common query patterns.
- **Row Level Security**: Applied via `migrations/003_row_level_security.sql` - all tables have RLS policies enforcing user data isolation.
- **Input validation**: UUID format validation, content length limits (50k chars), tag limits (20 tags).

## Security Considerations

- **Extension**: No API keys stored; relies on Supabase auth tokens. Storage is user-scoped.
- **Backend**: Input validation, per-user rate limits, and authenticated requests to protected endpoints.
- **CORS**: Restricted to Chrome extensions and configured origins.

## Testing Strategy

- **Extension**: Unit test utilities and content helpers (`stateStore`, `interactions`, adapters) when wiring tests.
- **Backend**: Unit test controllers and repositories (mock Supabase/OpenAI).
- **Integration**: Test full request flow with a test database.

## Where to Start Reading

- **Extension behavior & UI**: Start with `extension/contentScript-react.js` and helpers in `extension/content/`, then the built React bundle `extension/dist/ui/index.js` (source in `ui/extension/index.tsx`).
- **Backend request flow**: Start with `backend/routes/lockinRoutes.js`, then `controllers/lockinController.js`.
- **Auth & persistence**: Supabase auth client lives in `/api/auth.ts` and is bundled to the extension via `extension/dist/libs/initApi.js` (`window.LockInAuth`); backend enforcement via `backend/middleware/authMiddleware.js`.
- **API communication**: Use the bundled `/api/client.ts` exposed through `extension/dist/libs/initApi.js` (`window.LockInAPI`); backend logic in `openaiClient.js`. The client includes typed methods for note assets (`uploadNoteAsset`, `listNoteAssets`, `deleteNoteAsset`) that return `NoteAsset` objects with camelCase fields.
