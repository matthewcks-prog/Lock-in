# Lock-in 🔒📚

An AI-powered Chrome extension that helps students learn by providing instant explanations of any text on the web.

## Features

### AI-Powered Learning

- **Explain**: Get clear, plain-English explanations with concrete examples
- **Sidebar Interface**: Modern right-hand sidebar with chat history and persistent conversations
- **Split Layout**: Ctrl/Cmd + select to open, 65/35 split with mobile overlay
- **Chat History**: Persistent chat sessions saved to Supabase

### Notes

- **Rich Text Notes**: Full-featured note editor with formatting (bold, lists, headings)
- **Autosave**: Notes save automatically as you type
- **Asset Attachments**: Upload images and files directly into notes
- **Course Organization**: Notes auto-linked to course and week based on context
- **Starred Notes**: Mark important notes for quick access

### Transcripts

- **Video Transcripts**: Extract transcripts from lecture videos (Panopto, Echo360, HTML5)
- **AI Transcription**: Transcribe videos without captions using AI
- **Multi-provider Support**: Works with Monash Panopto, Echo360, and standard HTML5 video

### Feedback

- **In-app Feedback**: Submit bug reports, feature requests, and questions
- **Auto-captured Context**: Includes page URL, course code, extension version

### Other

- **Authentication**: Secure user authentication via Supabase

## Architecture

### Extension (`extension/`)

**Core Components:**

- `contentScript-react.js` - React-based content script that mounts the sidebar bundle, handles Ctrl/Cmd selection triggers, and syncs the 65/35 layout class
- `dist/ui/index.js` - Built React sidebar bundle (source lives in `/ui/extension`)
- `background.js` - Service worker for context menus and session management
- `popup.js` - Settings and authentication UI (reads `window.LockInAuth` from the bundled client)

**Shared Modules:**

- `config.js` - Runtime configuration (generated from `.env` via Vite for backend URL + Supabase credentials)
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

### Prerequisites

- Node.js 18+ and npm
- Chrome browser
- Supabase account (free tier works)
- OpenAI API key

### 1. Environment Setup

**Important:** Follow the [ENV_SETUP.md](ENV_SETUP.md) guide for detailed environment variable configuration.

1. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` with your actual credentials:

   ```bash
   # Extension Build (VITE_ prefix required)
   VITE_SUPABASE_URL_DEV=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY_DEV=your-dev-anon-key
   VITE_BACKEND_URL_DEV=http://localhost:3000

   # Backend Server (NO VITE_ prefix)
   SUPABASE_URL_DEV=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY_DEV=your-service-role-key
   OPENAI_API_KEY=sk-proj-your-openai-key
   ```

   **Note:** `.env.local` is gitignored and contains your real secrets. Never commit it!

3. Install dependencies:

   ```bash
   npm install
   cd backend && npm install && cd ..
   ```

### 2. Backend Setup

1. Start the development server:

   ```bash
   cd backend
   npm run dev
   ```

   The server will start at `http://localhost:3000`

### 3. Chrome Extension Setup

1. Build the extension:

   ```bash
   npm run build
   ```

   This creates `extension/dist/` with all necessary files.

2. Load in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"

3. Select the `extension` folder

4. The Lock-in extension should now appear in your extensions list!

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
3. Settings are automatically saved

## API Endpoints

### `POST /api/lockin`

Main endpoint for processing text.

**Request Body:**

```json
{
  "selection": "The text to process",
  "mode": "explain | general",
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
  3. Verify `VITE_BACKEND_URL_DEV` in `.env` matches your backend and rebuild

**Problem**: Authentication not working

- **Solution**: Verify `VITE_SUPABASE_URL_DEV` and `VITE_SUPABASE_ANON_KEY_DEV` in `.env` and rebuild

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Built with ❤️ for students everywhere
