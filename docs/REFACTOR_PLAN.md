# Refactor Plan v2.0 (Post-Audit)

Comprehensive refactor plan based on consolidated audit findings (Batch 1 + Batch 2).

**Audit Date:** January 2026  
**Overall Health Score:** 7.5/10  
**Safe to Continue Development:** YES, with conditions

---

## Phase B: File Size Reduction

**Priority:** 🟠 HIGH — Critical for maintainability  
**Timeline:** Sprint 1-2 (1-2 weeks)

### B1. NoteEditor.tsx Decomposition (1039 lines → <200)
Current: `ui/extension/notes/NoteEditor.tsx` — 5x over limit

- [ ] Extract `LexicalConfig.ts` — theme, node registration
- [ ] Extract `EditorToolbar.tsx` — toolbar UI and format handlers
- [ ] Extract `EditorPlugins.tsx` — plugin composition
- [ ] Extract `ColorPicker.tsx` — color selection UI
- [ ] Refactor `NoteEditor.tsx` to orchestrator only (<200 lines)

### B2. echo360Provider.ts Decomposition (939 lines → <200)
Current: `core/transcripts/providers/echo360Provider.ts` — 5x over limit

- [ ] Extract `echo360Detection.ts` — detection logic
- [ ] Extract `echo360Extraction.ts` — extraction logic
- [ ] Extract `echo360Types.ts` — shared types
- [ ] Refactor provider as composition layer (<200 lines)

### B4. panoptoProvider.ts Decomposition (666 lines → <200)
Current: `core/transcripts/providers/panoptoProvider.ts` — 3x over limit

- [ ] Extract detection logic
- [ ] Extract extraction logic
- [ ] Extract helper modules
- [ ] Refactor provider as composition layer (<200 lines)

### B5. useNoteEditor.ts Decomposition (633 lines → <200)
Current: `ui/hooks/useNoteEditor.ts` — 3x over limit

- [ ] Extract `useOfflineQueue.ts` — offline queue logic
- [ ] Extract `useAutosave.ts` — autosave logic
- [ ] Extract `useConflictResolution.ts` — conflict handling
- [ ] Refactor `useNoteEditor.ts` as composition hook (<200 lines)

### B6. Secondary File Reductions
- [ ] `core/transcripts/videoDetection.ts` (403 lines) — split by provider
- [ ] `core/transcripts/parsers/echo360Parser.ts` (458 lines) — split by response type
- [ ] `ui/extension/notes/NotesPanel.tsx` (515 lines) — extract components

---

## Phase C: Type Safety Improvement

**Priority:** 🟠 HIGH — Reduce 126 `any` warnings to 0  
**Timeline:** Sprint 2-3 (1-2 weeks)

### C1. API Boundaries (22 warnings)
- [ ] Type `api/resources/notesClient.ts` — `RawNoteResponse` interface
- [ ] Type `api/resources/chatsClient.ts` — `RawChatResponse` interface
- [ ] Type `api/resources/assetsClient.ts` — `RawNoteAssetResponse` interface
- [ ] Add proper generics to `apiRequest<T>()`

### C2. Storage Interface (5 warnings)
- [ ] Type `core/storage/storageInterface.ts` callbacks
- [ ] Replace `any` with `Record<string, { oldValue?: unknown; newValue?: unknown }>`
- [ ] Add proper generics to `get<T>()`

### C3. Error Handling (10 warnings)
- [ ] Type catch block errors as `unknown`
- [ ] Use type guards for error checking
- [ ] Type `api/fetcher.ts` error handling

### C4. Extension Code (19 warnings)
- [ ] Type `extension/src/*.ts` files
- [ ] Type storage callbacks in `chromeStorage.ts`
- [ ] Type runtime callbacks in `contentRuntime.ts`

### C5. Services Layer (10 warnings)
- [ ] Type `core/services/notesService.ts` raw API responses
- [ ] Add `RawNoteResponse` interface with validation
- [ ] Type embedding as `number[]` in `core/domain/types.ts`

### C6. UI Components (30+ warnings)
- [ ] Type event handlers properly
- [ ] Replace `any` props with specific interfaces
- [ ] Type `NoteEditor.tsx` (3 warnings)

### C7. Remaining Warnings
- [ ] Reduce from 126 to <50 warnings
- [ ] Reduce from <50 to 0 warnings

---

## Phase D: Test Coverage Expansion

**Priority:** 🟡 MEDIUM — Critical for regression prevention  
**Timeline:** Sprint 3-4 (2 weeks)

### D1. Hook Tests (Currently: 0 tests)
- [ ] Add `useNoteEditor.test.ts` — autosave, offline queue, conflict handling
- [ ] Add `useNotesList.test.ts` — filtering, CRUD operations
- [ ] Add `useChat.test.ts` — message handling, streaming
- [ ] Add `useChatInput.test.ts` — keyboard handling, send logic

### D2. Component Tests (Currently: 1 test)
- [ ] Add `NotesPanel.test.tsx` — filtering, selection, CRUD
- [ ] Add `NoteEditor.test.tsx` — toolbar actions, content changes
- [ ] Add `FeedbackModal.test.tsx` — form validation
- [ ] Add `ChatSection.test.tsx` — message rendering
- [x] Add chat history + send reliability tests (pagination, dedup, rate limit)

### D3. Integration Tests
- [ ] Add API endpoint tests for fetcher retry logic
- [ ] Add adapter edge case tests (Moodle URL patterns)
- [ ] Add message type contract tests (content script ↔ background)
- [x] Add backend chat pagination + attachment validation tests
- [x] Add backend test shims to keep TypeScript checks green for JS modules

### D4. Coverage Targets
- [ ] Define explicit coverage threshold in `vitest.config.ts`
- [ ] Reach 60% coverage on `ui/extension/` components
- [ ] Reach 80% coverage on `ui/hooks/`

---

## Phase E: Documentation Cleanup

**Priority:** 🟡 MEDIUM — Developer experience  
**Timeline:** Sprint 4-5 (1 week)

### E1. Stale Documentation Fixes
- [ ] Update `backend/README.md` — change `content` to `content_json` in schema
- [ ] Update `docs/TRANSCRIPT_SYSTEM_MAP.md` — add Echo360 details
- [ ] Archive `docs/QUALITY_AUDIT_2025-12-16.md` to `docs/archive/`
- [ ] Verify `docs/STATUS.md` test count (143 tests)

### E2. Missing Standard Files
- [ ] Create `CONTRIBUTING.md` — contributor guidelines
- [ ] Create `CHANGELOG.md` — version history

### E3. Documentation Consolidation
- [ ] Merge `tools/mcp/QUICK_START.md` into `tools/mcp/README.md`
- [ ] Shorten `/AGENTS.md` (360 lines → <200 lines)
- [ ] Move detailed rules to `docs/DEVELOPMENT.md`

### E4. Accuracy Fixes
- [ ] Fix `extension/AGENTS.md` — `noteService` → `notesService.ts`
- [ ] Add `window.LockInSentry` and `window.LockInMediaFetcher` to `docs/ARCHITECTURE.md`
- [ ] Standardize terminology: "sidebar" (not "widget" or "panel")

### E5. MCP Template Alignment
- [ ] Update `mcp.json.template` to match documented servers OR update README
- [ ] Ensure `validate-mcp-setup.ps1` matches actual file structure

---

## Phase F: Performance & Scalability

**Priority:** 🟢 LOW — Future optimization  
**Timeline:** Sprint 5-6 (as needed)

### F1. Rate Limiter Enhancement
- [ ] Evaluate in-memory cache with TTL for rate limiting
- [ ] Consider Redis for multi-instance deployments
- [ ] Reduce DB queries on every AI request

### F2. UI Performance
- [ ] Add list virtualization for notes (NotesPanel.tsx)
- [ ] Make offline queue operations async
- [ ] Batch localStorage writes

### F3. Bundle Optimization
- [ ] Exclude `.js.map` files from production builds
- [ ] Audit bundle size for optimization opportunities
- [ ] Evaluate code splitting improvements

---

## Phase G: Dependencies & Standards

**Priority:** 🟢 LOW — Scheduled maintenance  
**Timeline:** Sprint 6+ (as scheduled)

### G1. Security & Automation
- [ ] Configure Dependabot (`.github/dependabot.yml`)
- [ ] Review CORS localhost regex for production
- [ ] Consider build-time injection for Supabase anon key

### G2. Major Dependency Updates
- [ ] Create Lexical upgrade plan (0.17.1 → 0.39.0) — breaking changes expected
- [ ] Evaluate Tailwind 4.x migration path — major rewrite
- [ ] Update @types/chrome (0.0.268 → 0.1.33)

### G3. Minor Updates
- [ ] Update remaining 24 outdated packages
- [ ] Verify React 19 types compatibility

### G4. Standards Compliance
- [ ] Add OpenAPI/Swagger spec for backend API
- [ ] Consider API versioning strategy (`/api/v1/`)
- [ ] Consolidate overlapping CI workflows (test.yml + refactor-gate.yml)

### G5. Code Style
- [ ] Replace `console.log` with logger utility in `panoptoProvider.ts`
- [ ] Standardize storage key naming conventions
- [ ] Remove duplicate `AppError` class (backend/middleware vs core/errors)

---

## Definition of Done (Updated)

### Critical Gate (Phase A)
- [x] All dead MCP links resolved (A2 complete)
- [x] README.md reflects actual features (A3 complete)
- [ ] Privacy documentation accurate

### File Size Gate (Phase B)
- [ ] No files >400 lines (stretch goal: <200)
- [ ] NoteEditor.tsx decomposed
- [ ] Large providers decomposed

### Type Safety Gate (Phase C)
- [ ] Zero `any` TypeScript warnings
- [ ] All API boundaries typed
- [ ] Storage interface fully typed

### Testing Gate (Phase D)
- [ ] UI component test coverage >60%
- [ ] Hook test coverage >80%
- [ ] All contract tests passing

### Documentation Gate (Phase E)
- [ ] CONTRIBUTING.md exists
- [ ] CHANGELOG.md exists
- [ ] No dead documentation links

### Quality Gate (All Phases)
- [x] Type-check clean (0 errors)
- [x] All tests passing (252 tests)
- [x] Build succeeds
- [x] Verify-build passes
- [ ] Lint clean (0 warnings) — **Current: 126 warnings**

---

## Audit Findings Reference

### Critical Issues (2)
| # | Category | Issue | Phase |
|---|----------|-------|-------|
| 1 | Privacy | Sentry setUser() documented inaccurately | A1 |
| 2 | Architecture | NoteEditor.tsx 1039 lines | B1 |

### High Priority Issues (14)
| # | Category | Issue | Phase |
|---|----------|-------|-------|
| 1 | Code Quality | echo360Provider.ts 939 lines | B2 |
| 2 | Code Quality | LockInSidebar.tsx 761 lines | B3 |
| 3 | Code Quality | panoptoProvider.ts 666 lines | B4 |
| 4 | Code Quality | useNoteEditor.ts 633 lines | B5 |
| 5 | Type Safety | 126 `any` warnings | C1-C7 |
| 6 | Testing | Zero UI component tests | D2 |
| 7 | Testing | Zero hook tests | D1 |
| 8 | Dependencies | Lexical/Tailwind outdated | G2 |
| 9 | Documentation | docs/ADRS/ doesn't exist | A4 |
| 10 | Documentation | Backend README schema stale | E1 |
| 11 | Documentation | MCP template vs docs mismatch | E5 |
| 12 | Documentation | No CONTRIBUTING.md | E2 |
| 13 | Documentation | No CHANGELOG.md | E2 |
| 14 | Security | No Dependabot configured | G1 |

### Medium Priority Issues (18)
| # | Category | Issue | Phase |
|---|----------|-------|-------|
| 1 | Security | Supabase anon key hardcoded | G1 |
| 2 | Scalability | Rate limiter DB bottleneck | F1 |
| 3 | Architecture | videoDetection.ts 403 lines | B6 |
| 4 | Type Safety | notesService.ts uses `any` | C5 |
| 5 | Type Safety | storageInterface.ts callbacks | C2 |
| 6 | Performance | Sync localStorage reads | F2 |
| 7 | Code Quality | echo360Parser.ts 458 lines | B6 |
| 8 | Testing | Limited adapter edge tests | D3 |
| 9 | Documentation | Privacy claim inaccuracy | A1 |
| 10 | Architecture | let reassignment style | — |
| 11 | Security | serverUserAgent in feedback | — |
| 12 | Type Safety | assetsClient.ts mapNoteAsset | C1 |
| 13 | Documentation | README.md stale | A3 |
| 14 | Documentation | AGENTS.md too long | E3 |
| 15 | Documentation | Terminology inconsistency | E4 |
| 16 | Standards | No OpenAPI spec | G4 |
| 17 | Standards | No test coverage target | D4 |
| 18 | Documentation | Historical audit not archived | E1 |

---

## Quick Reference: File Size Violations

| File | Lines | Target | Priority |
|------|-------|--------|----------|
| `ui/extension/notes/NoteEditor.tsx` | 1039 | <200 | 🔴 Critical |
| `core/transcripts/providers/echo360Provider.ts` | 939 | <200 | 🟠 High |
| `ui/extension/LockInSidebar.tsx` | 761 | <200 | 🟠 High |
| `core/transcripts/providers/panoptoProvider.ts` | 666 | <200 | 🟠 High |
| `ui/hooks/useNoteEditor.ts` | 633 | <200 | 🟠 High |
| `ui/extension/notes/NotesPanel.tsx` | 515 | <200 | 🟡 Medium |
| `core/transcripts/parsers/echo360Parser.ts` | 458 | <200 | 🟡 Medium |
| `core/transcripts/videoDetection.ts` | 403 | <200 | 🟡 Medium |

---

## Notes

- All codex steps (C1-C5E) documented in `docs/PROMPT_LOG.md`
- Current status tracked in `docs/STATUS.md`
- Historical audit: `docs/QUALITY_AUDIT_2025-12-16.md`
- Audit findings: January 2026 consolidated audit (Batch 1 + Batch 2)

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-11 | 2.0 | Complete rewrite based on consolidated audit (Batch 1 + Batch 2) |
| Previous | 1.x | Original refactor plan (see git history) |
