# MCP Smoke Tests

Run these 12 test prompts in Cursor to validate MCP server functionality.

## Test 1: Filesystem Navigation

**Prompt**: "Find all transcript extraction entrypoints across providers"
**Expected**: Lists files in `core/transcripts/providers/` (panoptoProvider.ts, echo360Provider.ts, etc.)

## Test 2: Git History

**Prompt**: "Show last 10 commits affecting Panopto/Echo handlers"
**Expected**: Git log filtered by `core/transcripts/providers/panoptoProvider.ts` and `echo360Provider.ts`

## Test 3: Code Search

**Prompt**: "Find all places where transcript providers are registered"
**Expected**: Shows `core/transcripts/index.ts` and `core/transcripts/providerRegistry.ts`

## Test 4: Build Verification

**Prompt**: "Run npm run type-check and report any errors"
**Expected**: TypeScript type-check completes, shows 0 errors (or lists specific errors)

## Test 5: Backend API Test

**Prompt**: "Call GET http://localhost:3000/health and validate the response schema"
**Expected**: Fetch succeeds, returns `{"status": "ok"}` or similar

## Test 6: Database Query

**Prompt**: "Query the database for the latest transcript row, showing user_id, fingerprint, and created_at"
**Expected**: SELECT query on `transcripts` table, returns latest row (or empty if no data)

## Test 7: Extension Build

**Prompt**: "Run npm run build and verify all extension bundles are generated"
**Expected**: Build completes, `extension/dist/ui/` and `extension/dist/libs/` contain built files

## Test 8: Test Execution

**Prompt**: "Run npm test and summarize any failing tests"
**Expected**: Vitest runs, reports 143 tests passing (or lists failures)

## Test 9: Playwright Extension Test

**Prompt**: "Create a Playwright script that loads the extension, navigates to learning.monash.edu, and confirms the sidebar UI is injected"
**Expected**: Playwright script created/executed, confirms `window.LockInUI` exists on page

## Test 10: Adapter Search

**Prompt**: "Find all site adapter implementations and list their canHandle URL patterns"
**Expected**: Lists `integrations/adapters/moodleAdapter.ts`, `edstemAdapter.ts`, shows URL patterns

## Test 11: API Endpoint Discovery

**Prompt**: "List all backend API routes and their HTTP methods"
**Expected**: Shows routes from `backend/routes/lockinRoutes.js`, `noteRoutes.js`, `transcriptsRoutes.js`

## Test 12: Database Schema Validation

**Prompt**: "Query the database to list all tables in the public schema and their row counts"
**Expected**: Shows tables (chats, chat_messages, notes, note_assets, transcripts, etc.) with counts

## Quick Connection Tests

Before running full smoke tests, verify each MCP server is connected:

- "List files in core/transcripts/providers" (filesystem)
- "Show git log --oneline -5" (git)
- "Run npm --version" (shell)
- "Take a screenshot of localhost:3000/health" (playwright)
- "Fetch http://localhost:3000/health" (fetch)
- "SELECT COUNT(\*) FROM notes" (postgres)
