# Quick Start Guide - Lock-in

Get up and running in 5 minutes!

## Step 1: Backend Setup (2 minutes)

```bash
# Navigate to backend folder
cd backend

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=sk-your-key-here

# Start the server
npm run dev
```

You should see:

```
Lock-in backend server running on http://localhost:3000
Ready to help students learn!
```

## Step 2: Install Chrome Extension (1 minute)

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `extension` folder from this project
6. Done!

## Step 3: Test It Out! (2 minutes)

1. Go to any webpage (try Wikipedia)
2. Highlight some text
3. Click one of the three buttons that appear:
   - **Explain** - Get a clear explanation
   - **Simplify** - Make it easier to understand
   - **Translate** - Convert to another language

## Get Your OpenAI API Key

Don't have an OpenAI API key yet?

1. Go to https://platform.openai.com/
2. Sign up or log in
3. Navigate to API Keys section
4. Click "Create new secret key"
5. Copy the key and paste it in your `.env` file

## Configuration Options

### Change Translation Language

1. Click the Lock-in extension icon in Chrome toolbar
2. Select your preferred language
3. Click "Save Settings"

### Change Backend URL (for production)

Edit `extension/contentScript.js`:

```javascript
const BACKEND_URL = "https://your-backend-url.com";
```

## Troubleshooting

### Backend won't start?

- Make sure Node.js is installed: `node --version`
- Check that port 3000 is free
- Verify your `.env` file exists and has the API key

### Extension not working?

- Refresh the extension at `chrome://extensions/`
- Make sure backend is running
- Check browser console for errors (F12)

### No response when clicking buttons?

- Verify backend is running on http://localhost:3000
- Test backend: Open `http://localhost:3000/health` in browser
- Should see: `{"status":"ok","message":"Lock-in API is running"}`

## What's Next?

- Customize the UI colors in `extension/contentScript.css`
- Add more languages in `extension/popup.html`
- Deploy backend to production (Heroku, AWS, etc.)
- Replace placeholder icons with your design

## Need Help?

- Check the main `README.md` for detailed documentation
- Check `backend/README.md` for API documentation
- Check `extension/README.md` for extension details
- Open an issue on GitHub

## Project Structure

```
Lock-in/
  backend/          <- Node.js API server
  extension/        <- Chrome extension files
  README.md         <- Full documentation
  QUICKSTART.md     <- This file
```

Happy learning!
