# Smoke Test Checklist

## Overview

This is a manual smoke test checklist for the Lock-in Chrome extension. It covers critical functionality that must work after any build or refactor. **Estimated time: 5–10 minutes.**

Run this checklist:

- Before merging significant changes
- After refactoring core components
- After updating build configuration
- When preparing a release

---

## Prerequisites

- Chrome browser (or Chromium-based browser)
- Access to a supported site (Moodle, Edstem, or similar)
- Backend running locally or accessible (if testing AI/notes features)

---

## 1. Build & Load

### Steps

1. Open terminal in project root
2. Run type checking:
   ```bash
   npm run type-check
   ```
3. Run build:
   ```bash
   npm run build
   ```
4. Run build verification:
   ```bash
   npm run verify-build
   ```
5. Open Chrome → `chrome://extensions`
6. Enable "Developer mode" (top right toggle)
7. Click "Load unpacked" → select `extension/` folder
8. Open a new tab and navigate to any page

### Expected Results

| Step          | Expected                                                                              |
| ------------- | ------------------------------------------------------------------------------------- |
| type-check    | Exits with code 0, no type errors                                                     |
| build         | Exits with code 0, files generated in `extension/dist/libs/` and `extension/dist/ui/` |
| verify-build  | Exits with code 0, all expected files present                                         |
| Load unpacked | Extension loads without errors, icon visible in toolbar                               |
| New tab       | No console errors related to Lock-in; content scripts loaded on supported sites       |

### How to Verify Console

- Right-click extension icon → "Inspect popup" → Console tab (popup errors)
- `chrome://extensions` → Lock-in → "Service worker" link → Console tab (background errors)
- On any page: DevTools → Console (content script errors)

---

## 2. Selection → Sidebar → AI

### Steps

1. Navigate to a supported page (e.g., Moodle course page, Edstem)
2. Hold **Ctrl** (Windows/Linux) or **Cmd** (Mac) and select some text on the page
3. The sidebar should open automatically with the selected text
4. Verify the selected text appears in the sidebar input or context
5. Trigger a mode: click "Explain" or "General"
6. Wait for AI response
7. Note the chat ID (if visible in UI or console)
8. Refresh the page
9. Reopen sidebar

### Expected Results

| Step                   | Expected                                                |
| ---------------------- | ------------------------------------------------------- |
| Ctrl/Cmd + select text | Sidebar opens, selection captured in context            |
| Trigger mode           | Loading indicator shown, request sent to backend        |
| AI response            | Message renders correctly, no JSON/HTML escaping issues |
| Refresh + reopen       | Chat ID persists, conversation history visible          |

---

## 3. Notes Create/Edit/Save

### Steps

1. Open the sidebar
2. Navigate to the Notes tab
3. Click "New Note" (or equivalent)
4. Type some content in the editor (include formatting: bold, bullet list)
5. Wait 2–3 seconds for autosave (or manually save if button exists)
6. Refresh the page
7. Reopen sidebar → Notes tab
8. Open the same note

### Expected Results

| Step             | Expected                                                      |
| ---------------- | ------------------------------------------------------------- |
| Create note      | New note appears in list, editor opens                        |
| Type content     | Editor responds, formatting applied correctly                 |
| Autosave         | Save indicator shows success (if visible)                     |
| Refresh + reopen | Note persists in list                                         |
| Open note        | Content matches what was typed, no corruption or missing text |

---

## 4. Assets Upload/List/Delete

### Steps

1. Open a note in the editor
2. Upload an image file (PNG, JPG, or GIF)
3. Verify image appears in the editor
4. Upload a non-image attachment (PDF, DOCX, or similar)
5. Verify attachment appears as an attachment node (not inline image)
6. Delete one asset (via UI delete button or context menu)
7. Verify asset is removed from the editor

### Expected Results

| Step                     | Expected                                                  |
| ------------------------ | --------------------------------------------------------- |
| Upload image             | Image inserts as `ImageNode`, displays inline             |
| Upload document          | Document inserts as `AttachmentNode`, shows filename/icon |
| Delete asset             | Asset removed from editor, no orphan references           |
| Backend check (optional) | Asset removed from storage bucket (Supabase)              |

---

## 5. Session Restore

### Steps

1. Open sidebar with an active chat or note
2. Note the current state (which tab is open, chat ID, note ID)
3. Refresh the browser tab
4. Observe sidebar behavior

### Expected Results

| Step          | Expected                                            |
| ------------- | --------------------------------------------------- |
| Refresh       | Page reloads without errors                         |
| Sidebar state | Sidebar open/closed state restores as designed      |
| Chat/note ID  | Active chat or note ID is restored, content visible |

**Note:** Session restore behavior may vary by design (some implementations reopen automatically, others require user action). Verify against current intended behavior.

---

## 6. Popup Checks (Quick)

### Steps

1. Click the Lock-in extension icon in the toolbar
2. Observe popup loads
3. Check for settings or auth state display (if applicable)

### Expected Results

| Step          | Expected                                                 |
| ------------- | -------------------------------------------------------- |
| Click icon    | Popup opens without crash                                |
| Settings load | Settings visible and interactive                         |
| Auth state    | If auth implemented, shows logged in/out state correctly |

---

## Debug Tips

### Where to Check Logs

| Context                       | How to Access                                                               |
| ----------------------------- | --------------------------------------------------------------------------- |
| **Background/Service Worker** | `chrome://extensions` → Lock-in → "Service worker" link → Console           |
| **Popup**                     | Right-click extension icon → "Inspect popup" → Console                      |
| **Content Script (page)**     | DevTools on page → Console (filter by "Lock-in" or look for extension logs) |
| **Sidebar (if iframe)**       | Right-click sidebar → "Inspect" → Console                                   |

### Common Failure Points

| Issue                               | Likely Cause                                                      | Fix                                                   |
| ----------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| Content script not loading          | Manifest `content_scripts` misconfigured, URL pattern mismatch    | Check `manifest.json` matches patterns                |
| `undefined` globals                 | Build didn't run, or `contentLibs.js` not injected before sidebar | Run `npm run build`, check injection order            |
| API calls failing                   | Backend URL wrong, CORS issue, auth token missing                 | Check `config.js`, backend logs, network tab          |
| Sidebar blank                       | React/Preact not bundled, missing entry point                     | Check `extension/dist/ui/` has built files            |
| "Cannot read property of undefined" | Missing dependency injection, adapter not registered              | Check adapter registration in `integrations/index.ts` |
| State not persisting                | `chrome.storage` permissions missing, storage key mismatch        | Check `manifest.json` permissions, storage keys       |

### Quick Sanity Checks

```javascript
// In page console - check if content script loaded
console.log(window.__LOCKIN_LOADED__);

// In background console - check service worker active
console.log('Background active');

// Check storage state
chrome.storage.local.get(null, (data) => console.log(data));
```

---

## Checklist Summary

Use this quick checklist for fast verification:

- [ ] `npm run type-check` passes
- [ ] `npm run build` passes
- [ ] `npm run verify-build` passes
- [ ] Extension loads in Chrome without errors
- [ ] Sidebar opens on supported site
- [ ] Text selection captured
- [ ] AI mode triggers and returns response
- [ ] Chat persists after refresh
- [ ] Note creates, edits, and saves
- [ ] Note content persists after refresh
- [ ] Image uploads as ImageNode
- [ ] Attachment uploads as AttachmentNode
- [ ] Asset deletion works
- [ ] Session state restores after refresh
- [ ] Popup loads without crash

---

## Version History

| Date       | Change                               |
| ---------- | ------------------------------------ |
| 2024-12-14 | Initial checklist created (Phase B4) |
