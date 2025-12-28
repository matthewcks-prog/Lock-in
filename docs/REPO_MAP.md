# Repository Map

Purpose: Quick orientation for humans/AI. For current implementation details, see `CODE_OVERVIEW.md`.

## Tree (max 4 levels)
```
backend/
  index.js, app.js, routes/, controllers/, middleware/, migrations/
core/
  domain/, services/, storage/, errors/, utils/
api/
  client.ts, auth.ts
integrations/
  adapters/, index.ts, __tests__/
extension/
  manifest.json, contentScript-react.js, background.js, popup.js
  content/ (pageContext, stateStore, sidebarHost, sessionManager, interactions)
  src/ (initApi.ts, contentLibs.ts, chromeStorage.ts, logger.ts, messaging.ts)
  dist/
    libs/ (build outputs: initApi.js, contentLibs.js, webvttParser.js, maps)
    ui/   (build output: index.js + map)
ui/
  extension/ (index.tsx, LockInSidebar.tsx, notes/, hooks/)
shared/
  ui/components/ (Button, Card, ConfirmDialog, Toast, TextInput, Tabs)
docs/
  AGENTS.md, ARCHITECTURE.md, REPO_MAP.md, STATUS.md, REFACTOR_PLAN.md, PROMPT_LOG.md, SMOKE_CHECKLIST.md
```

## Entrypoints & Outputs
- **Extension content script**: `extension/contentScript-react.js` (injects sidebar and loads `extension/dist/ui/index.js`).
- **Sidebar UI source**: `ui/extension/index.tsx` (renders `<LockInSidebar />`); builds to `extension/dist/ui/index.js`.
- **API/auth bundle**: `extension/src/initApi.ts` → `extension/dist/libs/initApi.js` (`window.LockInAPI` / `window.LockInAuth`).
- **Content helpers bundle**: `extension/src/contentLibs.ts` → `extension/dist/libs/contentLibs.js` (`window.LockInContent.*`).
- **Backend**: `backend/index.js` (Express server bootstraps from `app.js`).

## Build Commands (npm scripts)
- `npm run build:initApi` → `extension/dist/libs/initApi.js`
- `npm run build:contentLibs` → `extension/dist/libs/contentLibs.js`
- `npm run build` (or `build:extension`) → builds libs then `extension/dist/ui/index.js`
- `npm run verify-build` → `type-check` + `build`
- `npm run type-check` → `tsc --noEmit`

**Note:** `extension/dist/ui/**` and `extension/dist/libs/**` are build outputs—do not hand-edit.

## Tests & Guardrails
- Unit tests: `core/utils/__tests__/`, `integrations/adapters/__tests__/` (vitest, jsdom).
- Guardrail commands: `npm run lint`, `npm run test`, `npm run type-check`, `npm run build`, `npm run verify-build`.
- Manual: see `docs/SMOKE_CHECKLIST.md` (run §1 for build/load sanity).
