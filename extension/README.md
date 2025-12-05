# Lock-in Chrome Extension

Chrome extension component of the Lock-in study assistant.

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select this `extension` folder
5. Done! The extension is now installed.

## Architecture

### Core Files

- **`manifest.json`**: Extension configuration (permissions, scripts, metadata)
- **`contentScript.js`**: Main orchestrator for UI and API calls
- **`lockin-sidebar.js`**: Sidebar component with resize functionality
- **`background.js`**: Service worker for context menus and session management
- **`popup.js`**: Settings and authentication UI
- **`supabaseAuth.js`**: Authentication handling

### Shared Libraries (`libs/`)

- **`messaging.js`**: Typed message system for extension communication
- **`storage.js`**: Wrapper for chrome.storage operations
- **`api.js`**: Backend API client wrapper

### Utilities

- **`chatHistoryUtils.js`**: Chat history formatting and utilities
- **`config.js`**: Runtime configuration (backend URL, Supabase credentials)

## Features

### Text Selection
- Hold **Ctrl** (Windows/Linux) or **Cmd** (Mac) and highlight text
- Sidebar opens automatically with AI response

### Three Processing Modes
- **Explain**: Get clear explanations with examples
- **Simplify**: Convert complex text to simple language
- **Translate**: Translate and explain in another language

### Sidebar Interface
- Modern right-hand sidebar
- Resizable width (280-500px)
- Chat history and persistent conversations
- Responsive design (desktop vs mobile)

### Settings Management
- Click extension icon to open settings
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

## Permissions

| Permission      | Purpose                                    |
| --------------- | ------------------------------------------ |
| `activeTab`     | Access current tab when extension clicked |
| `scripting`     | Inject content scripts into webpages      |
| `storage`       | Save user settings                         |
| `contextMenus`  | Add right-click menu items                 |
| `tabs`          | Get tab information                        |
| `webNavigation` | Detect navigation events                 |

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

## License

MIT
