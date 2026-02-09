# Lock-in 🔒📚

An AI-powered Chrome extension that helps students learn more efficiently.

_Lock-in is an independent learning project by an aspiring software engineer. It is not affiliated with or endorsed by Monash University._

## Features

### AI-Powered Learning

- **Explain**: Get clear, plain-English explanations with concrete examples
- **Sidebar Interface**: Modern right-hand sidebar with chat history and persistent conversations
- **Split Layout**: Context menu prefill opens the sidebar (65/35 split with mobile overlay)
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

- `contentScript-react.js` - React-based content script that mounts the sidebar bundle, handles context menu prefill messages + Escape close, and syncs the 65/35 layout class
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
- `config/index.js` - Centralized configuration
- `routes/assistantRoutes.js` - API route definitions
- `controllers/assistant/ai.js` - Assistant request handlers
- `services/llmClient.js` - LLM integration + prompt orchestration
- `repositories/chatRepository.js` - Database operations
- `db/supabaseClient.js` - Supabase client
- `middleware/authMiddleware.js` - Authentication middleware
- `services/rateLimitService.js` - Rate limiting

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Chrome browser
- Supabase account (free tier works) OR local Supabase via Docker
- AI API key (Gemini, OpenAI, Groq, or Azure OpenAI)

### 1. Environment Setup

**Recommended: Use the automated setup script:**

```bash
.\scripts\dev\setup-local.ps1
```

This starts local Supabase, creates `.env.local`, installs dependencies, and applies migrations.

**Manual setup:**

1. Configure root environment variables (extension build):

   ```bash
   cp .env.example .env.local
   ```

   Set your `VITE_*` values in `.env.local` (see [.env.example](.env.example) for hierarchy docs).

2. Configure backend environment variables:

   ```bash
   cd backend
   cp .env.local.example .env.local  # For local Supabase
   # OR
   cp .env.example .env              # For cloud Supabase
   ```

   > ⚠️ **Key format**: Use JWT format keys (`eyJ...`), NOT short format (`sb_secret_...`)

3. Install dependencies:

   ```bash
   npm install
   ```

For full environment documentation: [docs/deployment/ENVIRONMENTS.md](docs/deployment/ENVIRONMENTS.md)

### 2. Database Setup

Start local Supabase (recommended for development):

```bash
npm run db:start    # Start local Supabase containers
npm run db:keys     # Get credentials for .env.local
npm run db:reset    # Apply migrations and seed data
```

See [docs/reference/DATABASE.md](docs/reference/DATABASE.md) for all database commands.

### 3. Backend Setup

Start the development server:

```bash
npm run dev:backend   # From root
# OR
cd backend && npm run dev
```

The server will start at `http://localhost:3000`

### 4. Chrome Extension Setup

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

#### Right-Click Context Menu

1. Highlight any text on any webpage
2. Right-click and select "Lock-in: Explain"
3. The sidebar opens and the chat input is prefilled with the highlighted text
4. Edit the text if needed, then click **Send**

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

- **Solution**: Make sure you created `backend/.env` with your API key

**Problem**: "Port 3000 already in use"

- **Solution**: Change the `PORT` in `backend/.env` or stop other services using port 3000

### Extension Issues

**Problem**: Extension not loading

- **Solution**: Check that all files are present, especially `manifest.json`

**Problem**: No response when clicking buttons

- **Solution**:
  1. Check that backend is running on `http://localhost:3000`
  2. Check Chrome DevTools Console for errors (F12)
  3. Verify `VITE_BACKEND_URL_DEV` in `.env.local` matches your backend and rebuild

**Problem**: Authentication not working

- **Solution**: Verify `VITE_SUPABASE_URL_DEV` and `VITE_SUPABASE_ANON_KEY_DEV` in `.env.local` and rebuild

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Built with ❤️ for students everywhere
