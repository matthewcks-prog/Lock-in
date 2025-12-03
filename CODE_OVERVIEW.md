## Lock-in Code Overview

This document gives a **minimal technical map of the code** so you can quickly understand how the system works.

---

## High-Level Architecture

- **Chrome extension** (`extension/`) runs in the browser, renders the Lock-in UI, and calls the backend.
- **Backend API** (`backend/`) is a Node.js/Express server that:
  - Handles authentication and rate limiting
  - Talks to Supabase for persistence
  - Calls OpenAI for Explain/Simplify/Translate

Data flow:

1. User highlights text in the page → extension captures selection.
2. Extension builds a payload (mode, text, user/session info, chat state).
3. Request goes to the backend (`/api/lockin` and related chat endpoints).
4. Backend validates/authenticates, calls OpenAI, stores/loads chat, and returns JSON.
5. Extension updates the in-page bubble and history UI.

---

## Backend Structure (`backend/`)

- `app.js`  
  - Builds and configures the Express app: JSON parsing, CORS, logging, error handling.
  - Wires up routes from `routes/lockinRoutes.js`.

- `index.js`  
  - Entry point used by `npm start` / `npm run dev`.  
  - Loads config, creates the HTTP server, and starts listening on the configured port.

- `config.js`  
  - Central place for environment variables and configuration (OpenAI keys, Supabase URLs, CORS origins, port, rate limits).

- `routes/lockinRoutes.js`  
  - Defines the HTTP routes (e.g. `/api/lockin`, chat history, delete chat).  
  - Attaches middleware like auth and rate limiting, then delegates to `lockinController`.

- `controllers/lockinController.js`  
  - Core request handlers:
    - Reads request body (text, mode, targetLanguage, chatId, etc.).
    - Uses `chatRepository` to load/store chats.
    - Uses `openaiClient` to get Explain/Simplify/Translate responses.
    - Shapes the JSON that the extension consumes.

- `authMiddleware.js`  
  - Validates the Supabase (or JWT-style) `Authorization: Bearer <token>` header.
  - Attaches the authenticated user (e.g. `req.user`) for downstream handlers.

- `rateLimiter.js`  
  - Express middleware to guard endpoints against abusive usage.
  - Configured using values from `config.js`.

- `supabaseClient.js`  
  - Creates and exports a configured Supabase client instance.
  - Used wherever database access is required.

- `chatRepository.js`  
  - Small data-access layer wrapping Supabase:
    - Create/read/update/delete chats.
    - Store and fetch chat messages.
    - Ensure operations are scoped to the authenticated user.

- `openaiClient.js`  
  - Wraps the OpenAI SDK.
  - Exposes functions that accept mode + text (+ language, difficulty, history) and return structured results.

---

## Extension Structure (`extension/`)

- `manifest.json`  
  - Chrome Extension manifest (permissions, content scripts, background service worker, icons).

- `config.js`  
  - Exposes `window.LOCKIN_CONFIG` (backend URL, Supabase URL, Supabase anon key).
  - Single source of truth for runtime URLs used by the extension.

- `contentScript.js`  
  - Injected into webpages; owns the **in-page UI**:
    - Detects text selection and shows the Lock-in bubble.
    - Manages modes (Explain/Simplify/Translate) and the minimized pill / expanded bubble.
    - Renders chat history list and attaches delete/select handlers.
    - Builds requests to the backend and handles responses.
  - This is the primary place to look for client-side logic and UI behavior.

- `contentScript.css`  
  - Styling for everything drawn inside the page:
    - Bubble, overlay, minimized pill, mode selector, history list, dialogs, animations.

- `lockin-widget.js` / `lockin-widget.css`  
  - Encapsulated “widget” logic and styles used by the content script to render the modern, refactored UI.

- `background.js`  
  - Service worker:
    - Registers context menu items (e.g. “Lock-in: Explain/Simplify/Translate”).
    - Bridges context menu actions to the content script.

- `popup.html`, `popup.js`, `popup.css`  
  - Toolbar popup UI:
    - Sign in / sign out via Supabase.
    - User preferences (language, difficulty, theme, etc.).
    - Stores settings and sessions in Chrome storage.

- `supabaseAuth.js`  
  - Handles Supabase auth from the extension:
    - Sign-in / sign-up flows.
    - Token storage/refresh.
    - Exposes helpers the content script and popup can call.

- `chatHistoryUtils.js`  
  - Utility helpers for chat history:
    - Formatting entries.
    - Sorting / limiting lists.
    - Mapping raw backend responses into the structures the UI expects.

---

## Where to Start Reading the Code

- **Extension behavior & UI**: start with `extension/contentScript.js` and `extension/lockin-widget.js`, then open `contentScript.css`.
- **Backend request flow**: start with `backend/routes/lockinRoutes.js`, then `controllers/lockinController.js`, and follow into `chatRepository.js` and `openaiClient.js`.
- **Auth & persistence**: read `supabaseAuth.js` (extension) alongside `authMiddleware.js` and `supabaseClient.js` (backend).


