# Extension Folder AGENTS.md

## Purpose

The `/extension` folder contains **Chrome extension-specific code only**. This includes:

- Extension manifest and configuration
- Background service worker
- Content script injection and orchestration
- Popup UI (settings, auth)
- Chrome API wrappers (storage, messaging)

**This folder SHOULD contain**:

- Built extension bundles (`/extension/dist/ui`, `/extension/dist/libs`) used by manifest/background/popup
- Chrome API wrappers and extension-specific utilities

**This folder should NOT contain**:

- Business logic (that's in `/core`)
- Site-specific adapters (that's in `/integrations`)
- API client logic (that's in `/api`)

---

## Living Docs Reminder

- Update this file, root `AGENTS.md`, `AGENTS._LIVINGDOC.md`, and architecture docs whenever extension responsibilities change.
- If you move content script helpers or UI entry points, reflect it here in the same change.

---

## File Responsibilities

### `manifest.json`

- Extension configuration
- Content script declarations
- Permissions
- **DO NOT** add business logic here

### `background.js`

- Service worker entrypoint (Chrome extension lifecycle)
- Loads shared libs + `extension/background/` modules, then registers listeners
- **DO NOT** contain business logic - delegate to modular handlers/services

### `background/`

- Modular background implementation: router/validators, handlers, sessions/settings/auth, context menus, lifecycle hooks, and transcript services
- **Transcript extraction**: `transcripts/extensionFetcher.js` provides Chrome-specific CORS/credentials; extraction logic stays in `/core/transcripts/providers/`

### `contentScript-react.js`

- **Active** content script (legacy `contentScript.js` removed)
- Thin orchestrator only: detect site adapter, extract context, and mount React sidebar bundle from `/extension/dist/ui`
- Delegates to helpers in `extension/content/` for page context, state store, sidebar host, session restore, and interactions
- Handles Chrome-specific events (context menu prefill messages, Escape close)
- Applies body class `lockin-sidebar-open` so the injected `#lockin-page-wrapper` reserves space for the sidebar; a MutationObserver keeps new body nodes inside the wrapper; mobile overlays instead of resizing
- **DO NOT** contain:
  - Business logic (use `/core/services`)
  - UI rendering (use React components from `/ui/extension`)
  - Site-specific detection (use adapters from `/integrations`)

### `content/`

- `pageContext.js` (adapter + page context; bundled from `pageContext.ts` importing `/integrations`), `stateStore.js` (state + storage sync), `sidebarHost.js` (React mounting + body split), `sessionManager.js` (tab/session), `interactions.js` (Escape handling).
- Extend functionality by adding focused helpers here instead of inflating `contentScript-react.js`.
- Rebuild `pageContext.js` when adapters/page context logic change: `node_modules/.bin/esbuild extension/content/pageContext.ts --bundle --format=iife --platform=browser --target=es2018 --global-name=LockInPageContext --outfile=extension/content/pageContext.js`.

### `dist/ui/`

- Built bundle lives here (`extension/dist/ui/index.js`), source lives under `/ui/extension`
- Sidebar orchestrator: `ui/extension/LockInSidebar.tsx` (wraps chat + notes)
- Notes UI: `ui/extension/notes/` (`NotesPanel`, Lexical `NoteEditor`, asset helpers)
- Hooks: `useNoteEditor`, `useNoteAssets`, `useNotesList` in `/ui/hooks`
- **These components are NOT shared with the web app** - they are specific to the extension sidebar

### `popup/`

- Popup HTML, JS, CSS
- Settings UI
- Auth UI
- **DO NOT** contain business logic - call API/client functions

### `dist/libs/`

- `initApi.js` - Bundled API/auth client (LockInAPI/LockInAuth)
- `contentLibs.js` - Bundled content helpers (LockInContent/Logger/Messaging/Storage)
- `webvttParser.js` - Bundled WebVTT parser for background usage
- **DO NOT** hand-edit; rebuild via Vite configs

---

## Rules for Editing Extension Files

### âœ… DO

- Keep files small and focused
- Delegate to `/core` for business logic
- Use adapters from `/integrations` for site detection
- Use React components from `/ui/extension` for rendering the sidebar
- Use API client from `/api` for backend calls
- Wrap Chrome APIs in thin wrappers
- Keep extension UI components in `/ui/extension` (they are extension-specific)

### âŒ DON'T

- Put business logic in content scripts
- Hardcode site-specific logic (use adapters)
- Build HTML strings (use React components)
- Use global variables for state (use React hooks)
- Mix concerns (DOM manipulation + API calls + rendering)

---

## Content Script Pattern

The content script should follow this pattern:

```javascript
// 1. Get adapter + context via bundled helper
const { adapter, pageContext } = window.LockInContent.resolveAdapterContext(Logger);

// 2. Mount React component from extension UI
// Note: In practice, this is loaded via script tag and accessed via window.LockInUI
// The built bundle is at extension/dist/ui/index.js
// const { LockInSidebar, createLockInSidebar } = window.LockInUI;
const root = document.createElement('div');
document.body.appendChild(root);
ReactDOM.render(
  <LockInSidebar courseContext={pageContext.courseContext} siteAdapter={adapter} />,
  root,
);

// 4. Handle Chrome-specific events
Messaging.onMessage(handlePrefillRequest);
document.addEventListener('keydown', handleEscapeClose);
```

**Keep it simple. Delegate everything else.**

---

## Background Script Pattern

The background script should:

1. Handle Chrome extension lifecycle
2. Route messages to appropriate handlers
3. Manage per-tab sessions (thin wrapper)
4. Delegate business logic to core/services

```javascript
// Example: Message routing
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_SESSION':
      // Thin wrapper - delegate to core service
      const session = sessionService.getSession(sender.tab.id);
      sendResponse({ ok: true, data: session });
      break;
    // ...
  }
});
```

---

## Popup Pattern

The popup should:

1. Load settings from storage
2. Display UI
3. Save settings to storage
4. Handle auth (via API client)

**DO NOT** contain business logic - just UI and storage operations.

---

## Adding New Chrome Features

When adding new Chrome extension features:

1. **Check if it's Chrome-specific**: If yes, add to `/extension`
2. **Check if logic is reusable**: If yes, put in `/core` and call from extension
3. **Use existing patterns**: Follow the thin wrapper pattern
4. **Document**: Add comments explaining Chrome-specific behavior

---

## Testing Extension Code

- **Manual testing**: Load extension in Chrome, test on supported sites
- **Unit tests**: For utility functions (if any)
- **Integration tests**: For message passing, storage operations

**Note**: Extension code is harder to test than core code. Keep it thin and delegate to testable core code.

---

## Common Mistakes

### âŒ Putting business logic in content script

```javascript
// BAD
function createNote(title, content) {
  // Business logic here
  const note = { title, content, ... };
  // ...
}
```

```javascript
// GOOD
import { noteService } from '../../core/services/noteService';
const note = await noteService.createNote({ title, content });
```

### âŒ Hardcoding site detection

```javascript
// BAD
if (url.includes('learning.monash.edu')) {
  // Moodle-specific logic
}
```

```javascript
// GOOD
const { adapter, pageContext } = window.LockInContent.resolveAdapterContext(Logger);
const context = pageContext.courseContext;
```

### âŒ Building HTML strings

```javascript
// BAD
function renderChat(messages) {
  return messages.map((m) => `<div>${m.content}</div>`).join('');
}
```

```javascript
// GOOD
// Using built bundle (loaded via manifest):
// const { ChatPanel } = window.LockInUI;
// Or in source code:
// import { ChatPanel } from './ui/extension/components/ChatPanel';
<ChatPanel messages={messages} />
```

---

## Questions?

- Check `/AGENTS.md` for project-wide rules
- Review existing code for patterns
- Keep it simple: extension code should be thin wrappers

**Remember**: Extension code is Chrome-specific glue. Business logic lives in `/core`.
