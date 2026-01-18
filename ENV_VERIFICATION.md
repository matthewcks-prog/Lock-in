# Environment Configuration - Verification Checklist ✅

Run through this checklist to verify your environment is correctly configured.

## Pre-Flight Checks

### 1. File Structure

```bash
ls -la .env*
```

**Expected files:**

- ✅ `.env` - Safe defaults (will be committed)
- ✅ `.env.example` - Template (will be committed)
- ✅ `.env.example.local` - Extended template (will be committed)
- ✅ `.env.development` - Dev mode defaults (will be committed)
- ✅ `.env.production` - Prod mode defaults (will be committed)
- ✅ `.env.local` - **YOUR SECRETS** (gitignored)

### 2. Git Status Check

```bash
git status --short | Select-String "\.env"
```

**Expected:**

- ✅ `.env`, `.env.development`, `.env.production` - Untracked or modified (can be committed)
- ✅ `.env.local` - Should NOT appear (gitignored)
- ✅ `.env.example` - Modified (can be committed)

### 3. Security Verification

Check that `.env` has NO real secrets:

```bash
cat .env | grep -E "sk-proj-|eyJhbGc"
```

**Expected:** No matches (safe to commit)

Check that `.env.local` has your real secrets:

```bash
cat .env.local | grep VITE_SUPABASE_ANON_KEY_DEV
```

**Expected:** Shows your real Supabase anon key

### 4. Build Test

```bash
npm run build
```

**Expected output:**

- ✅ No "NODE_ENV=production is not supported" warnings
- ✅ All builds complete successfully
- ✅ Extension built to `extension/dist/`

### 5. Extension Load Test

1. Open Chrome: `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `extension` folder
5. Extension should load without errors

**Expected:**

- ✅ Extension appears in Chrome toolbar
- ✅ No console errors when clicking icon
- ✅ Sidebar opens on supported sites (Moodle, Edstem, etc.)

## Configuration Validation

### Extension Variables (VITE\_ prefix)

Check these are in `.env.local`:

```bash
cat .env.local | grep -E "VITE_SUPABASE_URL_DEV|VITE_SUPABASE_ANON_KEY_DEV|VITE_BACKEND_URL_DEV"
```

**Must have:**

- ✅ `VITE_SUPABASE_URL_DEV` - Your Supabase project URL
- ✅ `VITE_SUPABASE_ANON_KEY_DEV` - Your Supabase anon key
- ✅ `VITE_BACKEND_URL_DEV` - Backend URL (default: http://localhost:3000)

### Backend Variables (No VITE\_ prefix)

Check these are in `.env.local`:

```bash
cat .env.local | grep -E "SUPABASE_SERVICE_ROLE_KEY_DEV|OPENAI_API_KEY"
```

**Must have:**

- ✅ `SUPABASE_SERVICE_ROLE_KEY_DEV` - Service role key for backend
- ✅ `OPENAI_API_KEY` - OpenAI API key (starts with `sk-proj-`)

## Functional Tests

### Test 1: Backend Connection

```bash
cd backend
npm run dev
```

**Expected:**

- ✅ Server starts on port 3000
- ✅ No Supabase connection errors
- ✅ Can access http://localhost:3000

### Test 2: Extension Authentication

1. Load extension in Chrome
2. Click extension icon on any webpage
3. Click "Login" if not authenticated

**Expected:**

- ✅ Supabase auth popup appears
- ✅ Can sign in successfully
- ✅ Sidebar shows authenticated UI

### Test 3: Chat Functionality

1. Select text on a webpage
2. Right-click → "Explain with Lock-in"
3. Or use Ctrl/Cmd + select

**Expected:**

- ✅ Sidebar opens
- ✅ Chat tab active
- ✅ AI response appears
- ✅ Chat saved to history

### Test 4: Notes Functionality

1. Click "Notes" tab in sidebar
2. Create a new note
3. Type some content

**Expected:**

- ✅ Rich text editor loads
- ✅ Content saves automatically
- ✅ Note persists after refresh

## Troubleshooting

### Issue: "Configure VITE_SUPABASE_URL_DEV" Error

**Solution:**

1. Verify `.env.local` exists: `ls -la .env.local`
2. Check VITE* variables: `cat .env.local | grep VITE*`
3. Rebuild: `npm run build`

### Issue: "NODE_ENV=production is not supported" Warning

**Solution:**

1. Remove `NODE_ENV=` lines from `.env.local`, `.env.development`, `.env.production`
2. Keep `NODE_ENV=` only in `backend/.env` if needed
3. Rebuild: `npm run build`

### Issue: Build succeeds but extension doesn't load

**Solution:**

1. Check `extension/dist/` folder exists
2. Verify `extension/config.js` was generated
3. Check Chrome console for errors
4. Try reloading extension: Chrome → Extensions → Reload button

### Issue: Backend can't connect to Supabase

**Solution:**

1. Verify `SUPABASE_SERVICE_ROLE_KEY_DEV` in `.env.local`
2. Check backend uses correct env file: `cd backend && cat ../.env.local`
3. Restart backend: `cd backend && npm run dev`

### Issue: Extension can't authenticate

**Solution:**

1. Verify `VITE_SUPABASE_URL_DEV` and `VITE_SUPABASE_ANON_KEY_DEV` in `.env.local`
2. Rebuild extension: `npm run build`
3. Reload extension in Chrome
4. Clear browser cache and try again

## Sign-Off Checklist

Before considering setup complete, verify:

- [ ] All `.env` files exist and are correctly structured
- [ ] `.env.local` contains your real secrets (gitignored)
- [ ] `.env`, `.env.development`, `.env.production` contain only placeholders
- [ ] Build completes without warnings
- [ ] Extension loads in Chrome without errors
- [ ] Backend server starts successfully
- [ ] Can authenticate in extension
- [ ] Chat functionality works
- [ ] Notes functionality works
- [ ] All secrets are in `.env.local` (gitignored)
- [ ] No real secrets in files that will be committed

## Success Criteria

✅ **All checks passed?** You're ready to develop!

**Next steps:**

1. Start backend: `cd backend && npm run dev`
2. Load extension in Chrome
3. Test on Moodle or Edstem
4. Check [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines

## Need Help?

If any checks fail:

1. Review [ENV_SETUP.md](ENV_SETUP.md) for detailed guidance
2. Check [ENV_FIXES_SUMMARY.md](ENV_FIXES_SUMMARY.md) for what was changed
3. Verify your `.env.local` matches the structure in `.env.example`
4. Ask in Discord/Slack if you're stuck

---

**Last Updated:** January 19, 2026  
**Status:** ✅ Environment configuration complete  
**Build:** ✅ Extension builds successfully  
**Security:** ✅ Secrets properly protected
