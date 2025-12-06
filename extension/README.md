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
- **`contentScript.js`**: Main orchestrator for UI and API calls (~2500 lines)
- **`lockin-sidebar.js`**: Sidebar component with resize functionality
- **`background.js`**: Service worker for context menus and session management
- **`popup.js`**: Settings and authentication UI
- **`supabaseAuth.js`**: Authentication handling

### Shared Libraries (`libs/`)

- **`messaging.js`**: Typed message system for extension communication
- **`storage.js`**: Wrapper for chrome.storage operations
- **`api.js`**: Backend API client wrapper (chat, notes, search)
- **`logger.js`**: Centralized logging utility

### Utilities

- **`chatHistoryUtils.js`**: Chat history formatting and utilities
- **`config.js`**: Runtime configuration (backend URL, Supabase credentials)

## Features

### Text Selection & Processing

- Hold **Ctrl** (Windows/Linux) or **Cmd** (Mac) and highlight text
- Sidebar opens automatically with AI response
- Three processing modes:
  - **Explain**: Get clear explanations with examples
  - **Simplify**: Convert complex text to simple language
  - **Translate**: Translate and explain in another language

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
  - "This page" - Notes from current URL
  - "This course" - Notes from same course code
  - "All notes" - All user notes

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

- Modern right-hand sidebar (30% viewport width)
- Resizable width (280-500px on desktop)
- Responsive design (desktop vs mobile)
- Tab navigation (Chat / Notes)
- Theme support (light/dark/system)
- Accent color customization

### Settings Management

- Click extension icon to open settings popup
- Sign in / Sign out via Supabase
- Choose preferred translation language
- Set difficulty level
- Settings sync across devices (Chrome Sync)

## Configuration

### `config.js`

All runtime URLs live in `extension/config.js`:

```javascript
window.LOCKIN_CONFIG = {
  BACKEND_URL: "http://localhost:3000",
  SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "your-anon-key",
};
```

Update these values before loading the extension.

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

### Key Functions in `contentScript.js`

- `init()`: Initialization and event setup
- `runMode(mode)`: Process text with selected mode
- `buildChatSection()`: Render chat interface
- `buildNotesSection()`: Render notes interface
- `loadNotes(filter)`: Load and display notes
- `saveChatAsNote()`: Save chat message as note
- `showAiDraftNotes()`: Display AI-generated notes
- `attachChatActionListeners()`: Handle chat action buttons
- `attachNewNoteEditorListeners()`: Handle note editor interactions

## Permissions

| Permission      | Purpose                                    |
| --------------- | ------------------------------------------ |
| `activeTab`     | Access current tab when extension clicked  |
| `scripting`     | Inject content scripts into webpages      |
| `storage`       | Save user settings                         |
| `contextMenus`  | Add right-click menu items                 |
| `tabs`          | Get tab information                        |
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
2. Check `BACKEND_URL` in `config.js`
3. Check Network tab in DevTools
4. Verify authentication is working

### Authentication Issues
1. Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `config.js`
2. Check popup for error messages
3. Try signing out and back in

### Notes Not Saving
1. Verify backend notes API is working
2. Check browser console for errors
3. Verify user is authenticated
4. Check network requests in DevTools

## License

MIT
