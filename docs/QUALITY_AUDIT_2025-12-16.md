# Quality/Risk Audit Report
**Date**: 2025-12-16  
**Tool**: Cursor (Read-only)  
**Purpose**: Bulletproof quality/risk audit without functional changes

---

## Executive Summary

All quality gates are **PASSING** (lint: 0 errors, test: 136 passing, type-check: 0 errors, build: success). However, **126 ESLint warnings** (all `any` types) and **missing contract tests** for critical window globals represent drift risks that should be addressed before production.

**Key Findings:**
- ✅ All automated checks pass
- ⚠️ 126 `any` type warnings (categorized into quick fixes, medium refactors, danger zones)
- ⚠️ Missing contract tests for `window.LockInAPI`, `window.LockInAuth`, `window.LockInUI`
- ⚠️ No test for manifest script loading order
- ⚠️ No test for init order dependencies

---

## Current Quality Gates Status

### Automated Checks (All Passing ✅)

| Check | Command | Status | Details |
|-------|---------|--------|---------|
| **Lint** | `npm run lint` | ✅ PASS | 0 errors, 126 warnings (all `any` types) |
| **Tests** | `npm run test` | ✅ PASS | 136 tests passing (10 test files, 2.22s duration) |
| **Type-check** | `npm run type-check` | ✅ PASS | 0 errors |
| **Build** | `npm run build` | ✅ PASS | All bundles generated successfully |
| **Verify-build** | `npm run verify-build` | ✅ PASS | Type-check + build both pass |

### Manual Checks (Required for Releases)

- **SMOKE_CHECKLIST.md §1**: Build & Load (extension loads, no console errors)
- **SMOKE_CHECKLIST.md §2**: Selection → Sidebar → AI (text selection, sidebar opens, AI responds)

---

## Known Risks

### High-Risk Areas (Require Contract Tests)

#### 1. Window Globals Drift Risk
**Risk**: Breaking changes to global API surface go undetected.

**Missing Contract Tests:**
- `window.LockInAPI` - Only `createApiClient` is tested, not the global surface
- `window.LockInAuth` - No contract test for global auth client surface
- `window.LockInUI` - No contract test for sidebar factory surface

**Existing Coverage:**
- ✅ `window.LockInContent` - Has contract test (`extension/src/__tests__/contentRuntimeSurface.test.ts`)

**Impact**: If `initApi.ts` or `ui/extension/index.tsx` changes the global API shape, content scripts will break silently.

#### 2. Manifest Script Ordering Risk
**Risk**: Reordering content scripts in `manifest.json` breaks init dependencies.

**Current Order** (critical):
```json
"js": [
  "config.js",              // Sets window.LOCKIN_CONFIG
  "libs/initApi.js",        // Requires window.LOCKIN_CONFIG, sets window.LockInAPI/Auth
  "libs/contentLibs.js",    // Sets window.LockInContent
  "content/stateStore.js",  // Uses window.LockInContent
  "content/sidebarHost.js", // Uses window.LockInUI
  "content/sessionManager.js",
  "content/interactions.js",
  "ui/index.js",            // Sets window.LockInUI
  "contentScript-react.js"  // Requires all above
]
```

**Missing**: No test validates this order or detects if order changes.

**Impact**: If scripts load out of order, `contentScript-react.js` will fail with `undefined` globals.

#### 3. Init Order Dependencies Risk
**Risk**: Race conditions if scripts load out of order despite manifest order.

**Current Mitigation**: `contentScript-react.js` has fallbacks (`window.LockInLogger || {...}`) and `waitForUIBundle()` polling.

**Missing**: No test verifies correct load sequence or fallback behavior.

**Impact**: Subtle race conditions in production if Chrome's script injection timing changes.

### Code Quality Risks

#### High-Impact Files (Many `any` Warnings)
- `ui/extension/LockInSidebar.tsx` - 8 warnings (props, state, event handlers)
- `ui/extension/notes/NoteEditor.tsx` - 3 warnings (Lexical node types, event handlers)
- `api/fetcher.ts` - 20 warnings (API response types, error handling)
- `extension/src/chromeStorage.ts` - 12 warnings (storage value types, callbacks)

---

## Lint Warning Analysis

**Total**: 126 warnings (all `@typescript-eslint/no-explicit-any`)

### Quick Type Fixes (Low Risk, High ROI) - ~30 warnings

**Files:**
- `api/fetcher.ts` lines 80-84 (error properties)
- `core/errors/AppError.ts` lines 89, 251-252 (error types)
- `api/resources/*` (response types)
- `core/storage/storageInterface.ts` (callback parameters)
- `core/services/__tests__/notesService.test.ts` (mock functions)

**Effort**: 1-2 hours  
**Risk**: Low (adding types, no behavior change)  
**Validation**: Run `npm run lint` (should reduce warnings by ~30)

### Medium Refactors (Needs Care) - ~60 warnings

**Files:**
- `api/fetcher.ts` (generic constraints, response types)
- `core/storage/storageInterface.ts`, `extension/src/chromeStorage.ts` (storage value shapes)
- `api/auth.ts` (event handler parameters)
- `ui/hooks/*` (React hook types)

**Effort**: 4-6 hours  
**Risk**: Medium (may require interface changes)  
**Validation**: Run `npm run lint && npm run test` (ensure no regressions)

### Danger Zones (Editor/Sidebar/Storage/Runtime) - ~36 warnings

**Files:**
- `ui/extension/LockInSidebar.tsx` (8 warnings)
- `ui/extension/notes/NoteEditor.tsx` (3 warnings)
- `extension/src/storage.ts`, `extension/src/chromeStorage.ts` (12 warnings)
- `extension/src/contentRuntime.ts` (2 warnings)
- `extension/src/initApi.ts` (5 warnings)
- `ui/extension/index.tsx` (1 warning)
- `ui/hooks/*` (5 warnings)

**Effort**: 6-8 hours  
**Risk**: High (touches critical runtime surfaces)  
**Validation**: Run full SMOKE_CHECKLIST.md (all 6 sections)

---

## Prioritized Backlog (Ordered by ROI)

### 1. Add Contract Tests for Window Globals (High ROI, Medium Risk)
**Priority**: P0 (blocks production readiness)

**Tasks:**
- Add `extension/src/__tests__/initApiSurface.test.ts` to test `window.LockInAPI` and `window.LockInAuth` surface
- Add `ui/extension/__tests__/uiSurface.test.ts` to test `window.LockInUI` surface
- Assert required methods exist and signatures match expected types

**Effort**: 2-3 hours  
**Risk**: Low (test-only, no runtime changes)  
**Validation**: `npm run test` (new tests pass), SMOKE_CHECKLIST.md §1 (extension still loads)

**Smoke Sections**: §1 (Build & Load)

---

### 2. Add Manifest Script Order Test (High ROI, Low Risk)
**Priority**: P0 (prevents silent breakage)

**Tasks:**
- Create `extension/__tests__/manifestOrder.test.ts`
- Parse `manifest.json` and validate content script order
- Assert `config.js` → `initApi.js` → `contentLibs.js` → ... → `contentScript-react.js`

**Effort**: 1 hour  
**Risk**: Low (test-only)  
**Validation**: `npm run test` (new test passes)

**Smoke Sections**: None (test-only)

---

### 3. Quick Type Fixes - Error Handling (High ROI, Low Risk)
**Priority**: P1 (reduces lint noise, improves type safety)

**Tasks:**
- Type error properties in `api/fetcher.ts` (lines 80-84)
- Type error constructors in `core/errors/AppError.ts` (lines 89, 251-252)
- Type API response shapes in `api/resources/*`

**Effort**: 1-2 hours  
**Risk**: Low (adding types, no behavior change)  
**Validation**: `npm run lint` (warnings reduced by ~30), `npm run test` (all pass)

**Smoke Sections**: None (type-only changes)

---

### 4. Add Init Order Dependency Test (Medium ROI, Low Risk)
**Priority**: P1 (catches race conditions)

**Tasks:**
- Create `extension/__tests__/initOrder.test.ts`
- Test that `contentScript-react.js` fallbacks work correctly
- Test that `waitForUIBundle()` handles delayed loads

**Effort**: 2 hours  
**Risk**: Low (test-only)  
**Validation**: `npm run test` (new tests pass)

**Smoke Sections**: None (test-only)

---

### 5. Type Storage Interface Values (Medium ROI, Medium Risk)
**Priority**: P2 (improves type safety, touches storage)

**Tasks:**
- Define storage value types in `core/storage/storageInterface.ts`
- Update `extension/src/chromeStorage.ts` to use typed values
- Type callback parameters

**Effort**: 2-3 hours  
**Risk**: Medium (touches storage layer)  
**Validation**: `npm run lint` (warnings reduced), `npm run test` (storage tests pass), SMOKE_CHECKLIST.md §3 (notes persist)

**Smoke Sections**: §3 (Notes Create/Edit/Save)

---

### 6. Type API Client Generics (Medium ROI, Medium Risk)
**Priority**: P2 (improves API type safety)

**Tasks:**
- Add proper generic constraints to `api/fetcher.ts` `apiRequest<T>`
- Type response shapes in resource clients
- Remove `any` from error handling paths

**Effort**: 3-4 hours  
**Risk**: Medium (touches API layer)  
**Validation**: `npm run lint` (warnings reduced), `npm run test` (API tests pass), SMOKE_CHECKLIST.md §2 (AI flow works)

**Smoke Sections**: §2 (Selection → Sidebar → AI)

---

### 7. Type Editor/Sidebar Components (Low ROI, High Risk)
**Priority**: P3 (large surface, many edge cases)

**Tasks:**
- Type Lexical node types in `ui/extension/notes/NoteEditor.tsx`
- Type props/state in `ui/extension/LockInSidebar.tsx`
- Type event handlers and callbacks

**Effort**: 6-8 hours  
**Risk**: High (touches critical UI surfaces)  
**Validation**: `npm run lint` (warnings reduced), Full SMOKE_CHECKLIST.md (all 6 sections)

**Smoke Sections**: All (full regression test)

---

### 8. Type Auth Callbacks and Hooks (Low ROI, Medium Risk)
**Priority**: P3 (lower impact, can be deferred)

**Tasks:**
- Type event handler parameters in `api/auth.ts`
- Type React hook return values in `ui/hooks/*`
- Type callback parameters

**Effort**: 2-3 hours  
**Risk**: Medium (touches auth and hooks)  
**Validation**: `npm run lint` (warnings reduced), `npm run test` (hook tests pass), SMOKE_CHECKLIST.md §2 (auth flow works)

**Smoke Sections**: §2 (Selection → Sidebar → AI)

---

## Recommended Next Codex Step

**C5: Window Globals Contract Tests** (follows C4C-2)

**Rationale:**
- Highest ROI (prevents silent breakage of critical surfaces)
- Low risk (test-only, no runtime changes)
- Unblocks production readiness (contract tests are essential for drift detection)
- Natural continuation of C4C-1/C4C-2 (which added `window.LockInContent` contract test)

**Scope:**
1. Add `extension/src/__tests__/initApiSurface.test.ts` to test `window.LockInAPI` and `window.LockInAuth`
2. Add `ui/extension/__tests__/uiSurface.test.ts` to test `window.LockInUI`
3. Add `extension/__tests__/manifestOrder.test.ts` to validate script order
4. Update `extension/src/globals.d.ts` to include all window globals (currently only has `LockInContent`)

**Validation:**
- `npm run test` (new tests pass)
- `npm run lint` (no new warnings)
- SMOKE_CHECKLIST.md §1 (extension still loads)

**Estimated Effort**: 3-4 hours

---

## Summary

**Current State**: ✅ All quality gates passing, but 126 lint warnings and missing contract tests represent drift risks.

**Immediate Actions**:
1. Add contract tests for window globals (C5) - **3-4 hours**
2. Add manifest script order test - **1 hour**
3. Quick type fixes (error handling) - **1-2 hours**

**Total Effort to Address Critical Risks**: ~5-7 hours

**Remaining Work** (can be done incrementally):
- Medium refactors (storage, API generics) - **5-7 hours**
- Danger zone typing (editor, sidebar) - **6-8 hours**
- Auth/hooks typing - **2-3 hours**

**Total Remaining**: ~13-18 hours to reach "lint clean" DoD

---

## Appendix: Lint Warning Breakdown by File

| File | Warnings | Category |
|------|----------|----------|
| `api/fetcher.ts` | 20 | Medium refactors |
| `api/resources/notesClient.ts` | 13 | Quick fixes |
| `extension/src/chromeStorage.ts` | 12 | Danger zone |
| `ui/extension/LockInSidebar.tsx` | 8 | Danger zone |
| `api/auth.ts` | 6 | Medium refactors |
| `extension/src/initApi.ts` | 5 | Danger zone |
| `core/services/notesService.ts` | 9 | Medium refactors |
| `core/storage/storageInterface.ts` | 6 | Medium refactors |
| `ui/hooks/useNoteEditor.ts` | 5 | Danger zone |
| `ui/extension/notes/NoteEditor.tsx` | 3 | Danger zone |
| Others (20 files) | 39 | Mixed |

**Total**: 126 warnings

