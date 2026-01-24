# Repository Map

Purpose: Quick orientation for humans/AI. For current implementation details, see `CODE_OVERVIEW.md`.

## Tree (max 4 levels)

```
backend/
  index.js, app.js, routes/, controllers/, middleware/, migrations/
core/
  domain/, services/, storage/, errors/, utils/, transcripts/
api/
  client.ts, auth.ts
integrations/
  adapters/, index.ts, __tests__/
extension/
  manifest.json, contentScript-react.js, background.js, popup.js
  content/ (pageContext, stateStore, sidebarHost, sessionManager, interactions)
  src/ (initApi.ts, contentLibs.ts, chromeStorage.ts, logger.ts, messaging.ts)
  dist/
    libs/ (build outputs: initApi.js, contentLibs.js, webvttParser.js, transcriptProviders.js, maps)
    ui/   (build output: index.js + map)
ui/
  extension/ (index.tsx, LockInSidebar.tsx, sidebar/, chat/, notes/, hooks/)
shared/
  ui/components/ (Button, Card, ConfirmDialog, Toast, TextInput, Tabs)
docs/
  README.md, AI_SERVICES_ARCHITECTURE.md, CI_CHECKLIST.md, MONOREPO.md
  TRANSCRIPT_TROUBLESHOOTING.md (legacy; canonical in docs/features/transcripts/TROUBLESHOOTING.md)
  architecture/ (ARCHITECTURE.md, REPO_MAP.md)
  tracking/ (STATUS.md, REFACTOR_PLAN.md, PROMPT_LOG.md, AI_SERVICES_REFACTOR_2026-01-19.md)
  testing/ (SMOKE_CHECKLIST.md, BACKEND_TESTING.md)
  features/
    transcripts/ (REVIEW.md, SYSTEM_MAP.md, TROUBLESHOOTING.md)
  setup/ (LOCAL_SUPABASE_SETUP.md, ENVIRONMENT_SETUP.md, ENV_QUICK_REFERENCE.md, ENV_SECURITY_FIXES.md, CODE_FORMATTING.md)
  deployment/ (AUDIT_SUMMARY.md, AZURE.md, CICD.md, DEPLOYMENT_CHECK.md, DEPLOYMENT_REVIEW.md, ENVIRONMENTS.md, FIX_DEPLOYMENT_ISSUE.md, README.md, ROLLBACK.md)
  archive/ (QUALITY_AUDIT_2025-12-16.md)
  achieve/ (legacy; typo - audit doc)
tools/
  mcp/ (MCP server setup, configs, scripts for AI assistant tooling)
```

## Entrypoints & Outputs

- **Extension content script**: `extension/contentScript-react.js` (injects sidebar and loads `extension/dist/ui/index.js`).
- **Sidebar UI source**: `ui/extension/index.tsx` (renders `<LockInSidebar />`); builds to `extension/dist/ui/index.js`.
- **API/auth bundle**: `extension/src/initApi.ts` → `extension/dist/libs/initApi.js` (`window.LockInAPI` / `window.LockInAuth`).
- **Content helpers bundle**: `extension/src/contentLibs.ts` → `extension/dist/libs/contentLibs.js` (`window.LockInContent.*`).
- **Backend**: `backend/index.js` (Express server bootstraps from `app.js`).

## Transcript System

- **Detection**: `core/transcripts/videoDetection.ts` (Panopto/Echo360/HTML5 DOM detection)
- **Providers**: `core/transcripts/providers/` (Panopto, Echo360) - business logic, no Chrome APIs
- **Fetcher interfaces**: `core/transcripts/fetchers/types.ts` (AsyncFetcher, EnhancedAsyncFetcher)
- **Extraction**: Provider `extractTranscript(video, fetcher)` methods
- **Extension fetcher**: `extension/background.js` (ExtensionFetcher class - Chrome-specific CORS/credentials)
- **Background routing**: `extension/background.js` (handleTranscriptExtraction - delegates to provider)
- **UI hooks**: `ui/extension/transcripts/hooks/` (useTranscripts - React state management)

## Build Commands (npm scripts)

- `npm run build:initApi` → `extension/dist/libs/initApi.js`
- `npm run build:contentLibs` → `extension/dist/libs/contentLibs.js`
- `npm run build:transcriptProviders` -> `extension/dist/libs/transcriptProviders.js`
- `npm run build` (or `build:extension`) → builds libs then `extension/dist/ui/index.js`
- `npm run verify-build` → `type-check` + `build`
- `npm run type-check` → `tsc --noEmit`

**Note:** `extension/dist/ui/**` and `extension/dist/libs/**` are build outputs—do not hand-edit.

## Tests & Guardrails

- Unit tests: `core/utils/__tests__/`, `integrations/adapters/__tests__/` (vitest, jsdom).
- Guardrail commands: `npm run lint`, `npm run test`, `npm run type-check`, `npm run build`, `npm run verify-build`.
- Manual: see `docs/testing/SMOKE_CHECKLIST.md` (run §1 for build/load sanity).

## MCP Tooling

- **MCP servers**: `tools/mcp/` contains setup for AI assistant tooling (Cursor AI).
- **Documentation**: See `tools/mcp/README.md` for setup guide.
- **One-time setup**: Copy `mcp.json.template` to your IDE's config location and update paths.
