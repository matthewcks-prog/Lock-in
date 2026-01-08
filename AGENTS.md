# Lock-in Project AGENTS.md

## Project Overview

**Lock-in** is an AI-powered study assistant Chrome extension focused on Monash University students. It helps students understand and explain content from learning platforms (Moodle, Edstem, Panopto, etc.) while capturing notes and tasks.

**Core Philosophy**: Extension-first, web-app-friendly. The extension is the primary surface; a future web app will share the same backend and data.

---

## Core Experience Loop

Every feature should reinforce this loop:

1. **Capture** → Highlight text / video / assignment spec
2. **Understand** → Explain / summarise
3. **Distil** → Turn that into a note, flashcard, or todo
4. **Organise** → Auto-bucket by unit, week, topic (course metadata)
5. **Act** → Show upcoming tasks, revision items, questions

**When making changes, ask**: Does this support the loop? Does it make capture → understand → distil → organise → act easier?

---

## Documentation Hierarchy

This project uses a structured documentation approach:

- **`/AGENTS.md`** (this file) - Canonical stable contract: architecture boundaries, coding rules, workflow patterns
- **`docs/ARCHITECTURE.md`** - Stable architecture invariants (surfaces, boundaries, contracts)
- **`docs/STATUS.md`** - Living snapshot: outstanding issues, recent changes, implementation status
- **`docs/REPO_MAP.md`** - Repository structure map and entrypoints
- **`docs/ADRS/`** - Architecture Decision Records (when created)
- **`docs/REFACTOR_PLAN.md`** - Phased refactoring plan
- **`docs/PROMPT_LOG.md`** - Log of refactoring prompts and outcomes
- **`CODE_OVERVIEW.md`** - Current codebase snapshot (implementation details)
- **`DATABASE.MD`** - Database schema and migration history
- **Folder-level `AGENTS.md`** - Folder-specific conventions (e.g., `/extension/AGENTS.md`)

**Doc stability**: `/AGENTS.md` and `docs/ARCHITECTURE.md` are stable contracts; `docs/STATUS.md` and `CODE_OVERVIEW.md` are living snapshots; `docs/REPO_MAP.md` is a concise navigation map.

**When to update docs:**

- **`/AGENTS.md`**: Only when architectural boundaries, coding rules, or workflow patterns change
- **`DATABASE.MD`**: When schema changes (new tables/columns, migrations)
- **`CODE_OVERVIEW.md`**: When file structure or implementation patterns change
- **Folder `AGENTS.md`**: When folder-specific conventions change

## Architecture Principles

### Two Surfaces, One Backend

- **Chrome Extension** (`/extension`): In-context assistant on learning platforms
  - UI: Sidebar widget with tabs (Chat/Notes/Settings) - specific to extension
  - Source lives in `/ui/extension` - React components for the sidebar widget (build output lives in `/extension/dist/ui`, not source)
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
  /dist/ui     → Built output: React sidebar bundle (source in /ui/extension)
  /dist/libs   → Built outputs: initApi/contentLibs/webvttParser bundles
/ui           → UI source (shared hooks + extension UI source)
/ui/extension → Source: Extension-only React components for the sidebar widget
/core          → Business logic, domain models (NO Chrome dependencies)
/integrations  → Site-specific adapters (Moodle, Edstem, etc.)
/api           → Backend API client (NO Chrome dependencies)
/web           → Future: web app React/Next.js app (full pages and dashboards)
/shared/ui     → Optional: Low-level UI kit (Button, Card, TextInput, etc.) - basic components only
```

**Rule**: If code in `/core` or `/api` needs Chrome APIs, you're doing it wrong. Extract Chrome-specific parts to `/extension`. The extension UI source (`/ui/extension`) is Chrome-specific and will not be reused by the web app.

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
  - `/ui/extension` - Source: Sidebar widget React components (extension-specific, not shared)
  - `/extension/dist/ui` - Built output: React sidebar bundle (built from `/ui/extension`)
  - `/extension/dist/libs` - Built output: initApi/contentLibs/webvttParser bundles (built from `/extension/src`)
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

See `CODE_OVERVIEW.md` for detailed file structure and current implementation patterns.

**Key boundaries:**

- `/extension` - Chrome-specific code only
- `/core` - Business logic, domain models (NO Chrome dependencies)
- `/integrations` - Site-specific adapters
- `/api` - Backend API client (NO Chrome dependencies)
- `/web` - Future: web app (full pages, not reusing extension sidebar)
- `/shared/ui` - Optional: Low-level UI kit (basic components only)

---

## Making Changes

### Workflow

1. **Scan key docs & structure**
   - Read `/AGENTS.md` (this file)
   - Check `DATABASE.MD` if touching schema
   - Check folder-level `AGENTS.md` if editing specific folders
   - Review `CODE_OVERVIEW.md` for current implementation patterns

2. **Plan first**
   - Identify what will change and which files are involved
   - Determine if changes impact architecture, database, or documented behaviors

3. **Make code changes**
   - Follow the core loop: Capture → Understand → Distil → Organise → Act
   - Respect separation: Extension code in `/extension`, shared code in `/core`/`/api`
   - Use adapters: Site-specific logic goes in adapters, not UI or content scripts
   - Single widget: Don't duplicate the sidebar component
   - Incremental changes: Don't rewrite everything at once

4. **Update living docs (MANDATORY)**
   - Update `DATABASE.MD` if schema changes (new tables/columns, migrations)
   - Update `CODE_OVERVIEW.md` if file structure or implementation patterns change
   - Update folder `AGENTS.md` if folder-specific conventions change
   - Update `/AGENTS.md` only if architectural boundaries, coding rules, or workflow patterns change

5. **Update MCP documentation (if applicable)**
   - **When to update**: New database tables, new npm scripts, new file types/folders
   - **How to update**:
     1. Run `npm run mcp:docs:draft` (or `tools/mcp/scripts/update-mcp-docs.ps1 -Draft`) to preview changes
     2. Review generated configs in `tools/mcp/config/`
     3. Run `npm run mcp:docs:publish` (or `tools/mcp/scripts/update-mcp-docs.ps1 -Publish`) to stage for commit
   - **Detailed workflow**: See `tools/mcp/docs/FEATURE_WORKFLOW.md`
   - **Note**: MCP configs are auto-generated from `DATABASE.MD`, `package.json`, and repository structure

6. **Summarize what changed**
   - List code changes (files + purpose)
   - List doc changes (`.md` files updated and what changed)
   - Note any TODOs or follow-ups

### When Adding Features

- Follow the core loop: Capture → Understand → Distil → Organise → Act
- Respect separation: Extension code in `/extension`, shared code in `/core`/`/api`
- Use adapters: Site-specific logic goes in adapters, not UI or content scripts
- Single widget: Don't duplicate the sidebar component
- UI location: Extension UI source goes in `/ui/extension` (built to `/extension/dist/ui`), web app UI will go in `/web`

### When Refactoring

- Incremental changes: Don't rewrite everything at once
- Test after each step: Ensure extension still works
- Maintain behavior: Don't remove features without discussion
- Document as you go: Update comments and docs

### Code Review Checklist

- [ ] Does this support the core loop?
- [ ] Is Chrome-specific code isolated to `/extension`?
- [ ] Are site-specific adapters used instead of hardcoded logic?
- [ ] Is the widget component reused, not duplicated?
- [ ] Are types defined in `/core/domain/types.ts`?
- [ ] Is state managed properly (React hooks or TanStack Query)?
- [ ] Are components small and focused?
- [ ] If adding new database tables → Updated `DATABASE.MD` → Ran `npm run mcp:docs:draft` → Reviewed → `npm run mcp:docs:publish`?
- [ ] If adding new npm scripts → Ran `npm run mcp:docs:draft` → Reviewed → `npm run mcp:docs:publish`?
- [ ] If adding new file types/folders → Ran `npm run mcp:docs:draft` → Reviewed → `npm run mcp:docs:publish`?

---

## Common Patterns

### Adding a New Site

1. Create adapter: `/integrations/adapters/newSiteAdapter.ts`
2. Register: Add to `/integrations/index.ts`
3. Test: Verify course code extraction works
4. Document: Add site to supported sites list

### Notes Editing Flow

- Domain types: `core/domain/Note.ts`
- Service layer: `core/services/notesService.ts` (handles content format, migrations)
- UI: `ui/extension/notes/` (Lexical editor, panels)
- See `CODE_OVERVIEW.md` for detailed implementation patterns

### Adding a New Extension UI Feature

1. Create component in `/ui/extension` (source location)
2. Add hook if needed
3. Integrate into `LockInSidebar.tsx`
4. Style with Tailwind or CSS Modules

**Note**: Extension UI source is in `/ui/extension` (built to `/extension/dist/ui`). Extension UI is specific to the sidebar widget. The future web app will have its own UI components in `/web`.

### Adding a New API Endpoint

1. Add to API client: `/api/client.ts` or specific file
2. Add types: `/core/domain/types.ts`
3. Use in service: `/core/services/` or directly in hooks
4. Handle errors: Consistent error handling

### Transcript System Architecture

The transcript system uses a **provider pattern with dependency injection**:

1. **Provider Pattern** (`/core/transcripts/providers/`)
   - All video providers implement `TranscriptProviderV2` interface
   - Providers are auto-registered via `core/transcripts/index.ts`
   - Detection uses provider registry, not direct function calls
   - Each provider handles detection and extraction for its platform

2. **Fetcher Interface** (`/core/transcripts/fetchers/`)
   - `AsyncFetcher` - Base interface for network operations
   - `EnhancedAsyncFetcher` - Optional capabilities (redirect tracking, HTML parsing)
   - Extension implements `ExtensionFetcher` in `background.js` (Chrome-specific)
   - Future: Web app will implement `WebAppFetcher` (standard fetch API)

3. **Extraction Flow**
   - Detection: `detectVideosSync()` uses provider registry
   - Extraction: Provider's `extractTranscript(video, fetcher)` method
   - Fetcher handles CORS/credentials (background script for extension)
   - Caching: Transcripts cached in `chrome.storage.local` (future enhancement)

4. **File Organization**
   - `/core/transcripts/providers/` - Provider implementations (Panopto, HTML5)
   - `/core/transcripts/fetchers/` - Fetcher interfaces and type guards
   - `/ui/extension/transcripts/hooks/` - React hooks (useTranscripts)
   - `/extension/background.js` - ExtensionFetcher + message routing (no extraction logic)

5. **Why Fetcher Interface?**
   - **CORS**: Background scripts bypass CORS, content scripts cannot
   - **Credentials**: Background scripts can send cookies with `credentials: "include"`
   - **Testability**: Core providers can be tested with mock fetchers
   - **Reusability**: Same provider works in extension and future web app

**Rule**: Business logic (extraction algorithm) lives in `/core`. Chrome-specific fetching lives in `/extension`. Providers depend on fetcher interface, not concrete implementations.

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

When building new features, consider: Will the core logic work in both extension and web app? The UI will be separate.

- **Web app**: Will reuse `/core` and `/api` layers, but will have its own UI in `/web`
- **UI kit**: May create `/shared/ui` for basic reusable components (Button, Card, etc.)
- See `docs/STATUS.md` for current feature status and planned work

---

## Refactor Prep Tracking (MANDATORY)

When making changes related to refactor preparation (guardrails, documentation, tests, build scripts), you **MUST** update:

1. **`docs/REFACTOR_PLAN.md`**
   - Mark completed phases or update phase descriptions
   - Update "Definition of Done" checklist if criteria change

2. **`docs/PROMPT_LOG.md`**
   - Add a new row for the prompt session
   - Include: Prompt ID, Tool, Mode, Purpose, Output Summary, Date

This ensures the refactor plan and prompt log stay accurate and reflect the current state of refactor preparation work.

**Examples of refactor-prep changes:**

- Adding TypeScript type definitions for globals
- Creating/updating build scripts (`verify-build`, etc.)
- Adding ESLint rules for architectural boundaries
- Creating smoke test checklists
- Setting up test harnesses
- Updating documentation structure

---

## Questions?

- Check folder-level `AGENTS.md` files
- Review `CODE_OVERVIEW.md` for current implementation patterns
- Check `docs/STATUS.md` for outstanding issues and recent changes
- Ask before making large architectural changes

**Remember**: Extension-first, but web-app-friendly. Keep shared code (`/core`, `/api`) Chrome-free. Extension UI source (`/ui/extension`, built to `/extension/dist/ui`) is specific to the sidebar widget and will not be reused by the web app.
