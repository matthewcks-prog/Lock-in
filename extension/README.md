# Lock-in Chrome Extension

Chrome extension component of the Lock-in study assistant. Provides a sidebar interface for AI-powered text processing, chat conversations, and note-taking with semantic search.

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select this `extension` folder
5. Done! The extension is now installed.

## Architecture

### Core Files

- **`manifest.json`**: Extension configuration (permissions, scripts, metadata)
- **`contentScript-react.js`**: Active content script (Ctrl/Cmd + select to open, Escape to close) that mounts the React sidebar bundle and syncs layout/state
- **`dist/ui/index.js`**: Built React sidebar bundle (source in `/ui/extension`)
- **`background.js`**: Service worker for context menus and session management
- **`popup.js`**: Settings and authentication UI (uses `window.LockInAuth` from the bundled client)

### Shared Libraries (`dist/libs/`)

- **`messaging.js`**: Typed message system for extension communication
- **`storage.js`**: Wrapper for chrome.storage operations
- **`initApi.js`**: Bundled `/api` TypeScript client/auth (exposes `window.LockInAPI` + `window.LockInAuth`)
- **`logger.js`**: Centralized logging utility

### Utilities

- **`config.js`**: Runtime configuration (backend URL, Supabase credentials)

## Features

### Text Selection & Processing

- Hold **Ctrl** (Windows/Linux) or **Cmd** (Mac) and highlight text
- Sidebar opens automatically with AI response
- Three processing modes:
  - **Explain**: Get clear explanations with examples

### Chat Interface

- **Chat Tab**: Clean interface for AI conversations
  - Persistent chat history per selection
  - Follow-up questions in context
  - Action buttons on assistant messages (hover to reveal):
    - **Save as note**: Pre-fills note editor with message content
    - **Generate notes**: Creates AI-drafted notes on-demand
  - Chat history panel (toggleable)
  - New chat button

### Notes Tab

- **Doc-like Editor**: Spacious note-taking interface
  - Large title input (prominent, bold)
  - Spacious textarea (150px+ min height)
  - Footer with timestamp and save button
  - Always visible (no toggle needed)

- **Filter Dropdown**: Filter notes by scope
  - "This course" - Notes from same course code (filters client-side based on current page context)
  - "All notes" - All user notes (shows all notes regardless of course or page)
  - "Starred" - Only starred notes

- **Notes List**: Display saved notes below editor
  - Click to view note details
  - Shows title, preview, and metadata

- **AI Draft Panel**: On-demand note generation
  - Appears when "Generate notes" is clicked
  - Shows bullet list of suggested notes
  - Actions:
    - **Insert into current note**: Adds bullets to editor
    - **Save each as separate note**: Creates individual notes
    - **Dismiss**: Closes panel

### Sidebar Interface

- Modern right-hand sidebar (clamped width: 320-390px at ~35vw; main content uses the remaining width when open)
- Mobile overlay instead of resizing on smaller viewports
- Tab navigation (Chat / Notes)
- Theme support (light/dark/system)
- Accent color customization

### Settings Management

- Click extension icon to open settings popup
- Sign in / Sign out via Supabase
- Choose preferred translation language
- Settings sync across devices (Chrome Sync)

### Feedback System

Users can report bugs, request features, or ask questions directly from the sidebar:

- Click the chat/feedback icon in the sidebar header
- Select feedback type: Bug Report, Feature Request, Question, Other
- Describe the issue/request
- Context is auto-captured: current URL, course code, extension version, browser

Feedback is stored in the database for review via Supabase Studio or a future admin dashboard.

## Configuration

### `config.js`

`extension/config.js` is generated from `extension/src/config.ts` during the build and reads
runtime configuration from `.env` values (Vite injects `VITE_*` variables).

**Required `.env` values (development):**

```bash
VITE_APP_ENV=development
VITE_SUPABASE_URL_DEV=https://your-dev-project.supabase.co
VITE_SUPABASE_ANON_KEY_DEV=your-dev-anon-key
VITE_BACKEND_URL_DEV=http://localhost:3000
```

**Production build values:**

```bash
VITE_APP_ENV=production
VITE_SUPABASE_URL_PROD=https://your-prod-project.supabase.co
VITE_SUPABASE_ANON_KEY_PROD=your-prod-anon-key
VITE_BACKEND_URL_PROD=https://lock-in-backend.australiaeast.azurecontainerapps.io
```

Rebuild the extension after updating `.env`.

### Error Tracking (Sentry)

The extension includes optional Sentry integration for anonymous error tracking.

**To enable:**

1. Create a Sentry project at https://sentry.io (select "Browser JavaScript")
2. Get your DSN from the project settings
3. Add `VITE_SENTRY_DSN=your-dsn` to `.env` in the project root
4. Rebuild the extension (`npm run build:ext`)

**Privacy:**

- **No user IDs** are sent to Sentry
- IP addresses are anonymized
- Only error details, stack traces, and breadcrumbs are collected
- URLs are redacted to remove auth tokens
- Disabled in development by default

**What's captured:**

- Unhandled JavaScript errors
- Stack traces (with source maps)
- Last 20 actions before the error (breadcrumbs)
- Extension version, browser info, context (sidebar/content)

### Authentication Flow

1. Open the popup and sign in with email/password
2. Session stored in Chrome Sync
3. Content script automatically attaches auth tokens to API calls
4. Tokens refresh automatically when needed

## Development

### Making Changes

1. Edit files in the `extension/` directory
2. Go to `chrome://extensions/`
3. Click refresh icon on Lock-in card
4. Reload any open webpages to see changes

### Code Structure

The extension follows best practices:

- **Separation of Concerns**: Background, content, and popup scripts are clearly separated
- **Messaging System**: Typed messages for communication between contexts
- **Storage Wrapper**: Centralized chrome.storage operations
- **API Client**: Reusable backend communication layer
- **Error Handling**: Comprehensive error handling throughout

### Key Flows in `contentScript-react.js`

- `init()` / `safeInit()`: Load adapters, API client, stored preferences, mount React sidebar bundle
- `handleSidebarToggle()`: Persist open/closed state and sync the page split class (content width = viewport minus clamped sidebar)
- `runMode(mode)`: Open sidebar on selection (Ctrl/Cmd + highlight) and update mode
- `listenToStorageChanges()`: Keep mode, open state, and active tab in sync across contexts
- `initializeReactSidebar()`: Create or update the singleton React sidebar instance

## Permissions

| Permission      | Purpose                                   |
| --------------- | ----------------------------------------- |
| `activeTab`     | Access current tab when extension clicked |
| `scripting`     | Inject content scripts into webpages      |
| `storage`       | Save user settings                        |
| `contextMenus`  | Add right-click menu items                |
| `tabs`          | Get tab information                       |
| `webNavigation` | Detect navigation events                  |

## Browser Compatibility

### Supported

- Chrome 88+
- Edge 88+ (Chromium-based)
- Brave 1.20+
- Opera 74+

### Not Supported

- Firefox (different manifest format)
- Safari (different extension system)

## Troubleshooting

### Extension Not Loading

1. Check that all files are present
2. Verify `manifest.json` is valid JSON
3. Check Chrome DevTools Console for errors

### No Response from Backend

1. Verify backend is running
2. Check `VITE_BACKEND_URL_DEV` / `VITE_BACKEND_URL_PROD` in `.env` and rebuild
3. Check Network tab in DevTools
4. Verify authentication is working

### Authentication Issues

1. Verify `VITE_SUPABASE_URL_*` and `VITE_SUPABASE_ANON_KEY_*` in `.env` and rebuild
2. Check popup for error messages
3. Try signing out and back in

### Notes Not Saving

1. Verify backend notes API is working
2. Check browser console for errors
3. Verify user is authenticated
4. Check network requests in DevTools

## License

MIT
