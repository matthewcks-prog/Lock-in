# Lock-in 🔒📚

An AI-powered Chrome extension that helps students learn by providing instant explanations, simplifications, and translations of any text on the web.

## Features

- **Explain**: Get clear, plain-English explanations with concrete examples
- **Simplify**: Convert complex academic text into easy-to-understand language
- **Translate**: Translate text into your preferred language with contextual explanations

## Project Structure

```
Lock-in/
├── backend/              # Node.js + Express API server
│   ├── index.js         # Main Express application
│   ├── openaiClient.js  # OpenAI API integration
│   ├── package.json     # Dependencies and scripts
│   └── .env.example     # Environment variables template
│
├── extension/           # Chrome Extension (Manifest V3)
│   ├── manifest.json    # Extension configuration
│   ├── contentScript.js # Text selection and UI
│   ├── contentScript.css# Styling for UI elements
│   ├── background.js    # Service worker and context menu
│   ├── popup.html       # Settings popup UI
│   ├── popup.js         # Settings logic
│   ├── popup.css        # Settings styling
│   └── icons/           # Extension icons
│
└── README.md           # This file
```

## Tech Stack

### Backend

- **Node.js** with Express
- **OpenAI API** (GPT-4o-mini, upgradeable to GPT-5 nano when available)
- **CORS** enabled for extension communication
- **dotenv** for environment configuration

### Frontend (Chrome Extension)

- **Manifest V3** (latest Chrome extension format)
- **Content Scripts** for webpage interaction
- **Service Worker** for background tasks
- **Chrome Storage API** for settings persistence
- **Vanilla JavaScript** (no framework dependencies)

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

3. Create a `.env` file from the template:

   ```bash
   cp .env.example .env
   ```

4. Add your OpenAI API key to `.env`:

   ```
   OPENAI_API_KEY=your_actual_api_key_here
   PORT=3000
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

   The server will start at `http://localhost:3000`

### 2. Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`

2. Enable "Developer mode" (toggle in top-right corner)

3. Click "Load unpacked"

4. Select the `extension` folder from this project

5. The Lock-in extension should now appear in your extensions list!

### 3. Usage

#### Method 1: Selection Bubble

1. Highlight any text on any webpage
2. A small bubble will appear with three options: **Explain**, **Simplify**, **Translate**
3. Click your desired action
4. View the AI-generated result in an overlay

#### Method 2: Right-Click Context Menu

1. Highlight any text on any webpage
2. Right-click and select "Lock-in: Explain/Simplify/Translate"
3. The selection bubble will appear
4. Choose your desired action

#### Customizing Settings

1. Click the Lock-in extension icon in Chrome's toolbar
2. Adjust your preferred language for translations
3. Set your difficulty level (High School or First-Year University)
4. Click "Save Settings"

## API Endpoints

### `POST /api/lockin`

Main endpoint for processing text.

**Request Body:**

```json
{
  "text": "The text to process",
  "mode": "explain | simplify | translate",
  "targetLanguage": "en" // Optional, for translate mode
}
```

**Response for "explain" mode:**

```json
{
  "mode": "explain",
  "answer": "Clear explanation of the text",
  "example": "A concrete example"
}
```

**Response for "simplify" mode:**

```json
{
  "mode": "simplify",
  "answer": "Simplified version of the text"
}
```

**Response for "translate" mode:**

```json
{
  "mode": "translate",
  "answer": "Translated text",
  "explanation": "Brief explanation in target language"
}
```

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

### Environment Variables

Create a `.env` file in the `backend` directory:

```env
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Optional
PORT=3000
ALLOWED_ORIGINS=chrome-extension://,http://localhost:3000
```

## Security Notes

- ✅ API key is **only** stored on the backend server
- ✅ Extension **never** directly calls OpenAI
- ✅ All requests go through your controlled backend
- ✅ Text content is not logged in production (only length and mode)
- ✅ CORS configured to accept requests from Chrome extensions

## Future Enhancements

- [ ] Add support for multiple AI models
- [ ] Implement user authentication
- [ ] Add history/favorites feature
- [ ] Support for batch processing
- [ ] Offline mode with cached responses
- [ ] Browser extension for Firefox and Edge
- [ ] Dark mode toggle
- [ ] Export/save responses
- [ ] Keyboard shortcuts

## Troubleshooting

### Backend Issues

**Problem**: "OPENAI_API_KEY not found"

- **Solution**: Make sure you created a `.env` file with your API key

**Problem**: "Port 3000 already in use"

- **Solution**: Change the PORT in `.env` or stop other services using port 3000

### Extension Issues

**Problem**: Extension not loading

- **Solution**: Make sure all files are present, especially `manifest.json`

**Problem**: No response when clicking buttons

- **Solution**:
  1. Check that backend is running on `http://localhost:3000`
  2. Check Chrome DevTools Console for errors (F12)
  3. Verify `BACKEND_URL` in `contentScript.js` matches your backend

**Problem**: Context menu not appearing

- **Solution**: Reload the extension at `chrome://extensions/`

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please open an issue on GitHub.

---

Built with ❤️ for students everywhere
