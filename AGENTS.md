# Lock-in Project AGENTS.md

## Project Overview

**Lock-in** is an AI-powered study assistant Chrome extension focused on Monash University students. It helps students understand, simplify, and translate content from learning platforms (Moodle, Edstem, Panopto, etc.) while capturing notes and tasks.

**Core Philosophy**: Extension-first, web-app-friendly. The extension is the primary surface; a future web app will share the same backend and data.

---

## Core Experience Loop

Every feature should reinforce this loop:

1. **Capture** → Highlight text / video / assignment spec
2. **Understand** → Explain / simplify / translate / summarise
3. **Distil** → Turn that into a note, flashcard, or todo
4. **Organise** → Auto-bucket by unit, week, topic (course metadata)
5. **Act** → Show upcoming tasks, revision items, questions

**When making changes, ask**: Does this support the loop? Does it make capture → understand → distil → organise → act easier?

---

## Living Docs Expectations

- Keep this file, `AGENTS._LIVINGDOC.md`, `ARCHITECTURE_AUDIT.md`, `CODE_OVERVIEW.md`, and any folder-level `AGENTS.md` updated whenever you move, add, or remove code.
- Treat docs as the source of truth for structure and flows; do not leave stale references after refactors.

## Architecture Principles

### Two Surfaces, One Backend

- **Chrome Extension** (`/extension`): In-context assistant on learning platforms
  - UI: Sidebar widget with tabs (Chat/Notes/Settings) - specific to extension
  - Lives in `/extension/ui` - React components for the sidebar widget
- **Web App** (`/web` - future): Study dashboard, knowledge base, analytics
  - UI: Full-page layouts (dashboard, notes library, calendar, analytics pages)
  - Will have its own page/layout components under `/web`

Both share:
- Same Supabase backend + auth
- Same domain models (`/core`)
- Same API client (`/api`)
- Optionally a low-level UI kit (`/shared/ui` or `/ui-kit`) for basic components like `<Button>`, `<Card>`, `<TextInput>`

### Separation of Concerns

```
/extension     → Chrome-specific code only (manifest, background, content script injection)
  /ui          → Extension-only React components for the sidebar widget
/core          → Business logic, domain models (NO Chrome dependencies)
/integrations  → Site-specific adapters (Moodle, Edstem, etc.)
/api           → Backend API client (NO Chrome dependencies)
/web           → Future: web app React/Next.js app (full pages and dashboards)
/shared/ui     → Optional: Low-level UI kit (Button, Card, TextInput, etc.) - basic components only
```

**Rule**: If code in `/core` or `/api` needs Chrome APIs, you're doing it wrong. Extract Chrome-specific parts to `/extension`. The extension UI (`/extension/ui`) is Chrome-specific and will not be reused by the web app.

---

## Coding Rules

### 1. Single Widget Component

- **ONE** `<LockInSidebar />` component used across all sites
- Site differences handled via:
  - `currentSiteAdapter` prop (injected adapter instance)
  - `courseContext` prop (extracted context)
  - Configuration object

**DO NOT** create separate widget implementations for different sites.

### 2. Site Adapters Pattern

To add a new site integration:

1. Create `/integrations/adapters/yourSiteAdapter.ts`
2. Implement `BaseAdapter` interface:
   ```typescript
   class YourSiteAdapter implements BaseAdapter {
     canHandle(url: string): boolean { ... }
     getCourseCode(dom: Document): string | null { ... }
     getWeek(dom: Document): number | null { ... }
     getPageContext(dom: Document, url: string): PageContext { ... }
   }
   ```
3. Register in `/integrations/index.ts`

**DO NOT** scatter site-specific logic in content scripts or UI components.

### 3. Extension vs Core Separation

- **Extension code** (`/extension`): Chrome-specific code
  - `/extension/ui` - Sidebar widget React components (extension-specific, not shared)
  - `chromeStorage` wraps `chrome.storage` → calls shared storage interface
  - `chromeMessaging` wraps `chrome.runtime.sendMessage` → calls shared messaging interface

- **Core code** (`/core`, `/api`): Pure JavaScript/TypeScript, no Chrome APIs
  - Can be reused by web app without modification
  - Domain models, business logic, API client

- **Web app code** (`/web` - future): Full-page layouts and dashboards
  - Will have its own UI components, not reusing the sidebar widget

**Test**: Can you import `/core` or `/api` code in a Node.js script? If not, you have Chrome dependencies leaking in.

### 4. State Management

- **Server state** (notes, chats, tasks): Use TanStack Query or similar
- **Local UI state**: React hooks (`useState`, `useReducer`)
- **Extension state** (settings, preferences): `chrome.storage.sync` via storage wrapper

**DO NOT** use global variables for state. Use React state or proper state management.

### 5. UI Rendering

- **Use React/Preact components**, not HTML string building
- **Styled with Tailwind CSS** or CSS Modules
- **Components are small and focused** (single responsibility)

**DO NOT** build HTML strings in JavaScript. Use JSX/TSX.

---

## File Organization

### Extension Files (`/extension`)

- `manifest.json` - Extension manifest
- `background.js` - Service worker (thin, delegates to core)
- `contentScript.js` - Thin orchestrator (mounts UI, collects context)
- `popup/` - Popup UI (settings, auth)
- `libs/` - Extension-specific utilities (Chrome wrappers)
- `ui/` - Extension-only React components for the sidebar widget
  - `components/` - LockInSidebar, ChatPanel, NotesPanel, etc.
  - `hooks/` - React hooks for sidebar functionality

### Core Files (`/core`)

- `domain/` - Domain models and types
  - `types.ts` - Shared TypeScript types
  - `Note.ts` - Note domain model and utilities
  - `Task.ts` - Task domain model (future)
- `services/` - Business logic services
- `utils/` - Pure utility functions

### Integration Files (`/integrations`)

- `adapters/` - Site-specific adapters
  - `baseAdapter.ts` - Base interface
  - `moodleAdapter.ts` - Moodle/Monash adapter
  - `edstemAdapter.ts` - Edstem adapter
  - `genericAdapter.ts` - Fallback adapter
- `index.ts` - Adapter factory

### API Files (`/api`)

- `client.ts` - Base API client (fetch-based, no Chrome)
- `auth.ts` - Supabase auth client (no Chrome)
- `notesApi.ts` - Notes endpoints
- `chatApi.ts` - Chat endpoints

### Web App Files (`/web` - future)

- Will contain full-page layouts and dashboard components
- Not reusing the extension sidebar widget
- Will have its own page components (DashboardLayout, NotesPage, CalendarPage, etc.)

### Optional Shared UI Kit (`/shared/ui` or `/ui-kit` - future)

- Low-level, reusable components only
- Basic components like `<Button>`, `<Card>`, `<TextInput>`, `<Modal>`
- Used by both extension and web app for consistent styling
- **NOT** high-level components like `<LockInSidebar>` or page layouts

---

## Making Changes

### Before You Start

1. **Read this file** (`/AGENTS.md`)
2. **Check folder-level AGENTS.md** if editing a specific folder
3. **Understand the architecture** - where does your change fit?

### When Adding Features

1. **Follow the core loop**: Capture → Understand → Distil → Organise → Act
2. **Respect separation**: Extension code in `/extension`, shared code in `/core`/`/api`
3. **Use adapters**: Site-specific logic goes in adapters, not UI or content scripts
4. **Single widget**: Don't duplicate the sidebar component
5. **UI location**: Extension UI goes in `/extension/ui`, web app UI will go in `/web`

### When Refactoring

1. **Incremental changes**: Don't rewrite everything at once
2. **Test after each step**: Ensure extension still works
3. **Maintain behavior**: Don't remove features without discussion
4. **Document as you go**: Update comments and docs

### Code Review Checklist

- [ ] Does this support the core loop?
- [ ] Is Chrome-specific code isolated to `/extension`?
- [ ] Are site-specific adapters used instead of hardcoded logic?
- [ ] Is the widget component reused, not duplicated?
- [ ] Are types defined in `/core/domain/types.ts`?
- [ ] Is state managed properly (React hooks or TanStack Query)?
- [ ] Are components small and focused?

---

## Common Patterns

### Adding a New Site

1. Create adapter: `/integrations/adapters/newSiteAdapter.ts`
2. Register: Add to `/integrations/index.ts`
3. Test: Verify course code extraction works
4. Document: Add site to supported sites list

### Notes Editing Flow (extension)

1. Domain types live in `core/domain/Note.ts` (`Note`, `NoteContent`, `NoteStatus`, `NoteAsset`).
2. All backend calls go through `core/services/notesService.ts` (handles `content_json`/`editor_version`, writes both on create/update, and lazily migrates legacy HTML-only notes by saving a Lexical JSON state).
3. UI orchestration sits in `ui/extension/LockInSidebar.tsx` and `ui/extension/notes/NotesPanel.tsx`.
4. Lexical-based editor is in `ui/extension/notes/NoteEditor.tsx` (no contentEditable/innerHTML). Autosave/state comes from `useNoteEditor` + `useNotesList`; assets flow through `useNoteAssets` wired to `notesService`.
5. When creating notes from chat or selection, generate `NoteContent` (Lexical JSON, `version: lexical_v1`) instead of HTML.
6. The Notes UI uses a single card shell (title + status + toolbar + editor) with inline attachments: the paperclip inserts `ImageNode`/`AttachmentNode` at the cursor, images are resizable, and there is no separate attachments list.

### Adding a New Extension UI Feature

1. Create component: `/extension/ui/components/NewFeature.tsx` (or source in `/ui` if using build process)
2. Add hook if needed: `/extension/ui/hooks/useNewFeature.ts`
3. Integrate: Add to `LockInSidebar.tsx` in the extension UI
4. Style: Use Tailwind or CSS Modules

**Note**: Extension UI is specific to the sidebar widget. The future web app will have its own UI components in `/web`.

### Adding a New API Endpoint

1. Add to API client: `/api/client.ts` or specific file
2. Add types: `/core/domain/types.ts`
3. Use in service: `/core/services/` or directly in hooks
4. Handle errors: Consistent error handling

---

## Naming Conventions

- **Components**: PascalCase (`LockInSidebar.tsx`)
- **Hooks**: camelCase starting with `use` (`useChat.ts`)
- **Types/Interfaces**: PascalCase (`Note`, `CourseContext`)
- **Functions**: camelCase (`createNote`, `extractCourseCode`)
- **Files**: camelCase for utilities, PascalCase for components
- **Constants**: UPPER_SNAKE_CASE (`STORAGE_KEYS`)

---

## Testing Strategy

- **Unit tests**: For domain logic (`/core`)
- **Integration tests**: For adapters (`/integrations`)
- **E2E tests**: For extension flows (future)
- **Manual testing**: On all supported sites after changes

---

## Future Considerations

- **Web app**: Will reuse `/core` and `/api` layers, but will have its own UI in `/web`
- **UI kit**: May create `/shared/ui` or `/ui-kit` for basic reusable components (Button, Card, etc.)
- **Tasks feature**: Planned but not yet implemented
- **Spaced repetition**: Future feature for flashcards
- **Analytics**: Future feature for study insights

When building new features, consider: Will the core logic work in both extension and web app? The UI will be separate.

---

## Questions?

- Check folder-level AGENTS.md files
- Review existing code patterns
- Ask before making large architectural changes

**Remember**: Extension-first, but web-app-friendly. Keep shared code (`/core`, `/api`) Chrome-free. Extension UI (`/extension/ui`) is specific to the sidebar widget and will not be reused by the web app.
