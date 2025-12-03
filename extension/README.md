# Lock-in Chrome Extension

Chrome extension component of the Lock-in study assistant.

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select this `extension` folder
5. Done! The extension is now installed.

## Files Overview

### Core Files

- **manifest.json**: Extension configuration (permissions, scripts, metadata)
- **contentScript.js**: Handles text selection and displays UI on webpages
- **contentScript.css**: Styles for the selection bubble and result overlay
- **background.js**: Service worker for context menus and background tasks
- **popup.html**: Settings interface HTML
- **popup.js**: Settings logic and storage
- **popup.css**: Settings interface styles

### Icons

- **icons/**: Contains extension icons (16x16, 48x48, 128x128)

## Features

### 1. Text Selection Interface

- Select text on any webpage
- Automatic floating bubble appears with options
- Clean, non-intrusive design

### 2. Three Processing Modes

- **Explain**: Get clear explanations with examples
- **Simplify**: Convert complex text to simple language
- **Translate**: Translate and explain in another language

### 3. Right-Click Context Menu

- Right-click selected text
- Choose "Lock-in: Explain/Simplify/Translate"

### 4. Settings Management

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
  SUPABASE_ANON_KEY: "public-anon-key",
};
```

Update these values before loading the extension:

- `BACKEND_URL`: your deployed Lock-in backend.
- `SUPABASE_URL`: the Supabase project URL (copy from Settings -> API).
- `SUPABASE_ANON_KEY`: the public anon key (same settings page).

### Authentication Flow

1. Load the extension, then open the popup.
2. Enter your email/password in the **Lock-in Account** section and click **Sign In**. If the email is new, we create an account automatically.
3. The popup stores the session (access + refresh tokens) in Chrome Sync.
4. The content script automatically attaches `Authorization: Bearer <token>` to every `/api/lockin` call and refreshes when needed.
5. Use **Sign Out** in the popup to clear the session.

If you see "Configure SUPABASE_URL and SUPABASE_ANON_KEY", update `config.js` with real values.

### Host Permissions

`manifest.json` must include both the backend and Supabase domains:

```json
"host_permissions": [
  "http://localhost:3000/*",
  "https://*.supabase.co/*"
]
```

## Customization

### Styling

Edit `contentScript.css` to change:

- Bubble appearance and colors
- Overlay design
- Button styles
- Animations

### Language Options

Add more languages in `popup.html`:

```html
<option value="hi">Hindi (Hindi)</option>
<option value="ar">Arabic (Arabic)</option>
```

### Keyboard Shortcuts

Add to `manifest.json`:

```json
"commands": {
  "explain": {
    "suggested_key": {
      "default": "Ctrl+Shift+E"
    },
    "description": "Explain selected text"
  }
}
```

## Testing

### 1. Test on Different Websites

- Try on Wikipedia, news sites, academic papers
- Verify bubble positioning works correctly
- Check overlay responsiveness

### 2. Check Console Logs

1. Right-click on page -> "Inspect"
2. Go to "Console" tab
3. Look for any errors

### 3. Test All Modes

- Highlight text and test "Explain"
- Highlight text and test "Simplify"
- Change language and test "Translate"

### 4. Test Settings

- Open popup
- Change language
- Change difficulty level
- Verify settings are saved

## Permissions Explained

| Permission         | Purpose                                      |
| ------------------ | -------------------------------------------- |
| `activeTab`        | Access current tab when extension is clicked |
| `scripting`        | Inject content scripts into webpages         |
| `storage`          | Save user settings                           |
| `contextMenus`     | Add right-click menu items                   |
| `host_permissions` | Make requests to backend API                 |

## Chrome Storage

Settings are stored using `chrome.storage.sync`:

- Automatically syncs across devices
- Persists after browser restart
- Max 100KB per extension

### Storage Structure

```javascript
{
  preferredLanguage: "en",  // Language code
  difficultyLevel: "highschool" // or "university"
}
```

## Debugging Tips

### Extension Not Working

1. Check if backend is running
2. Refresh extension at `chrome://extensions/`
3. Check Developer Console for errors

### Bubble Not Appearing

1. Make sure content script loaded (check Console)
2. Try selecting text slowly
3. Check if page blocks content scripts

### No Response from Backend

1. Check `BACKEND_URL` in `contentScript.js`
2. Verify backend is running
3. Check Network tab in DevTools
4. Verify CORS is enabled on backend

### Context Menu Missing

1. Reload extension
2. Check background service worker console
3. Verify `contextMenus` permission in manifest

## Browser Compatibility

### Supported

- Chrome 88+
- Edge 88+ (Chromium-based)
- Brave 1.20+
- Opera 74+

### Not Supported

- Firefox (different manifest format)
- Safari (different extension system)

To support Firefox, you would need to:

1. Convert to Manifest V2 or use WebExtension polyfill
2. Update permissions format
3. Adjust background script

## Publishing to Chrome Web Store

### Prerequisites

1. Google Developer account ($5 one-time fee)
2. Privacy policy URL
3. Store listing assets (screenshots, descriptions)

### Steps

1. Update icons with professional designs
2. Create promotional images (1280x800, 640x400)
3. Write store description and screenshots
4. Zip the extension folder
5. Upload to Chrome Web Store Developer Dashboard
6. Fill in store listing details
7. Submit for review

### Before Publishing

- [ ] Replace placeholder icons
- [ ] Update backend URL to production
- [ ] Remove console.log statements
- [ ] Test on multiple websites
- [ ] Add privacy policy
- [ ] Add user analytics (optional)

## Privacy Considerations

- Extension only processes text when user explicitly selects it
- No automatic data collection
- Settings stored locally/synced via Chrome
- Backend communication only when user triggers an action
- No tracking or telemetry in this version

## Updates

### Version 1.0.0

- Initial release
- Explain, Simplify, Translate modes
- Settings management
- Context menu integration

### Future Versions

- [ ] v1.1.0: Keyboard shortcuts
- [ ] v1.2.0: Response history
- [ ] v1.3.0: Dark mode
- [ ] v2.0.0: Offline mode

## Development Workflow

1. Make changes to extension files
2. Go to `chrome://extensions/`
3. Click refresh icon on Lock-in card
4. Test changes on a webpage
5. Check console for errors
6. Iterate

## File Size Limits

Chrome Web Store limits:

- Total package: 100 MB
- Individual file: 50 MB

Current extension size: ~50 KB (very small!)

## Icons

Current icons are simple placeholders. Replace them with:

- Professional design
- Recognizable at small sizes
- Matches brand colors (#667eea, #764ba2)
- Clear on light and dark backgrounds

## License

MIT

## Support

For issues with the extension:

1. Check this README
2. Check main project README
3. Open an issue on GitHub
