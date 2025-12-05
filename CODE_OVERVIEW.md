# Lock-in Code Overview

This document provides a technical overview of the Lock-in codebase architecture and structure.

## High-Level Architecture

- **Chrome Extension** (`extension/`) runs in the browser, renders the Lock-in sidebar UI, and communicates with the backend
- **Backend API** (`backend/`) is a Node.js/Express server that:
  - Handles authentication and rate limiting
  - Persists chat data to Supabase
  - Calls OpenAI for Explain/Simplify/Translate responses

**Data Flow:**
1. User highlights text (Ctrl/Cmd + select) → extension captures selection
2. Extension builds payload (mode, text, user/session info, chat state)
3. Request goes to backend (`/api/lockin` and related chat endpoints)
4. Backend validates/authenticates, calls OpenAI, stores/loads chat, returns JSON
5. Extension updates sidebar with response and chat history

## Extension Structure (`extension/`)

### Core Files

- **`manifest.json`**
  - Chrome Extension manifest (permissions, content scripts, background service worker, icons)
  - Declares minimal required permissions

- **`config.js`**
  - Exposes `window.LOCKIN_CONFIG` (backend URL, Supabase URL, Supabase anon key)
  - Single source of truth for runtime URLs

- **`contentScript.js`**
  - Main orchestrator injected into webpages
  - Handles text selection detection (Ctrl/Cmd + select)
  - Manages sidebar state and rendering
  - Coordinates API calls and chat history
  - Uses messaging system for communication

- **`lockin-sidebar.js`**
  - Sidebar component class
  - Handles open/close, resize functionality
  - Manages responsive behavior (desktop vs mobile)
  - Dispatches custom events for content script

- **`background.js`**
  - Service worker for background tasks
  - Registers context menu items
  - Manages per-tab session storage
  - Handles extension lifecycle events

- **`popup.js`**
  - Toolbar popup UI logic
  - Sign in / sign out via Supabase
  - User preferences (language, difficulty, theme)
  - Settings persistence

### Shared Modules

- **`messaging.js`**
  - Typed message system for extension communication
  - Defines message types and response shapes
  - Validates messages and handles errors

- **`storage.js`**
  - Wrapper for chrome.storage operations
  - Provides async/await interface
  - Handles errors and defaults

- **`api.js`**
  - Backend API client wrapper
  - Handles authentication tokens
  - Error handling and retries
  - Request/response transformation

- **`supabaseAuth.js`**
  - Supabase authentication handling
  - Sign-in / sign-up flows
  - Token storage/refresh
  - Session management

- **`chatHistoryUtils.js`**
  - Utility helpers for chat history
  - Formatting, sorting, limiting
  - HTML escaping for XSS prevention

### Styling

- **`contentScript.css`**
  - All sidebar and UI styling
  - Responsive breakpoints
  - Theme variables
  - Resize handle styles

## Backend Structure (`backend/`)

### Entry Point

- **`index.js`**
  - Server entry point
  - Loads config, creates HTTP server
  - Starts listening on configured port

### Application Setup

- **`app.js`**
  - Express application factory
  - Configures middleware (CORS, JSON parsing, logging)
  - Wires up routes
  - Error handling

- **`config.js`**
  - Centralized configuration
  - Environment variables
  - Request limits, rate limits
  - CORS origin validation

### Routes & Controllers

- **`routes/lockinRoutes.js`**
  - HTTP route definitions
  - Attaches middleware (auth, rate limiting)
  - Delegates to controllers

- **`controllers/lockinController.js`**
  - Request handlers:
    - `handleLockinRequest` - Main AI processing endpoint
    - `listChats` - Get recent chats
    - `deleteChat` - Delete a chat
    - `listChatMessages` - Get messages for a chat
  - Input validation
  - Error handling

### Data Layer

- **`chatRepository.js`**
  - Database access layer
  - Create/read/update/delete chats
  - Store and fetch chat messages
  - User-scoped operations

- **`supabaseClient.js`**
  - Configured Supabase client instance
  - Used for all database operations

### External Services

- **`openaiClient.js`**
  - OpenAI SDK wrapper
  - Exposes functions for Explain/Simplify/Translate
  - Handles prompt construction
  - Response formatting

### Middleware

- **`authMiddleware.js`**
  - Validates Supabase JWT tokens
  - Attaches user context to requests
  - Handles token refresh

- **`rateLimiter.js`**
  - Per-user rate limiting
  - Daily request limits
  - Uses Supabase for persistence

## Key Design Patterns

### Extension

1. **Messaging Pattern**: All communication between background, content, and popup uses typed messages
2. **Event-Driven**: Sidebar dispatches custom events for content script to handle
3. **Storage Abstraction**: All chrome.storage access goes through storage.js wrapper
4. **API Abstraction**: All backend calls go through api.js wrapper

### Backend

1. **Layered Architecture**: Routes → Controllers → Repository → Database
2. **Middleware Chain**: Auth → Rate Limit → Validation → Handler
3. **Error Handling**: Consistent error responses, no internal details exposed
4. **Configuration**: All env vars accessed through config.js

## Security Considerations

- **Extension**: Never stores API keys, uses Supabase auth tokens
- **Backend**: Validates all inputs, rate limits per user, authenticates all requests
- **Storage**: Sensitive data encrypted by Chrome, user-scoped in database
- **CORS**: Restricted to Chrome extensions and configured origins

## Testing Strategy

- **Extension**: Unit test utilities (chatHistoryUtils, storage, api)
- **Backend**: Unit test controllers and repositories (mock Supabase/OpenAI)
- **Integration**: Test full request flow with test database

## Where to Start Reading

- **Extension behavior & UI**: Start with `extension/contentScript.js`, then `lockin-sidebar.js`
- **Backend request flow**: Start with `backend/routes/lockinRoutes.js`, then `controllers/lockinController.js`
- **Auth & persistence**: Read `supabaseAuth.js` (extension) alongside `authMiddleware.js` (backend)
- **API communication**: Check `api.js` (extension) and `openaiClient.js` (backend)
