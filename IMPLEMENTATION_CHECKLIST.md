# Lock-in Implementation Checklist & Code Reference

This document provides a comprehensive overview of the Lock-in codebase, its features, architecture, and implementation details. It serves as a single source of truth for understanding the current state of the project.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Code Structure](#code-structure)
5. [API Endpoints](#api-endpoints)
6. [Data Models](#data-models)
7. [Key Functions & Components](#key-functions--components)
8. [State Management](#state-management)
9. [Authentication & Security](#authentication--security)
10. [Known Limitations & Future Enhancements](#known-limitations--future-enhancements)

---

## Project Overview

**Lock-in** is an AI-powered Chrome extension that helps students learn by providing instant explanations, simplifications, and translations of any text on the web. It features a sidebar interface with chat conversations and note-taking capabilities, backed by a Node.js/Express API with Supabase for persistence and OpenAI for AI processing.

### Core Value Propositions

- **Text Processing**: Explain, simplify, or translate any selected text
- **Persistent Chat**: Maintain conversation context across sessions
- **Note Management**: Save and organize notes with semantic search
- **RAG (Retrieval-Augmented Generation)**: Chat with your notes using AI

---

## Architecture

### High-Level Flow

```
User selects text (Ctrl/Cmd + select)
    ↓
Extension captures selection
    ↓
Content script builds payload (mode, text, context, chat history)
    ↓
Request to backend API (/api/lockin)
    ↓
Backend validates, authenticates, calls OpenAI
    ↓
Backend stores chat/messages in Supabase
    ↓
Response returned to extension
    ↓
Sidebar updates with AI response and chat history
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Extension                      │
├─────────────────────────────────────────────────────────┤
│  contentScript.js (Main orchestrator)                   │
│  ├── Text selection detection                           │
│  ├── Sidebar UI rendering                               │
│  ├── Chat interface management                          │
│  ├── Notes interface management                         │
│  └── API coordination                                   │
│                                                          │
│  lockin-sidebar.js (Sidebar component)                  │
│  ├── Open/close/resize functionality                    │
│  ├── Tab navigation (Chat/Notes)                        │
│  └── Responsive behavior                                │
│                                                          │
│  libs/api.js (API client)                               │
│  ├── processText()                                      │
│  ├── createNote() / listNotes() / searchNotes()        │
│  ├── chatWithNotes()                                    │
│  └── Authentication handling                           │
└─────────────────────────────────────────────────────────┘
                        ↕ HTTP/JSON
┌─────────────────────────────────────────────────────────┐
│                    Backend API                           │
├─────────────────────────────────────────────────────────┤
│  Express.js Server                                      │
│  ├── routes/lockinRoutes.js (Chat endpoints)           │
│  ├── routes/noteRoutes.js (Notes endpoints)            │
│  ├── controllers/lockinController.js                    │
│  ├── controllers/notesController.js                     │
│  ├── controllers/notesChatController.js (RAG)          │
│  ├── repositories/notesRepository.js                    │
│  ├── openaiClient.js (Chat + Embeddings)               │
│  └── authMiddleware.js (JWT validation)                │
└─────────────────────────────────────────────────────────┘
                        ↕
┌─────────────────────────────────────────────────────────┐
│                    Supabase Database                     │
├─────────────────────────────────────────────────────────┤
│  Tables:                                                │
│  ├── chats (chat sessions)                              │
│  ├── messages (chat messages)                           │
│  ├── notes (user notes with embeddings)                │
│  └── Functions: match_notes (vector search)            │
└─────────────────────────────────────────────────────────┘
```

---

## Features

### 1. Text Selection & Processing

**Location**: `extension/contentScript.js`

- **Trigger**: User holds Ctrl (Windows/Linux) or Cmd (Mac) and selects text
- **Modes**:
  - **Explain**: Clear explanations with examples
  - **Simplify**: Convert complex text to simple language
  - **Translate**: Translate and explain in another language
- **Implementation**: `runMode(mode)`, `callLockInApi()`

### 2. Chat Interface

**Location**: `extension/contentScript.js` (Chat Tab)

#### 2.1 Chat Messages
- Displays conversation history (user + assistant messages)
- Follow-up questions supported
- Persistent chat sessions (saved to Supabase)
- **Functions**: `buildChatMessagesHtml()`, `buildChatSection()`

#### 2.2 Chat Action Buttons
- Appear on hover over assistant messages (except first message)
- Two actions:
  - **"Save as note"**: Pre-fills note editor with message content
  - **"Generate notes"**: Shows AI-drafted notes panel
- **Functions**: `attachChatActionListeners()`, `onSaveAsNote()`, `onGenerateNotes()`

#### 2.3 Chat History Panel
- Toggleable left panel showing recent chats
- Click to load previous conversations
- New chat button to start fresh
- **Functions**: `buildHistorySection()`, `handleSelectChat()`, `handleNewChatEvent()`

### 3. Notes Tab

**Location**: `extension/contentScript.js` (Notes Tab)

#### 3.1 Doc-Like Editor
- Large title input (16px, bold, 40px min-height)
- Spacious textarea (150px+ min-height, 1.6 line-height)
- Footer with timestamp and "Save note" button
- Always visible (no toggle needed)
- **Functions**: `buildNotesSection()`, `attachNewNoteEditorListeners()`

#### 3.2 Filter Dropdown
- Filter notes by scope:
  - "This page" - Notes from current URL
  - "This course" - Notes from same course code
  - "All notes" - All user notes
- Located below editor (not in header)
- **Functions**: `loadNotes(filter)`, filter select change handler

#### 3.3 Notes List
- Displays saved notes below editor
- Shows title, preview, and metadata
- Click to view note details
- **Functions**: `renderNotesList()`, `loadNotes()`

#### 3.4 AI Draft Panel
- Appears when "Generate notes" is clicked from chat
- Shows bullet list of AI-suggested notes
- Actions:
  - **"Insert into current note"**: Adds bullets to editor
  - **"Save each as separate note"**: Creates individual notes
  - **"Dismiss"**: Closes panel
- **Functions**: `showAiDraftNotes()`, `saveDraftNotesAsSeparate()`, `insertDraftIntoCurrent()`, `clearAiDraftPanel()`

### 4. Sidebar System

**Location**: `extension/lockin-sidebar.js`

- Fixed right-hand sidebar (30% viewport width)
- Resizable width (280-500px on desktop)
- Responsive: shrinks page on desktop, overlays on mobile
- Tab navigation (Chat / Notes)
- Smooth animations
- **Class**: `LockinSidebar`

### 5. Authentication

**Location**: `extension/supabaseAuth.js`, `backend/authMiddleware.js`

- Supabase email/password authentication
- JWT tokens stored in Chrome Sync
- Automatic token refresh
- All API calls include auth headers
- **Functions**: `getValidAccessToken()`, `requireSupabaseUser()` middleware

### 6. Semantic Search (RAG)

**Location**: `backend/controllers/notesChatController.js`, `extension/libs/api.js`

- Vector embeddings for notes (OpenAI embeddings API)
- Semantic similarity search using Supabase `match_notes()` function
- Chat with notes: answers questions using user's notes as context
- **Functions**: `chatWithNotes()`, `searchNotesByEmbedding()`

---

## Code Structure

### Extension (`extension/`)

#### Core Files

| File | Purpose | Key Functions |
|------|---------|---------------|
| `contentScript.js` | Main orchestrator (~2500 lines) | `init()`, `runMode()`, `buildChatSection()`, `buildNotesSection()`, `loadNotes()` |
| `lockin-sidebar.js` | Sidebar component | `LockinSidebar` class, `init()`, `open()`, `close()`, `switchTab()` |
| `background.js` | Service worker | Context menus, session management |
| `popup.js` | Settings UI | Authentication, preferences |
| `supabaseAuth.js` | Auth handling | `signIn()`, `signOut()`, `getValidAccessToken()` |

#### Shared Libraries (`libs/`)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `api.js` | API client | `processText()`, `createNote()`, `listNotes()`, `searchNotes()`, `chatWithNotes()` |
| `messaging.js` | Message system | Typed messages for extension communication |
| `storage.js` | Storage wrapper | `get()`, `set()`, chrome.storage abstraction |
| `logger.js` | Logging utility | `debug()`, `info()`, `warn()`, `error()` |

#### Utilities

| File | Purpose |
|------|---------|
| `chatHistoryUtils.js` | Chat history formatting, HTML escaping |
| `config.js` | Runtime configuration (backend URL, Supabase credentials) |

### Backend (`backend/`)

#### Entry Point

| File | Purpose |
|------|---------|
| `index.js` | Server entry point, starts HTTP server |
| `app.js` | Express app factory, middleware setup, route wiring |

#### Routes

| File | Endpoints |
|------|-----------|
| `routes/lockinRoutes.js` | `/api/lockin` (POST), `/api/chats` (GET), `/api/chats/:id` (DELETE), `/api/chats/:id/messages` (GET) |
| `routes/noteRoutes.js` | `/api/notes` (POST, GET), `/api/notes/search` (GET), `/api/notes/chat` (POST) |

#### Controllers

| File | Purpose | Key Functions |
|------|---------|---------------|
| `controllers/lockinController.js` | Chat/processing handlers | `handleLockinRequest()`, `listChats()`, `deleteChat()`, `listChatMessages()` |
| `controllers/notesController.js` | Notes CRUD | `createNote()`, `listNotes()`, `searchNotes()` |
| `controllers/notesChatController.js` | RAG chat | `chatWithNotes()` |

#### Data Layer

| File | Purpose | Key Functions |
|------|---------|---------------|
| `repositories/notesRepository.js` | Notes database ops | `createNote()`, `listNotes()`, `searchNotesByEmbedding()` |
| `chatRepository.js` | Chat database ops | `createChat()`, `getChat()`, `listChats()`, `saveMessage()` |
| `supabaseClient.js` | Supabase client config | Configured client instance |

#### External Services

| File | Purpose | Key Functions |
|------|---------|---------------|
| `openaiClient.js` | OpenAI integration | `chatWithModel()`, `embedText()` |

#### Middleware & Utilities

| File | Purpose |
|------|---------|
| `authMiddleware.js` | JWT validation, user context |
| `rateLimiter.js` | Per-user rate limiting |
| `config.js` | Centralized configuration |
| `utils/validation.js` | Input validation utilities |

---

## API Endpoints

### Chat & Processing

#### `POST /api/lockin`
Process text with AI (Explain/Simplify/Translate).

**Request:**
```json
{
  "selection": "Text to process",
  "mode": "explain",
  "targetLanguage": "en",
  "difficultyLevel": "highschool",
  "chatHistory": [],
  "newUserMessage": "Optional follow-up",
  "chatId": "optional-existing-chat-id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "mode": "explain",
    "explanation": "AI response",
    "notes": [],
    "todos": [],
    "tags": [],
    "difficulty": "medium"
  },
  "chatId": "uuid"
}
```

#### `GET /api/chats?limit=10`
Get recent chats for authenticated user.

#### `DELETE /api/chats/:chatId`
Delete a chat and all its messages.

#### `GET /api/chats/:chatId/messages`
Get all messages for a specific chat.

### Notes

#### `POST /api/notes`
Create a new note with embedding.

**Request:**
```json
{
  "title": "Note title",
  "content": "Note content",
  "sourceSelection": "Original text",
  "sourceUrl": "https://example.com",
  "courseCode": "CS101",
  "noteType": "manual",
  "tags": ["tag1"]
}
```

#### `GET /api/notes?sourceUrl=&courseCode=&limit=`
List notes with optional filters.

#### `GET /api/notes/search?q=query&courseCode=&k=`
Semantic search using vector embeddings.

#### `POST /api/notes/chat`
Chat with notes (RAG).

**Request:**
```json
{
  "query": "What did I learn about databases?",
  "courseCode": "CS101",
  "k": 8
}
```

**Response:**
```json
{
  "answer": "AI answer based on notes",
  "usedNotes": [{"id": "uuid", "title": "...", "courseCode": "CS101"}]
}
```

---

## Data Models

### Chat
```typescript
{
  id: string (UUID)
  user_id: string (UUID)
  created_at: timestamp
  updated_at: timestamp
}
```

### Message
```typescript
{
  id: string (UUID)
  chat_id: string (UUID)
  role: "user" | "assistant"
  content: string
  created_at: timestamp
}
```

### Note
```typescript
{
  id: string (UUID)
  user_id: string (UUID)
  title: string
  content: string
  source_selection?: string
  source_url?: string
  course_code?: string
  note_type: string
  tags: string[]
  embedding: number[] (1536 dimensions)
  created_at: timestamp
  updated_at: timestamp
}
```

### StudyResponse (API Response)
```typescript
{
  mode: "explain" | "simplify" | "translate"
  explanation: string
  notes: Array<{title: string, content: string, type: string}>
  todos: Array<{title: string, description: string}>
  tags: string[]
  difficulty: "easy" | "medium" | "hard"
}
```

---

## Key Functions & Components

### Extension Functions

#### Initialization
- `init()` - Main initialization, loads state, sets up event listeners
- `initializeSidebar()` - Initializes LockinSidebar component
- `loadToggleState()` - Loads highlighting enabled state
- `loadThemeAndPersonalisation()` - Loads theme and accent color

#### Text Processing
- `runMode(mode)` - Processes text with selected mode
- `callLockInApi(payload)` - Makes API request to backend
- `validateSelection()` - Validates text selection
- `determineDefaultMode()` - Determines default mode from settings

#### Chat Interface
- `buildChatSection()` - Renders chat tab HTML
- `buildChatMessagesHtml()` - Renders chat messages with action buttons
- `buildHistorySection()` - Renders chat history panel
- `attachChatActionListeners()` - Handles chat action button clicks
- `onSaveAsNote()` - Saves chat message as note
- `onGenerateNotes()` - Shows AI draft notes panel

#### Notes Interface
- `buildNotesSection()` - Renders notes tab HTML
- `loadNotes(filter)` - Loads and displays notes
- `renderNotesList(notes, listEl)` - Renders notes list
- `attachNewNoteEditorListeners()` - Handles note editor interactions
- `showAiDraftNotes()` - Displays AI draft panel
- `saveDraftNotesAsSeparate()` - Saves AI notes as separate notes
- `insertDraftIntoCurrent()` - Inserts AI notes into editor
- `clearAiDraftPanel()` - Removes draft panel

#### UI Utilities
- `showToast(message, type)` - Shows toast notification
- `applyTheme()` - Applies theme and accent color
- `renderSidebarContent()` - Renders sidebar content

### Backend Functions

#### Controllers
- `handleLockinRequest()` - Main text processing handler
- `listChats()` - Get recent chats
- `deleteChat()` - Delete chat
- `listChatMessages()` - Get chat messages
- `createNote()` - Create note with embedding
- `listNotes()` - List notes with filters
- `searchNotes()` - Semantic search
- `chatWithNotes()` - RAG chat handler

#### Repositories
- `createNote()` - Insert note with embedding
- `listNotes()` - Query notes with filters
- `searchNotesByEmbedding()` - Vector similarity search

#### OpenAI Client
- `chatWithModel(messages)` - Chat completion
- `embedText(text)` - Generate embedding vector

---

## State Management

### Extension State (`contentScript.js`)

```javascript
// UI State
let highlightingEnabled = true
let currentMode = MODES.EXPLAIN
let isBubbleOpen = true
let currentTabId = null
let currentOrigin = window.location.origin

// Selection State
let cachedSelection = ""
let cachedRect = null

// Chat State
let chatHistory = []
let pendingInputValue = ""
let isChatLoading = false
let currentChatId = null
let recentChats = []
let isHistoryPanelOpen = false

// Notes State
let currentStudyResponse = null // Stores AI response (notes, todos, tags)

// Theme State
let currentTheme = THEMES.LIGHT
let currentAccentColor = "#667eea"
```

### Storage Keys

- `highlightingEnabled` - Toggle state
- `lockinBubbleOpen` - Sidebar open state
- `lockinActiveMode` - Current mode
- `lockinTheme` - Theme preference
- `lockinAccentColor` - Accent color
- `lockinCurrentChatId` - Active chat ID

---

## Authentication & Security

### Authentication Flow

1. User signs in via popup (`popup.js`)
2. Supabase returns JWT token
3. Token stored in Chrome Sync
4. Content script retrieves token via `LockInAuth.getValidAccessToken()`
5. Token included in all API requests as `Authorization: Bearer <token>`
6. Backend validates token via `authMiddleware.js`

### Security Measures

- ✅ All endpoints require authentication (Supabase JWT)
- ✅ Rate limiting per user (configurable daily limit)
- ✅ Input validation and sanitization
- ✅ CORS restricted to Chrome extensions
- ✅ No sensitive data in logs
- ✅ Error messages don't expose internal details
- ✅ HTML escaping in chat history (XSS prevention)

---

## Known Limitations & Future Enhancements

### Current Limitations

1. **Notes Features**:
   - No markdown editor (plain text only)
   - No rich text formatting toolbar
   - Filter dropdown doesn't persist selection across sessions
   - Course code extraction not fully implemented

2. **Chat Features**:
   - No chat export functionality
   - No chat sharing
   - Chat history panel doesn't show preview

3. **AI Features**:
   - AI notes generation happens client-side (may be slow)
   - No note templates
   - No bulk operations on notes

4. **UI/UX**:
   - No dark mode for notes (theme applies to sidebar only)
   - Toast notifications are basic (no queue)
   - No keyboard shortcuts documented

### Future Enhancements

- [ ] Markdown support in note editor
- [ ] Rich text formatting toolbar
- [ ] Note templates
- [ ] Bulk operations on notes
- [ ] Note tagging UI in editor
- [ ] Chat export functionality
- [ ] Keyboard shortcuts
- [ ] Improved toast notification system
- [ ] Course code auto-detection from page
- [ ] Note versioning/history
- [ ] Collaborative notes (sharing)
- [ ] Advanced search filters
- [ ] Note organization (folders/tags)

---

## Development Workflow

### Making Changes

1. **Extension**:
   - Edit files in `extension/` directory
   - Go to `chrome://extensions/`
   - Click refresh icon on Lock-in card
   - Reload any open webpages to see changes

2. **Backend**:
   - Edit files in `backend/` directory
   - Run `npm run dev` for auto-reload
   - Test with extension or curl

### Testing Checklist

- [ ] Text selection triggers sidebar
- [ ] All three modes work (Explain, Simplify, Translate)
- [ ] Chat history persists across sessions
- [ ] Notes save and load correctly
- [ ] Filter dropdown works
- [ ] "Save as note" pre-fills editor
- [ ] "Generate notes" shows draft panel
- [ ] AI draft panel actions work
- [ ] Authentication flow works
- [ ] Semantic search works
- [ ] RAG chat works

---

## File Locations Reference

### Extension
- Main orchestrator: `extension/contentScript.js`
- Sidebar component: `extension/lockin-sidebar.js`
- API client: `extension/libs/api.js`
- Auth: `extension/supabaseAuth.js`
- Config: `extension/config.js`

### Backend
- Server entry: `backend/index.js`
- App setup: `backend/app.js`
- Chat routes: `backend/routes/lockinRoutes.js`
- Notes routes: `backend/routes/noteRoutes.js`
- Chat controller: `backend/controllers/lockinController.js`
- Notes controller: `backend/controllers/notesController.js`
- RAG controller: `backend/controllers/notesChatController.js`
- Notes repository: `backend/repositories/notesRepository.js`
- OpenAI client: `backend/openaiClient.js`

---

**Last Updated**: Current implementation state as of latest code review.
**Maintainer Notes**: This document should be updated when new features are added or architecture changes.
