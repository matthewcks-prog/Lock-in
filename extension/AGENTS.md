# Extension AGENTS.md

> **Inherits from**: [/AGENTS.md](../AGENTS.md)  
> **Last Updated**: 2026-01-28  
> **Purpose**: Chrome extension wrappers, god file prevention, content script patterns

## Table of Contents

- [Purpose](#purpose)
- [Non-Goals](#non-goals)
- [Architectural Boundaries](#architectural-boundaries)
- [Allowed & Forbidden Imports](#allowed--forbidden-imports)
- [Required Patterns](#required-patterns)
- [God File Prevention](#god-file-prevention)
- [Testing Rules](#testing-rules)
- [Error Handling Rules](#error-handling-rules)
- [Golden Path Workflows](#golden-path-workflows)
- [Common Failure Modes](#common-failure-modes)
- [PR Checklist](#pr-checklist)

---

## Purpose

The `/extension` directory contains **Chrome extension-specific code only**:

1. **Extension infrastructure** - manifest, background service worker, content scripts
2. **Chrome API wrappers** - storage, messaging, tabs, context menus
3. **Extension configuration** - config.js (generated from config.ts)
4. **Content script orchestration** - sidebar mounting, page context resolution

**This directory SHOULD contain**:

- `manifest.json` and extension configuration
- Background service worker (`background.js`) and modular handlers (`background/`)
- Content scripts (`contentScript-react.js`) and helpers (`content/`)
- Popup UI (`popup/`)
- Built bundles (`dist/ui`, `dist/libs`)
- Chrome API wrappers (`storage.js`, `messaging.js`)

**This directory MUST NOT contain**:

- Business logic (that's `/core`)
- Site adapters (that's `/integrations`)
- API client logic (that's `/api`)
- UI component source (source is `/ui/extension`, built output here)

---

## Non-Goals

**What this layer is NOT**:

- NOT business logic (use `/core/services`)
- NOT site detection (use `/integrations/adapters`)
- NOT API client (use `/api`)
- NOT UI source code (source is `/ui/extension`, this is built output + wrappers)

---

## Architectural Boundaries

### Extension Structure

```
/extension
├── manifest.json                   ← Extension config
├── background.js                   ← Service worker entrypoint (<200 lines)
├── background/                     ← Modular background implementation
│   ├── index.js                    ← Assemble dependencies, register listeners
│   ├── router.js                   ← Message routing
│   ├── handlers/                   ← Message handlers (auth, settings, transcripts)
│   ├── transcripts/                ← ExtensionFetcher, AI pipeline
│   └── ...                         ← Other modules
├── contentScript-react.js          ← Content script (<200 lines)
├── content/                        ← Content script helpers
│   ├── pageContext.js              ← Adapter resolution
│   ├── stateStore.js               ← Sidebar state + storage sync
│   ├── sidebarHost.js              ← React mounting, body split
│   ├── sessionManager.js           ← Tab sessions
│   └── interactions.js             ← Escape handling
├── popup/                          ← Popup UI
├── dist/ui/                        ← Built React sidebar (from /ui/extension)
├── dist/libs/                      ← Built shared libs (API client, content helpers)
├── src/                            ← TypeScript source for wrappers
│   ├── config.ts                   ← Config generation (→ config.js)
│   ├── networkUtils.js             ← Chrome-specific fetch wrappers
│   ├── chromeStorage.ts            ← Chrome storage adapter
│   └── ...
└── ...
```

### Delegation Pattern

```
┌──────────────────────────────────────────────────┐
│  manifest.json (Declarative)                     │
│  - Defines permissions, scripts, icons           │
└──────────────────────────────────────────────────┘
         ↓                            ↓
┌─────────────────────┐    ┌─────────────────────────┐
│  background.js      │    │  contentScript-react.js │
│  (Entrypoint)       │    │  (Entrypoint)           │
│  - Load modules     │    │  - Detect site adapter  │
│  - Register         │    │  - Mount React sidebar  │
│    listeners        │    │  - Handle events        │
│  - MAX 200 lines    │    │  - MAX 200 lines        │
└──────────┬──────────┘    └───────────┬─────────────┘
           ↓                            ↓
┌──────────────────────┐    ┌─────────────────────────┐
│  background/         │    │  content/               │
│  - Modular handlers  │    │  - pageContext.js       │
│  - ExtensionFetcher  │    │  - stateStore.js        │
│  - Transcript        │    │  - sidebarHost.js       │
│    services          │    │  - sessionManager.js    │
│  - Auth, settings    │    │  - interactions.js      │
└──────────────────────┘    └─────────────────────────┘
           ↓                            ↓
┌──────────────────────────────────────────────────┐
│  SHARED LAYERS (Core, API, Integrations)         │
│  - Business logic, domain models                 │
│  - API client (window.LockInAPI)                 │
│  - Site adapters (window.LockInContent)          │
└──────────────────────────────────────────────────┘
```

---

## Allowed & Forbidden Imports

### Background Scripts

**MUST import**:

- Chrome APIs (`chrome.*`)
- Core domain types (`/core/domain`)
- Core error types (`/core/errors`)
- Transcript providers (bundled to `dist/libs/transcriptProviders.js`)
- Network utils (`extension/src/networkUtils.js`)

**MUST NOT import**:

- Express types
- Browser DOM APIs directly (use message passing to content scripts)

### Content Scripts

**MUST import**:

- Chrome APIs (`chrome.*`)
- DOM APIs (`document`, `window`)
- Bundled helpers (`window.LockInContent`, `window.LockInAPI`)
- Content helpers (`content/` modules)

**MUST NOT import**:

- Backend modules (`/backend/*`)
- Express types
- Node.js-specific modules

### Size Limits

| File                     | Max Lines | Enforcement                                |
| ------------------------ | --------- | ------------------------------------------ |
| `background.js`          | 200       | **MUST** delegate to `background/` modules |
| `contentScript-react.js` | 200       | **MUST** delegate to `content/` helpers    |
| Background handlers      | 150       | **SHOULD** extract complex logic           |
| Content helpers          | 150       | **SHOULD** keep focused                    |

---

## Required Patterns

### 1. Background Script Modularization

**MUST delegate to `background/` modules**:

```javascript
// ✅ GOOD - background.js (entrypoint)
// MAX 200 lines: load modules, register listeners

importScripts('dist/libs/transcriptProviders.js', 'src/networkUtils.js');

// Import modular background implementation
const { registerListeners, initializeDependencies } = require('./background/index.js');

// Initialize dependencies
const deps = initializeDependencies();

// Register all listeners
registerListeners(deps);

console.log('Background service worker initialized');
```

```javascript
// ✅ GOOD - background/index.js (module orchestrator)
const { createMessageRouter } = require('./router');
const { createExtensionFetcher } = require('./transcripts/extensionFetcher');
const { createTranscriptHandlers } = require('./handlers/transcriptHandlers');
const { createAuthHandlers } = require('./handlers/authHandlers');

function initializeDependencies() {
  const fetcher = createExtensionFetcher();
  const router = createMessageRouter();

  return { fetcher, router };
}

function registerListeners(deps) {
  // Runtime message listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    deps.router.route(message, sender, sendResponse);
    return true; // Async response
  });

  // Install/update listeners
  chrome.runtime.onInstalled.addListener((details) => {
    // Handle install/update
  });
}

module.exports = { initializeDependencies, registerListeners };
```

**❌ BAD - God background.js**:

```javascript
// background.js (1000+ lines)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_TRANSCRIPT') {
    // 200 lines of transcript logic inline
  } else if (message.type === 'AUTH_LOGIN') {
    // 100 lines of auth logic
  }
  // ... 700 more lines
});
```

### 2. Content Script Delegation

**MUST delegate to `content/` helpers**:

```javascript
// ✅ GOOD - contentScript-react.js (<200 lines)
import { Logger } from './dist/libs/contentLibs.js';

// 1. Page context via helper
const { adapter, pageContext } = window.LockInContent.resolveAdapterContext(Logger);

// 2. State management via helper
const stateStore = window.LockInContent.createStateStore();

// 3. Sidebar mounting via helper
const sidebarHost = window.LockInContent.createSidebarHost();
sidebarHost.mount({ adapter, pageContext });

// 4. Session restore via helper
const sessionManager = window.LockInContent.createSessionManager();
sessionManager.restoreSession();

// 5. Event handlers via helper
const interactions = window.LockInContent.createInteractions(sidebarHost);
interactions.registerEscapeHandler();

console.log('Lock-in content script initialized');
```

**❌ BAD - God contentScript**:

```javascript
// contentScript.js (800 lines)
// Inline adapter detection (100 lines)
let adapter = null;
if (url.includes('moodle')) {
  adapter = { getCourseCode: () => { /* 50 lines */ } };
}

// Inline React mounting (200 lines)
const root = document.createElement('div');
// ... 200 lines of DOM manipulation

// Inline state management (300 lines)
let sidebarState = { ... };
// ... event listeners, storage sync

// Inline session management (200 lines)
// ... tab ID, session restore
```

### 3. ChromeAPI Wrappers

**MUST wrap Chrome APIs in thin adapters**:

```javascript
// ✅ GOOD - extension/src/chromeStorage.ts
export class ChromeStorageAdapter implements StorageInterface {
  async get<T>(key: string): Promise<T | null> {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }
}
```

### 4. Message Passing Pattern

**MUST use typed messages**:

```javascript
// ✅ GOOD - Typed message
const message = {
  type: 'FETCH_TRANSCRIPT',
  payload: { videoId, captionUrl },
  requestId: crypto.randomUUID(),
};

chrome.runtime.sendMessage(message, (response) => {
  if (response.ok) {
    console.log('Transcript fetched', response.data);
  } else {
    console.error('Fetch failed', response.error);
  }
});
```

### Content Script CSS

- Source: `extension/contentScript/` (tokens + feature modules)
- Build: `npm run build:css` -> `extension/contentScript.css`
- Max file size: ~400 lines per module
- Tokens: `tokens.css` is the single source of truth for all design values
- Layers: Cascade controlled via `@layer`; order defined in `index.css`

---

## God File Prevention

### Background.js Rules

**MUST follow**:

1. **MAX 200 lines** - If exceeded, extract to `background/` modules
2. **Load modules** - Use `importScripts()` for bundled libs
3. **Register listeners** - Call modular registration functions
4. **NO business logic** - Delegate to handlers/services

**Extraction pattern**:

```
background.js (200 lines)
  ↓ delegates to
background/index.js (150 lines)
  ↓ delegates to
background/handlers/transcriptHandlers.js (100 lines)
background/handlers/authHandlers.js (80 lines)
background/transcripts/extensionFetcher.js (120 lines)
```

### ContentScript Rules

**MUST follow**:

1. **MAX 200 lines** - If exceeded, extract to `content/` helpers
2. **Thin orchestrator** - Detect, mount, handle events only
3. **NO inline detection** - Use bundled adapter resolver
4. **NO inline rendering** - Use React bundle from `dist/ui`

**Extraction pattern**:

```
contentScript-react.js (180 lines)
  ↓ delegates to
content/pageContext.js (bundled from .ts, includes /integrations)
content/stateStore.js (sidebar state + storage sync)
content/sidebarHost.js (React mounting + body split)
content/sessionManager.js (tab sessions)
content/interactions.js (event handlers)
```

---

## Testing Rules

### Mock Chrome APIs

**MUST mock `chrome.*` in tests**:

```javascript
// __tests__/chromeStorage.test.js
import { test } from 'node:test';
import { assert } from 'node:assert';

test('ChromeStorageAdapter gets value from chrome.storage', async () => {
  // Mock chrome.storage
  global.chrome = {
    storage: {
      local: {
        get: async (key) => ({ [key]: 'test-value' }),
      },
    },
  };

  const storage = new ChromeStorageAdapter();
  const value = await storage.get('test-key');

  assert.equal(value, 'test-value');
});
```

### No Network Calls in Unit Tests

**MUST mock fetch/network**:

```javascript
test('ExtensionFetcher makes CORS request', async () => {
  global.fetch = async (url, options) => {
    assert.equal(options.credentials, 'include'); // Verify CORS
    return { ok: true, text: async () => 'response' };
  };

  const fetcher = createExtensionFetcher();
  const result = await fetcher.fetch('https://example.com');

  assert.equal(result.text(), 'response');
});
```

---

## Error Handling Rules

### Use Centralized Error Types

**MUST use `/core/errors`**:

```javascript
import { NetworkError, AuthError } from '../core/errors';

async function fetchTranscript(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new NetworkError(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.text();
  } catch (error) {
    if (error instanceof NetworkError) throw error;
    throw new NetworkError('Transcript fetch failed', { cause: error });
  }
}
```

### Log Errors with Context

```javascript
// ✅ GOOD
try {
  await processMessage(message);
} catch (error) {
  logger.error('Message processing failed', {
    messageType: message.type,
    tabId: sender.tab?.id,
    error: error.message,
  });
  sendResponse({ ok: false, error: error.message });
}
```

---

## Golden Path Workflows

### Adding a New Background Message Handler

1. **Create handler** (`background/handlers/newFeatureHandler.js`):

```javascript
export async function handleNewFeature(payload, sender) {
  // Business logic delegation
  const result = await coreService.processNewFeature(payload);
  return { ok: true, data: result };
}
```

2. **Register in router** (`background/router.js`):

```javascript
case 'NEW_FEATURE':
  return handleNewFeature(message.payload, sender);
```

3. **Test handler**:

```javascript
test('handleNewFeature processes payload', async () => {
  const mockService = { processNewFeature: async (p) => ({ id: '123' }) };
  const result = await handleNewFeature({ input: 'test' });
  assert.ok(result.ok);
});
```

### Adding Content Script Helper

1. **Create helper** (`content/newHelper.js`):

```javascript
export function createNewHelper(config) {
  return {
    doSomething: () => {
      /* logic */
    },
  };
}
```

2. **Export from contentLibs** (`extension/src/contentRuntime.ts`):

```typescript
export const LockInContent = {
  // ... existing
  createNewHelper,
};
```

3. **Use in contentScript**:

```javascript
const helper = window.LockInContent.createNewHelper(config);
helper.doSomething();
```

---

## Common Failure Modes

### 1. God Background Script

**Symptom**: `background.js` >500 lines with inline handlers

**Fix**: Extract to `background/` modules (see [God File Prevention](#god-file-prevention))

### 2. Business Logic in Content Script

**Symptom**: Content script contains domain logic

```javascript
// ❌ BAD
function createNote(title, content) {
  // Business logic in content script
  const note = { id: uuid(), title, content /* ... */ };
  chrome.runtime.sendMessage({ type: 'SAVE_NOTE', note });
}

// ✅ GOOD
import { noteService } from '../../core/services/noteService';
const note = noteService.create({ title, content });
chrome.runtime.sendMessage({ type: 'SAVE_NOTE', note });
```

**Fix**: Move to `/core/services`, call from content script

### 3. Direct Chrome API Usage in Shared Code

**Symptom**: `/core` or `/api` imports `chrome`

**Fix**: Pass Chrome APIs as parameters or use DI (see `/core/AGENTS.md`)

---

## PR Checklist

Before merging `/extension` changes, verify:

### God File Prevention

- [ ] `background.js` <200 lines (delegated to `background/`)
- [ ] `contentScript-react.js` <200 lines (delegated to `content/`)
- [ ] Background handlers <150 lines each
- [ ] Content helpers <150 lines each

### Boundaries

- [ ] No business logic in extension code (delegated to `/core`)
- [ ] No site detection in content scripts (use `/integrations` adapters)
- [ ] No API client code (use `/api` via `window.LockInAPI`)

### Chrome APIs

- [ ] Chrome APIs wrapped in adapters where needed
- [ ] Typed messages for `chrome.runtime.sendMessage`
- [ ] Error handling for async Chrome API calls

### Testing

- [ ] Chrome APIs mocked in tests
- [ ] No real network calls in unit tests
- [ ] Test coverage >70% for helpers/handlers

### Documentation

- [ ] `docs/reference/CODE_OVERVIEW.md` updated if structure changed
- [ ] Comments explain Chrome-specific quirks

---

## Questions?

1. Check [/AGENTS.md](../AGENTS.md) for project-wide principles
2. Review existing handlers in `background/` for patterns
3. Keep extension code thin - delegate to `/core` and `/api`

**Remember**: Extension code is Chrome-specific glue. Business logic lives in `/core`. Keep files <200 lines by extracting modules.
