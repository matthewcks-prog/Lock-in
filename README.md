# Lock-in 🔒📚

An AI-powered Chrome extension that helps students learn by providing instant explanations of any text on the web.

## Features

- **Explain**: Get clear, plain-English explanations with concrete examples
- **Sidebar Interface**: Modern right-hand sidebar with chat history and persistent conversations
- **Split Layout**: Floating toggle pill, Ctrl/Cmd + select to open, 65/35 split (max ~390px) with mobile overlay
- **Chat History**: Persistent chat sessions saved to Supabase
- **Authentication**: Secure user authentication via Supabase

## Architecture

### Extension (`extension/`)

**Core Components:**
- `contentScript-react.js` - React-based content script that mounts the sidebar bundle, handles Ctrl/Cmd selection triggers, and syncs the 65/35 layout class
- `dist/ui/index.js` - Built React sidebar bundle (source lives in `/ui/extension`)
- `background.js` - Service worker for context menus and session management
- `popup.js` - Settings and authentication UI (reads `window.LockInAuth` from the bundled client)

**Shared Modules:**
- `config.js` - Runtime configuration (backend URL, Supabase credentials)
- `messaging.js` - Typed message system for extension communication
- `storage.js` - Wrapper for chrome.storage operations
- `dist/libs/initApi.js` - Bundled `/api` TypeScript client/auth (exposes `window.LockInAPI` + `window.LockInAuth`)

### Backend (`backend/`)

**Structure:**
- `index.js` - Server entry point
- `app.js` - Express application setup
- `config.js` - Centralized configuration
- `routes/lockinRoutes.js` - API route definitions
- `controllers/lockinController.js` - Request handlers
- `openaiClient.js` - OpenAI API integration
- `chatRepository.js` - Database operations
- `supabaseClient.js` - Supabase client
- `authMiddleware.js` - Authentication middleware
- `rateLimiter.js` - Rate limiting

## Setup Instructions

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3000
   DAILY_REQUEST_LIMIT=100
   CHAT_LIST_LIMIT=5
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

   The server will start at `http://localhost:3000`

### 2. Chrome Extension Setup

1. Configure `extension/config.js`:
   ```javascript
   window.LOCKIN_CONFIG = {
     BACKEND_URL: "http://localhost:3000",
     SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
     SUPABASE_ANON_KEY: "your-anon-key",
   };
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" (toggle in top-right corner)

4. Click "Load unpacked"

5. Select the `extension` folder

6. The Lock-in extension should now appear in your extensions list!

### 3. Usage

#### Method 1: Keyboard Selection
1. Hold **Ctrl** (Windows/Linux) or **Cmd** (Mac) and highlight any text
2. The sidebar will open automatically
3. Choose your mode: **Explain** or **General**
4. View the AI-generated result in the sidebar

#### Method 2: Right-Click Context Menu
1. Highlight any text on any webpage
2. Right-click and select "Lock-in: Explain"
3. The sidebar will open with the selected mode

#### Customizing Settings
1. Click the Lock-in extension icon in Chrome's toolbar
2. Adjust your preferred language for translations
3. Set your difficulty level (High School or First-Year University)
4. Settings are automatically saved

## API Endpoints

### `POST /api/lockin`

Main endpoint for processing text.

**Request Body:**
```json
{
  "selection": "The text to process",
  "mode": "explain | general",
  "difficultyLevel": "highschool | university",
  "chatHistory": [],
  "newUserMessage": "Optional follow-up question",
  "chatId": "optional-existing-chat-id"
}
```

**Response:**
```json
{
  "chatId": "uuid",
  "mode": "explain",
  "answer": "AI-generated response",
  "chatHistory": [],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 50
  }
}
```

### `GET /api/chats`

List recent chats for authenticated user.

**Query Parameters:**
- `limit` (optional): Number of chats to return (default: 5)

### `DELETE /api/chats/:chatId`

Delete a chat and all its messages.

### `GET /api/chats/:chatId/messages`

Get all messages for a specific chat.

## Security

- ✅ API key stored only on backend server
- ✅ Extension never directly calls OpenAI
- ✅ All requests authenticated via Supabase JWT
- ✅ Rate limiting per user (configurable daily limit)
- ✅ Input validation and sanitization
- ✅ CORS configured for Chrome extensions only
- ✅ Text content not logged in production

## Development

### Backend Development

```bash
cd backend
npm run dev  # Starts with nodemon for auto-reload
```

### Extension Development

After making changes to the extension:

1. Go to `chrome://extensions/`
2. Click the refresh icon on the Lock-in extension card
3. Reload any open webpages to see changes

### Code Structure

The extension follows best practices:

- **Separation of Concerns**: Background, content, and popup scripts are clearly separated
- **Messaging System**: Typed messages for communication between contexts
- **Storage Wrapper**: Centralized chrome.storage operations
- **API Client**: Reusable backend communication layer
- **Error Handling**: Comprehensive error handling throughout

## Troubleshooting

### Backend Issues

**Problem**: "OPENAI_API_KEY not found"
- **Solution**: Make sure you created a `.env` file with your API key

**Problem**: "Port 3000 already in use"
- **Solution**: Change the PORT in `.env` or stop other services using port 3000

### Extension Issues

**Problem**: Extension not loading
- **Solution**: Check that all files are present, especially `manifest.json`

**Problem**: No response when clicking buttons
- **Solution**:
  1. Check that backend is running on `http://localhost:3000`
  2. Check Chrome DevTools Console for errors (F12)
  3. Verify `BACKEND_URL` in `config.js` matches your backend

**Problem**: Authentication not working
- **Solution**: Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `config.js`

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Built with ❤️ for students everywhere
