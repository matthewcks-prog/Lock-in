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
  - `pageContext.js` (adapter + page context resolution).
  - `stateStore.js` (sidebar/selection/mode state + storage sync).
  - `sidebarHost.js` (mounts/upgrades React sidebar and body classes).
  - `sessionManager.js` (tab ID + session restore/clear).
  - `interactions.js` (selection + Escape handlers).

- **`background.js`**
  - Service worker for background tasks, context menus, and session routing.

- **`popup.js`**
  - Toolbar popup UI logic, settings, and auth UI.

- **`ui/index.js`**
  - Built React sidebar bundle consumed by the content script (source in `ui/extension/index.tsx`).

### Shared Modules

- **`messaging.js`**
  - Typed message system for extension communication.

- **`storage.js`**
  - Wrapper for `chrome.storage` with defaults and async/await helpers.

- **`api.js`** (legacy JS client)
  - Backend API client wrapper with auth token handling and error handling.

- **`supabaseAuth.js`**
  - Supabase authentication handling (sign-in/up, token storage/refresh, session management).

- **`libs/initApi.ts` + `/api` (TS)**
  - Shared TypeScript API/auth clients intended to replace the legacy JS client (not yet wired into the runtime bundle).

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

### Routes & Controllers

- **`routes/lockinRoutes.js`**
  - HTTP route definitions and middleware wiring.

- **`controllers/lockinController.js`**
  - Handlers for AI processing, chat listing/deletion, and chat messages.
  - Input validation and error handling.

### Data Layer

- **`chatRepository.js`**
  - Database access layer for chats and chat messages (Supabase).

- **`supabaseClient.js`**
  - Configured Supabase client instance used across the data layer.

### External Services

- **`openaiClient.js`**
  - OpenAI SDK wrapper, prompt construction, and response formatting.

### Middleware

- **`authMiddleware.js`**
  - Validates Supabase JWT tokens and attaches user context.

- **`rateLimiter.js`**
  - Per-user rate limiting backed by Supabase.

## Key Design Patterns

### Extension

1. **Adapter pattern**: Site-specific adapters in `/integrations` (Moodle, Edstem) selected by the content script.
2. **Single widget**: One React sidebar bundle rendered via `contentScript-react.js` and `sidebarHost.js`.
3. **Storage/messaging abstractions**: `storage.js` and `messaging.js` hide Chrome APIs behind async helpers.
4. **Separation of concerns**: Orchestrator delegates state, session, and UI responsibilities to dedicated helpers.
5. **API abstraction**: Legacy `api.js` currently in use; migration planned to shared TypeScript clients.

### Backend

1. **Layered architecture**: Routes -> Controllers -> Repository -> Database.
2. **Middleware chain**: Auth -> Rate Limit -> Validation -> Handler.
3. **Error handling**: Consistent error responses without leaking internal details.
4. **Configuration**: All env vars accessed through `config.js`.

## Security Considerations

- **Extension**: No API keys stored; relies on Supabase auth tokens. Storage is user-scoped.
- **Backend**: Input validation, per-user rate limits, and authenticated requests to protected endpoints.
- **CORS**: Restricted to Chrome extensions and configured origins.

## Testing Strategy

- **Extension**: Unit test utilities and content helpers (`stateStore`, `interactions`, adapters) when wiring tests.
- **Backend**: Unit test controllers and repositories (mock Supabase/OpenAI).
- **Integration**: Test full request flow with a test database.

## Where to Start Reading

- **Extension behavior & UI**: Start with `extension/contentScript-react.js` and helpers in `extension/content/`, then the built React bundle `extension/ui/index.js` (source in `ui/extension/index.tsx`).
- **Backend request flow**: Start with `backend/routes/lockinRoutes.js`, then `controllers/lockinController.js`.
- **Auth & persistence**: Read `supabaseAuth.js` (extension) alongside `authMiddleware.js` (backend).
- **API communication**: Check the legacy `api.js` (extension), the shared `/api` TypeScript clients, and `openaiClient.js` (backend).
