# Lock-in Troubleshooting Guide

Common issues and their solutions.

## Backend Issues

### Issue: "Cannot find module 'express'"

**Cause:** Dependencies not installed.

**Solution:**

```bash
cd backend
npm install
```

---

### Issue: "OPENAI_API_KEY not found"

**Cause:** Missing or incorrect .env file.

**Solution:**

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and add your actual OpenAI API key:
   ```
   OPENAI_API_KEY=sk-your-actual-key-here
   ```

---

### Issue: "Port 3000 already in use"

**Cause:** Another application is using port 3000.

**Solution 1 - Change Port:**
Edit `.env`:

```
PORT=3001
```

Then update `BACKEND_URL` in `extension/contentScript.js`.

**Solution 2 - Kill Process:**
Windows PowerShell:

```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

---

### Issue: "OpenAI API Error: Invalid API key"

**Cause:** API key is incorrect or expired.

**Solution:**

1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Update `.env` with the new key
4. Restart the server

---

### Issue: Backend starts but returns 500 errors

**Cause:** OpenAI API issues or rate limiting.

**Solution:**

1. Check OpenAI dashboard for account status
2. Verify you have API credits
3. Check rate limits
4. Review server logs for specific error messages

---

## Extension Issues

### Issue: Extension won't load in Chrome

**Cause:** Missing required files or invalid manifest.

**Solution:**

1. Verify all files exist in `extension/` folder
2. Check `manifest.json` for syntax errors
3. Go to `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked" and select extension folder
6. Check for error messages

---

### Issue: Bubble doesn't appear when selecting text

**Cause:** Content script not injected or JavaScript error.

**Solution:**

1. Refresh the extension at `chrome://extensions/`
2. Reload the webpage (F5)
3. Right-click on page → Inspect → Console
4. Look for JavaScript errors
5. Verify `contentScript.js` loaded in the Sources tab

---

### Issue: "Failed to fetch" or network errors

**Cause:** Backend not running or CORS issue.

**Solution:**

1. Verify backend is running: Open `http://localhost:3000/health`
2. Should see: `{"status":"ok","message":"Lock-in API is running"}`
3. Check `BACKEND_URL` in `contentScript.js` matches your backend
4. Verify `host_permissions` in `manifest.json` includes backend URL
5. Check browser console for CORS errors

---

### Issue: Context menu item doesn't appear

**Cause:** Background script not running or permission issue.

**Solution:**

1. Go to `chrome://extensions/`
2. Find Lock-in extension
3. Click "service worker" to open background script console
4. Check for errors
5. Reload the extension
6. Verify `contextMenus` permission in manifest.json

---

### Issue: Settings don't save

**Cause:** Storage permission issue.

**Solution:**

1. Verify `storage` permission in `manifest.json`
2. Check browser console for storage errors
3. Try clearing extension storage:
   - Go to `chrome://extensions/`
   - Click "Remove" on Lock-in
   - Reinstall the extension

---

### Issue: Translation doesn't work

**Cause:** Language not properly selected or sent to backend.

**Solution:**

1. Open extension settings
2. Select your preferred language
3. Click "Save Settings"
4. Try translating again
5. Check browser console for errors
6. Verify backend logs show correct targetLanguage

---

## API/Response Issues

### Issue: AI responses are slow (>10 seconds)

**Cause:** OpenAI API latency or token limits.

**Solution:**

1. Check OpenAI status: https://status.openai.com/
2. Reduce max_tokens in `openaiClient.js` (currently 500)
3. Consider using a faster model if available
4. Check your internet connection

---

### Issue: Responses are cut off or incomplete

**Cause:** Token limit reached.

**Solution:**
Edit `openaiClient.js` and increase max_tokens:

```javascript
max_tokens: 1000; // Increase from 500
```

---

### Issue: AI gives nonsensical or wrong answers

**Cause:** Unclear prompt or model hallucination.

**Solution:**

1. Improve system prompts in `openaiClient.js`
2. Add more context to user prompts
3. Increase temperature for more creative responses (current: 0.7)
4. Report specific issues to refine prompts

---

### Issue: "Rate limit exceeded" error

**Cause:** Too many requests to OpenAI API.

**Solution:**

1. Check OpenAI dashboard for rate limits
2. Implement request queuing in backend
3. Add rate limiting middleware
4. Upgrade OpenAI plan if needed
5. Consider caching common requests

---

## Browser Compatibility Issues

### Issue: Extension doesn't work in Firefox

**Cause:** Firefox uses different extension API.

**Solution:**
Firefox is not currently supported. The extension uses Chrome Manifest V3. To support Firefox:

1. Convert to Manifest V2 or use WebExtension Polyfill
2. Update background script (no service workers in Firefox yet)
3. Test all features in Firefox

---

### Issue: Extension doesn't work in Edge

**Cause:** Edge Chromium should work, but older Edge won't.

**Solution:**
Make sure you're using Edge Chromium (88+), not legacy Edge.

---

## Development Issues

### Issue: Changes to extension not appearing

**Cause:** Browser cached old version.

**Solution:**

1. Go to `chrome://extensions/`
2. Click refresh icon on Lock-in extension
3. Close and reopen any test webpages
4. Hard refresh webpages (Ctrl+Shift+R)

---

### Issue: nodemon not working

**Cause:** nodemon not installed or PATH issue.

**Solution:**

```bash
cd backend
npm install --save-dev nodemon
npm run dev
```

---

### Issue: Icons not displaying

**Cause:** Icon files missing or incorrect paths.

**Solution:**

1. Verify icon files exist in `extension/icons/`
2. Check manifest.json has correct paths
3. Icons must be PNG format
4. Create placeholder icons if needed (solid color squares work)

---

## Production Issues

### Issue: Backend works locally but not in production

**Cause:** Environment variables not set or wrong configuration.

**Solution:**

1. Verify environment variables on hosting platform
2. Check logs for specific errors
3. Test health endpoint
4. Verify CORS settings for production domain
5. Check firewall/security group settings

---

### Issue: Extension works locally but not with production backend

**Cause:** BACKEND_URL not updated or CORS issue.

**Solution:**

1. Update `BACKEND_URL` in `contentScript.js`
2. Update `host_permissions` in `manifest.json`
3. Verify backend CORS allows extension origin
4. Test production endpoint directly in browser

---

### Issue: Chrome Web Store rejected extension

**Common Reasons:**

- Missing privacy policy
- Insufficient description
- Poor quality screenshots
- Requesting unnecessary permissions
- Code obfuscation
- Malicious behavior detected

**Solution:**

1. Read rejection email carefully
2. Fix specific issues mentioned
3. Ensure privacy policy is accessible
4. Improve store listing quality
5. Resubmit with changes documented

---

## Performance Issues

### Issue: Extension slowing down browser

**Cause:** Memory leak or inefficient code.

**Solution:**

1. Open Chrome Task Manager (Shift+Esc)
2. Check Lock-in memory usage
3. Look for memory leaks in content script
4. Ensure event listeners are properly removed
5. Verify overlays are destroyed after closing

---

### Issue: High OpenAI API costs

**Cause:** Too many requests or inefficient prompts.

**Solution:**

1. Implement request caching
2. Reduce max_tokens if possible
3. Add request rate limiting
4. Monitor usage in OpenAI dashboard
5. Consider implementing user quotas
6. Optimize prompts to be more concise

---

## Getting More Help

### Debug Information to Collect

When asking for help, provide:

1. Browser version and OS
2. Extension version
3. Backend logs
4. Browser console errors
5. Network tab (show failed requests)
6. Steps to reproduce the issue

### Where to Get Help

- Check all README files
- Review code comments
- Check OpenAI documentation
- Check Chrome Extension documentation
- Open GitHub issue (if using GitHub)
- Search Stack Overflow

### Testing Tools

**Test Backend:**

```bash
# Health check
curl http://localhost:3000/health

# Test explain
curl -X POST http://localhost:3000/api/lockin \
  -H "Content-Type: application/json" \
  -d '{"text":"Test text","mode":"explain"}'
```

**Test Extension:**

1. Open DevTools (F12)
2. Go to Console tab
3. Check for errors
4. Go to Network tab
5. Try using extension
6. Check for failed requests

**Chrome Extension Debugging:**

```
chrome://extensions/         # Manage extensions
chrome://inspect/#extensions # Inspect service workers
```

---

## Quick Diagnostic Checklist

When something isn't working, check:

- [ ] Node.js installed? (`node --version`)
- [ ] Dependencies installed? (`npm install`)
- [ ] .env file exists with API key?
- [ ] Backend running? (Check http://localhost:3000/health)
- [ ] Extension loaded in Chrome?
- [ ] Developer mode enabled?
- [ ] Extension refreshed after changes?
- [ ] Webpage reloaded?
- [ ] Browser console shows errors?
- [ ] Network tab shows API calls?
- [ ] OpenAI API key valid?
- [ ] OpenAI account has credits?

---

## Still Stuck?

If you've tried everything:

1. **Start Fresh:**

   - Reinstall dependencies: `rm -rf node_modules && npm install`
   - Reload extension completely
   - Try in incognito mode
   - Try different browser profile

2. **Isolate the Problem:**

   - Test backend separately with curl
   - Test extension with mock backend
   - Check one feature at a time
   - Try on different websites

3. **Check the Basics:**

   - Restart browser
   - Restart computer
   - Update Node.js
   - Update Chrome
   - Check internet connection

4. **Review Documentation:**
   - Main README.md
   - Backend README.md
   - Extension README.md
   - OpenAI API documentation
   - Chrome Extension documentation

Remember: Most issues are simple configuration problems. Take a deep breath, read error messages carefully, and work through the checklist!
