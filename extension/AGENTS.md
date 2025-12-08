# Extension Folder AGENTS.md

## Purpose

The `/extension` folder contains **Chrome extension-specific code only**. This includes:

- Extension manifest and configuration
- Background service worker
- Content script injection and orchestration
- Popup UI (settings, auth)
- Chrome API wrappers (storage, messaging)

**This folder SHOULD contain**:
- Extension-specific UI components (`/extension/ui`) - the sidebar widget React components
- Chrome API wrappers and extension-specific utilities

**This folder should NOT contain**:
- Business logic (that's in `/core`)
- Site-specific adapters (that's in `/integrations`)
- API client logic (that's in `/api`)

---

## File Responsibilities

### `manifest.json`
- Extension configuration
- Content script declarations
- Permissions
- **DO NOT** add business logic here

### `background.js`
- Service worker (Chrome extension lifecycle)
- Context menu handlers
- Session management (per-tab)
- Message routing
- **DO NOT** contain business logic - delegate to core/services

### `contentScript.js`
- **Thin orchestrator only** (~200 lines max)
- Detects current site → selects adapter
- Extracts course context via adapter
- Mounts React sidebar component from `/extension/ui`
- Handles Chrome-specific events (text selection, etc.)
- **DO NOT** contain:
  - Business logic (use `/core/services`)
  - UI rendering (use React components from `/extension/ui`)
  - Site-specific detection (use adapters from `/integrations`)

### `ui/`
- Extension-specific React components for the sidebar widget
- Components: `LockInSidebar`, `ChatPanel`, `NotesPanel`, `ChatHistoryPanel`
- Hooks: `useChat`, `useNotes`, `useChatHistory`
- **These components are NOT shared with the web app** - they are specific to the extension sidebar

### `popup/`
- Popup HTML, JS, CSS
- Settings UI
- Auth UI
- **DO NOT** contain business logic - call API/client functions

### `libs/`
- `chromeStorage.js` - Wrapper around `chrome.storage` (calls shared storage interface)
- `chromeMessaging.js` - Wrapper around `chrome.runtime.sendMessage`
- **DO NOT** contain business logic - these are thin wrappers

---

## Rules for Editing Extension Files

### ✅ DO

- Keep files small and focused
- Delegate to `/core` for business logic
- Use adapters from `/integrations` for site detection
- Use React components from `/extension/ui` for rendering the sidebar
- Use API client from `/api` for backend calls
- Wrap Chrome APIs in thin wrappers
- Keep extension UI components in `/extension/ui` (they are extension-specific)

### ❌ DON'T

- Put business logic in content scripts
- Hardcode site-specific logic (use adapters)
- Build HTML strings (use React components)
- Use global variables for state (use React hooks)
- Mix concerns (DOM manipulation + API calls + rendering)

---

## Content Script Pattern

The content script should follow this pattern:

```javascript
// 1. Get adapter for current site
import { getCurrentAdapter } from '../../integrations';
const adapter = getCurrentAdapter();

// 2. Extract context
const pageContext = adapter.getPageContext(document, window.location.href);

// 3. Mount React component from extension UI
// Note: In practice, this is loaded via script tag and accessed via window.LockInUI
// The built bundle is at extension/ui/index.js
// const { LockInSidebar, createLockInSidebar } = window.LockInUI;
const root = document.createElement('div');
document.body.appendChild(root);
ReactDOM.render(
  <LockInSidebar 
    courseContext={pageContext.courseContext}
    siteAdapter={adapter}
  />,
  root
);

// 4. Handle Chrome-specific events
document.addEventListener('mouseup', handleTextSelection);
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

### ❌ Putting business logic in content script
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

### ❌ Hardcoding site detection
```javascript
// BAD
if (url.includes('learning.monash.edu')) {
  // Moodle-specific logic
}
```

```javascript
// GOOD
import { getCurrentAdapter } from '../../integrations';
const adapter = getCurrentAdapter();
const context = adapter.getCourseContext(document, url);
```

### ❌ Building HTML strings
```javascript
// BAD
function renderChat(messages) {
  return messages.map(m => `<div>${m.content}</div>`).join('');
}
```

```javascript
// GOOD
// Using built bundle (loaded via manifest):
// const { ChatPanel } = window.LockInUI;
// Or in source code:
// import { ChatPanel } from './extension/ui/components/ChatPanel';
<ChatPanel messages={messages} />
```

---

## Questions?

- Check `/AGENTS.md` for project-wide rules
- Review existing code for patterns
- Keep it simple: extension code should be thin wrappers

**Remember**: Extension code is Chrome-specific glue. Business logic lives in `/core`.
