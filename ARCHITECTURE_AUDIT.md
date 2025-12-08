# Lock-in Architecture Audit & Refactoring Plan

## Current State Analysis

### Repository Structure

```
Lock-in/
├── extension/              # Chrome extension code
│   ├── manifest.json       # Extension manifest (v3)
│   ├── background.js       # Service worker
│   ├── contentScript.js    # Main content script (3148 lines!)
│   ├── lockin-sidebar.js   # Sidebar component (699 lines)
│   ├── lockin-widget.js    # Legacy widget (832 lines, unused?)
│   ├── popup.js            # Popup UI
│   ├── supabaseAuth.js     # Auth client
│   ├── chatHistoryUtils.js # Chat utilities
│   ├── config.js           # Runtime config
│   ├── libs/
│   │   ├── api.js          # API client
│   │   ├── storage.js      # Storage wrapper
│   │   ├── messaging.js    # Messaging system
│   │   └── logger.js       # Logger utility
│   └── *.css               # Stylesheets
└── backend/                # Node.js backend (separate concern)
    ├── controllers/
    ├── routes/
    ├── repositories/
    └── ...
```

### Entry Points

1. **Manifest** (`manifest.json`): Defines content scripts, background worker, popup
2. **Content Script** (`contentScript.js`): Main orchestrator - handles UI, API calls, state
3. **Sidebar** (`lockin-sidebar.js`): UI component for sidebar panel
4. **Background** (`background.js`): Service worker for context menus, session management
5. **Popup** (`popup.js`): Settings and auth UI

### Current Architecture Issues

#### 🔴 CRITICAL PROBLEMS

1. **Massive Content Script (3148 lines)**
   - Single file contains: DOM manipulation, API calls, state management, UI rendering, business logic
   - Violates single responsibility principle
   - Hard to test, maintain, and extend

2. **Duplicate Widget Implementations**
   - `lockin-widget.js` (832 lines) - Legacy draggable bubble widget
   - `lockin-sidebar.js` (699 lines) - New sidebar implementation
   - Both exist in codebase, sidebar is used but widget code remains
   - No clear migration path or deprecation

3. **Mixed Concerns**
   - `contentScript.js` mixes:
     - DOM scraping (Monash course detection)
     - Business logic (note creation, chat management)
     - UI rendering (HTML string building)
     - API orchestration
     - State management (global variables)
   - Hard to reuse logic for web app

4. **Hardcoded Site-Specific Logic**
   - Monash-specific course code detection scattered in `contentScript.js`
   - Functions like `detectMonashCourseContext()`, `findCourseCodeInPage()` hardcoded
   - No adapter pattern for different sites (Moodle, Edstem, etc.)

5. **No Clear Domain Layer**
   - Types/interfaces scattered (JSDoc comments only)
   - Business logic embedded in UI code
   - No shared models (Note, Task, ChatMessage, CourseContext)

6. **Tight Coupling**
   - Content script directly manipulates DOM
   - UI rendering mixed with business logic
   - Chrome APIs used throughout (hard to share with web app)

#### 🟡 MODERATE PROBLEMS

7. **Inconsistent State Management**
   - Global variables for state (`chatHistory`, `activeNote`, `currentChatId`, etc.)
   - No centralized state management
   - State synchronization issues possible

8. **No Type Safety**
   - JSDoc comments but no TypeScript
   - Easy to introduce bugs with wrong types
   - No compile-time checks

9. **HTML String Building**
   - UI rendered via string concatenation (`buildChatSection()`, `buildNotesSection()`)
   - Hard to maintain, no component reusability
   - XSS risks (though `escapeHtml` is used)

10. **Inconsistent Error Handling**
    - Mix of try/catch, promise chains, callbacks
    - Error messages inconsistent
    - Some errors silently swallowed

11. **No Clear Extension vs Core Separation**
    - API client (`libs/api.js`) is good but still references Chrome APIs indirectly
    - Auth (`supabaseAuth.js`) uses chrome.storage directly
    - Hard to reuse for web app without modification

#### 🟢 MINOR ISSUES

12. **CSS Organization**
    - Multiple CSS files (`contentScript.css`, `popup.css`, `lockin-widget.css`)
    - No clear naming convention or organization
    - Potential style conflicts

13. **Documentation**
    - Some JSDoc comments present
    - No architecture documentation
    - No clear patterns documented

14. **Testing**
    - No test files visible
    - Hard to test due to tight coupling

---

## Target Architecture Design

### Proposed Folder Structure

```
Lock-in/
├── extension/                    # Chrome extension specific
│   ├── manifest.json
│   ├── background.js            # Service worker (thin)
│   ├── contentScript.js          # Thin orchestrator (mounts UI, collects context)
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── icons/
│   └── libs/                     # Extension-specific utilities
│       ├── chromeStorage.js      # Chrome storage wrapper
│       └── chromeMessaging.js    # Chrome messaging wrapper
│
├── core/                         # Shared business logic (Chrome-agnostic)
│   ├── domain/
│   │   ├── types.ts             # TypeScript types/interfaces
│   │   ├── Note.ts               # Note domain model
│   │   ├── Task.ts               # Task domain model
│   │   ├── ChatMessage.ts       # Chat message model
│   │   └── CourseContext.ts     # Course context model
│   ├── services/
│   │   ├── noteService.ts       # Note CRUD operations
│   │   ├── chatService.ts       # Chat operations
│   │   └── contextService.ts    # Context extraction
│   └── utils/
│       ├── textUtils.ts          # Text processing utilities
│       └── validation.ts        # Validation helpers
│
├── integrations/                 # Site-specific adapters
│   ├── adapters/
│   │   ├── baseAdapter.ts       # Base adapter interface
│   │   ├── moodleAdapter.ts      # Moodle-specific logic
│   │   ├── edstemAdapter.ts      # Edstem-specific logic
│   │   ├── panoptoAdapter.ts     # Panopto-specific logic
│   │   └── genericAdapter.ts    # Fallback for unknown sites
│   └── index.ts                  # Adapter factory/registry
│
├── api/                          # API client layer
│   ├── client.ts                 # Base API client (no Chrome deps)
│   ├── auth.ts                   # Auth client (Supabase, no Chrome deps)
│   ├── notesApi.ts               # Notes API endpoints
│   └── chatApi.ts                # Chat API endpoints
│
├── ui/                           # Shared UI components (React/Preact)
│   ├── components/
│   │   ├── LockInSidebar.tsx    # Main sidebar component
│   │   ├── ChatPanel.tsx        # Chat interface
│   │   ├── NotesPanel.tsx       # Notes interface
│   │   ├── TaskPanel.tsx        # Tasks interface (future)
│   │   ├── ContextHeader.tsx    # Course/week context display
│   │   └── ModeSelector.tsx     # Mode selector component
│   ├── hooks/
│   │   ├── useChat.ts           # Chat state hook
│   │   ├── useNotes.ts          # Notes state hook
│   │   └── useCourseContext.ts  # Course context hook
│   └── styles/
│       └── sidebar.css          # Sidebar styles (CSS Modules or Tailwind)
│
└── backend/                      # Existing backend (unchanged)
    └── ...
```

### Architecture Principles

#### 1. Separation of Concerns

- **Extension Layer** (`/extension`): Chrome-specific code only
  - Manifest, background worker, content script injection
  - Chrome storage/messaging wrappers
  - Popup UI

- **Core Layer** (`/core`): Business logic, domain models
  - No Chrome dependencies
  - Pure TypeScript/JavaScript
  - Reusable for web app

- **Integration Layer** (`/integrations`): Site-specific adapters
  - Each adapter implements `BaseAdapter` interface
  - `canHandle(url)`, `getCourseCode(dom)`, `getWeek(dom)`, `getPageContext(dom)`
  - Easy to add new sites

- **API Layer** (`/api`): Backend communication
  - No Chrome dependencies
  - Uses standard fetch API
  - Reusable for web app

- **UI Layer** (`/ui`): React/Preact components
  - Single `LockInSidebar` component used everywhere
  - Site differences via props/context (adapter, courseContext)
  - Styled with Tailwind or CSS Modules

#### 2. Single Widget Component

- One `<LockInSidebar />` component for all sites
- Site differences handled via:
  - `currentSiteAdapter` prop (injected adapter instance)
  - `courseContext` prop (extracted context)
  - Configuration object

#### 3. Extension-First, Web-App-Friendly

- Shared layers (`core`, `api`, `ui`) have no Chrome dependencies
- Extension layer is thin wrappers:
  - `chromeStorage` wraps `chrome.storage` → calls shared storage interface
  - `chromeMessaging` wraps `chrome.runtime.sendMessage` → calls shared messaging interface
- Web app can use same `core`, `api`, `ui` layers directly

#### 4. AI-Friendly Code

- Clear file names: `noteService.ts`, `moodleAdapter.ts`, `ChatPanel.tsx`
- Small, single-purpose functions
- JSDoc/TSDoc comments for public APIs
- File-level comments explaining purpose and boundaries

---

## Refactoring Plan

### Phase 1: Extract Domain Layer (Foundation)

**Goal**: Create shared domain models and types

1. Create `/core/domain/` folder
2. Define TypeScript types:
   - `Note`, `Task`, `ChatMessage`, `CourseContext`, `StudyResponse`
3. Extract utility functions:
   - `normalizeNote()`, `sanitizeNoteContent()`, `extractCourseCodeFromText()`
4. **No Chrome dependencies** - pure JavaScript/TypeScript

**Files Created**:
- `core/domain/types.ts`
- `core/domain/Note.ts`
- `core/utils/textUtils.ts`

**Files Modified**:
- `contentScript.js` - import from core instead of inline functions

---

### Phase 2: Extract Site Adapters

**Goal**: Move site-specific logic into adapter pattern

1. Create `/integrations/adapters/` folder
2. Define `BaseAdapter` interface:
   ```typescript
   interface BaseAdapter {
     canHandle(url: string): boolean;
     getCourseCode(dom: Document): string | null;
     getWeek(dom: Document): number | null;
     getPageContext(dom: Document): PageContext;
   }
   ```
3. Create adapters:
   - `moodleAdapter.ts` - Extract Monash/Moodle logic
   - `edstemAdapter.ts` - Edstem-specific logic
   - `genericAdapter.ts` - Fallback
4. Create adapter factory that selects adapter based on URL

**Files Created**:
- `integrations/adapters/baseAdapter.ts`
- `integrations/adapters/moodleAdapter.ts`
- `integrations/adapters/genericAdapter.ts`
- `integrations/index.ts` (factory)

**Files Modified**:
- `contentScript.js` - Use adapter factory instead of inline detection

---

### Phase 3: Extract API Layer

**Goal**: Make API client Chrome-agnostic

1. Review `libs/api.js` - already mostly Chrome-agnostic ✅
2. Extract auth logic from `supabaseAuth.js` into `/api/auth.ts`
3. Create storage abstraction:
   - `core/storage/storageInterface.ts` - Interface
   - `extension/libs/chromeStorage.ts` - Chrome implementation
   - Web app can implement localStorage version later

**Files Created**:
- `api/auth.ts` (Chrome-agnostic Supabase client)
- `core/storage/storageInterface.ts`

**Files Modified**:
- `libs/api.js` → move to `api/client.ts`
- `supabaseAuth.js` → thin wrapper around `api/auth.ts`

---

### Phase 4: Extract UI Components (React/Preact)

**Goal**: Replace HTML string building with React components

1. Set up build system (Vite/Webpack) for React/Preact
2. Create `/ui/components/` folder
3. Extract UI into components:
   - `LockInSidebar.tsx` - Main container
   - `ChatPanel.tsx` - Chat interface
   - `NotesPanel.tsx` - Notes interface
   - `ContextHeader.tsx` - Course/week display
   - `ModeSelector.tsx` - Mode selector
4. Use TanStack Query or custom hooks for server state
5. Mount React app in content script

**Files Created**:
- `ui/components/LockInSidebar.tsx`
- `ui/components/ChatPanel.tsx`
- `ui/components/NotesPanel.tsx`
- `ui/hooks/useChat.ts`
- `ui/hooks/useNotes.ts`

**Files Modified**:
- `contentScript.js` - Mount React app instead of building HTML
- `lockin-sidebar.js` - Can be removed (replaced by React component)

---

### Phase 5: Refactor Content Script

**Goal**: Make content script thin orchestrator

1. Content script responsibilities:
   - Detect current site → select adapter
   - Extract course context via adapter
   - Mount React sidebar component
   - Pass context as props
   - Handle Chrome-specific events (text selection, etc.)
2. Remove business logic → move to services
3. Remove UI rendering → React handles it
4. Remove state management → React hooks handle it

**Files Modified**:
- `contentScript.js` - Reduce from 3148 lines to ~200 lines

---

### Phase 6: Clean Up & Remove Dead Code

**Goal**: Remove legacy code and consolidate

1. Delete `lockin-widget.js` (legacy draggable bubble)
2. Delete `lockin-sidebar.js` (replaced by React component)
3. Consolidate CSS files
4. Update manifest.json to load new structure
5. Test on all supported sites

**Files Deleted**:
- `extension/lockin-widget.js`
- `extension/lockin-sidebar.js` (after React migration)

---

## Implementation Order (Safe & Incremental)

### Step 1: Create Domain Layer (No Breaking Changes)
- Extract types and utilities
- Keep existing code working
- Gradually migrate functions to use core

### Step 2: Extract Adapters (Low Risk)
- Create adapter pattern
- Migrate Monash detection to adapter
- Test on Moodle sites

### Step 3: Extract API Layer (Medium Risk)
- Move API client to `/api`
- Create storage abstraction
- Test API calls still work

### Step 4: Introduce React UI (Higher Risk - Needs Testing)
- Set up build system
- Create React components alongside existing UI
- Feature flag to switch between old/new UI
- Test thoroughly before removing old code

### Step 5: Refactor Content Script (Final Cleanup)
- Remove old UI code
- Simplify content script
- Remove dead code

---

## Key Decisions

1. **TypeScript vs JavaScript**: Prefer TypeScript for new code, but allow gradual migration
2. **React vs Preact**: Prefer Preact (smaller bundle), but React is fine too
3. **Build System**: Use Vite for fast dev experience
4. **Styling**: Tailwind CSS or CSS Modules (user preference)
5. **State Management**: TanStack Query for server state, React hooks for local state
6. **Testing**: Add tests as we refactor (Jest + React Testing Library)

---

## Success Criteria

✅ Single widget component used across all sites  
✅ Clear separation: extension / core / integrations / api / ui  
✅ No Chrome dependencies in shared layers  
✅ Content script < 300 lines  
✅ Easy to add new site adapters  
✅ Code is AI-friendly (clear names, small functions, documented)  
✅ Web app can reuse core/api/ui layers  

---

## Next Steps

1. Review this plan with team
2. Start with Phase 1 (Domain Layer) - safest, no breaking changes
3. Iterate incrementally
4. Test after each phase
5. Document as we go
