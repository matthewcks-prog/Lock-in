# CI Debugging Checklist

When CI fails, check these items in order:

## 1. Lockfile Sync (Most Common)

Is `package-lock.json` in sync with all `package.json` files?

```bash
npm ls --depth=0
```

**Fix**: Run `npm install` and commit the updated `package-lock.json`.

## 2. Node Version Match

Does CI Node version match local?

- Check `engines` in `package.json`
- CI uses Node 20 (pinned in all workflows)

## 3. Missing Environment Variables

Does CI have required secrets set in GitHub Settings → Secrets?

Required for backend tests:

- `SUPABASE_URL_DEV`
- `SUPABASE_SERVICE_ROLE_KEY_DEV`
- `OPENAI_API_KEY`

## 4. OS Differences

Linux CI vs Windows local:

- Case-sensitive file paths
- Path separators (`/` vs `\`)
- Line endings (LF vs CRLF)

## 5. Build Order

Are libs built before main build?

```bash
npm run build:libs  # Must run first
npm run build       # Then main build
```

## 6. Test Isolation

Do tests have external dependencies?

- Network requests that may be rate-limited
- Shared state between parallel tests
- Hardcoded absolute paths

## Quick Diagnosis Commands

```bash
# Verify lockfile sync
npm ls --depth=0

# Clean install (simulates CI)
rm -rf node_modules backend/node_modules
npm ci

# Full quality gate (what CI runs)
npm run validate
```
