# Repository Hardening Plan

> Updated: 2026-02-17  
> Scope: Entire Lock-in repository  
> Objective: enforce scalable, reliable, testable, low-coupling architecture and stop quality drift

---

## 1. Outcomes

1. Zero lint/type/dependency architecture errors in CI.
2. Warning count only moves down (never up).
3. Boundaries are tooling-enforced, not policy-only.
4. Legacy code/docs are removed as part of each refactor wave.
5. New feature work is gated by quality checks, not best-effort reviews.

---

## 2. Quality Snapshots (Measured 2026-02-17)

### Baseline (Wave 2 Start)

### ESLint

- Total: **104 errors**, **405 warnings**, **157 files with issues**
- Error buckets:
  - `@typescript-eslint/strict-boolean-expressions`: **53**
  - `@typescript-eslint/explicit-function-return-type`: **51**
- Largest warning buckets:
  - `no-magic-numbers`: **191**
  - `max-lines-per-function`: **116**
  - `max-statements`: **49**
  - `complexity`: **32**
  - `max-lines`: **11**
- Layer concentration:
  - `ui`: **92 errors / 245 warnings**
  - `extension`: **0 errors / 131 warnings**
  - `shared`: **7 errors / 6 warnings**

### Current (After Wave 3 Pass 2)

### ESLint

- Total: **0 errors**, **312 warnings**, **123 files with issues**
- Error buckets:
  - `@typescript-eslint/strict-boolean-expressions`: **0**
  - `@typescript-eslint/explicit-function-return-type`: **0**
- Largest warning buckets:
  - `max-lines-per-function`: **116**
  - `no-magic-numbers`: **98**
  - `max-statements`: **49**
  - `complexity`: **32**
  - `max-lines`: **11**
- Layer concentration:
  - `ui`: **0 errors / 185 warnings**
  - `extension`: **0 errors / 98 warnings**
  - `shared`: **0 errors / 6 warnings**
  - `backend`: **0 errors / 9 warnings**

### Stylelint

- Total: **0 errors**, **0 warnings**, **0 files with issues**
- Status: **clean**

### Dependency Cruiser

- Total: **0 errors**, **0 warnings**
- Status: **clean**

---

## 3. Priority Execution Order (Highest ROI First)

### Phase A: Remove All Current Errors (Blocker)

Status: **Completed (2026-02-17)**

1. Cleared all `@typescript-eslint/strict-boolean-expressions` errors.
2. Cleared all `@typescript-eslint/explicit-function-return-type` errors.
3. End state: ESLint errors = **0**.

### Phase B: Burn Down High-Volume Warnings

1. `no-magic-numbers` first (largest single bucket).
2. Function quality rules next (`max-lines-per-function`, `max-statements`, `complexity`).
3. Attack highest-ROI files first: current top 10 warning files account for **68 / 312 warnings**.
4. Split oversized files/functions to meet AGENTS limits.
5. Exit criteria: warning count reduced by at least **35%** from baseline.
6. Current progress: **23.0%** reduction from baseline (405 -> 312); target for Phase B completion is <= **263** warnings.

### Phase C: CSS Warning Cleanup

1. Auto-fix order warnings where safe.
2. Fix specificity ordering explicitly in affected files.
3. Replace deprecated CSS property/value usage.
4. Exit criteria: Stylelint warnings = **0**.

### Phase D: Dependency Hygiene

1. Resolve or formally ignore legitimate orphan modules with justification.
2. Delete dead modules rather than suppressing violations.
3. Exit criteria: dep-cruiser warnings = **0** (or approved allowlist ADR).

### Phase E: Reliability + Boundary Completion

1. Finish runtime boundary validation coverage (HTTP/chrome storage/external provider responses).
2. Verify all external/network async operations are wrapped with timeout/retry policy.
3. Add contract tests for critical seams (`api <-> backend`, `extension <-> background`).
4. Exit criteria: reliability checklist in `STATUS.md` all green.

---

## 4. Warning-to-Error Promotion Policy

Use ratcheting promotion by rule and layer, never all-at-once.

1. Keep correctness/security/architecture rules as `error` now.
2. Keep high-churn maintainability rules as `warn` during cleanup.
3. Promote a rule from `warn` to `error` only when:
   - count is **0** in target layer for 2 consecutive CI runs, and
   - there is no active exception ADR.
4. Promotion order:
   - `core`, `api`, `backend` first
   - then `extension`, `ui`, `shared`
5. Once promoted, no downgrade without ADR.
6. Current promotions completed: Stylelint ordering/specificity/deprecated-property rules and dep-cruiser `no-orphan-modules`.

---

## 5. Drift Prevention Controls

### Quality Enforcement (Active)

**All linting rules enforced as errors**: As of 2026-02-17, all ESLint quality rules have been promoted from warnings to errors. This eliminates the need for warning budgets and ensures:

1. Zero tolerance for code quality regressions
2. Immediate CI failure on any quality violations
3. Consistent enforcement across all environments
4. No technical debt accumulation

The warning budget system has been removed as it is no longer needed.

### PR Gate (Required)

1. `npm run validate` must pass (includes linting with `--max-warnings=0`)
2. All tests must pass with required coverage thresholds
3. Any boundary-rule disable requires ADR link in PR

### Pre-commit (Required)

1. Keep existing Husky checks.
2. Add fast changed-file lint check with `--max-warnings=0`.

### Documentation Hygiene (Required)

1. Remove superseded docs in the same PR that introduces replacements.
2. Keep only one source of truth per policy/process topic.
3. Update `STATUS.md` after each completed phase.

---

## 6. Legacy Deletion Policy

1. No "temporary duplicate" modules beyond one sprint.
2. Any file replaced by refactor must be deleted or marked with removal date.
3. Orphan files without inbound dependency or runtime usage are removed.
4. Legacy compatibility shims require explicit deprecation owner/date.

---

## 7. Implementation Checklist

- [x] Phase A complete: ESLint errors at 0
- [ ] Phase B complete: ESLint warnings reduced >=35%
- [x] Phase C complete: Stylelint warnings at 0
- [x] Phase D complete: dep-cruiser warnings resolved
- [ ] Phase E complete: boundary/runtime reliability checks complete
- [x] CI ratchet active and enforced
- [ ] Warning-to-error promotions started by layer
- [ ] Legacy docs/code cleanup policy applied in active PRs
