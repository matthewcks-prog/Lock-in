# Refactor Plan

## How to use this doc

This document outlines the phased approach to prepare the codebase for a Codex refactor while maintaining extension and backend functionality. Use this as a reference when planning refactoring work and tracking progress through each phase.

---

## Goal

Prepare the codebase for Codex refactor without breaking extension/backend functionality.

---

## Phases

### Phase B1: Persistent docs (plan + prompt log)

- Create `docs/REFACTOR_PLAN.md` to track phased approach
- Create `docs/PROMPT_LOG.md` to log all refactor-prep prompts
- Establish documentation structure for tracking progress

### Phase B2: Globals typing + alias parity

- Add TypeScript type definitions for all global variables and window properties
- Ensure path aliases in `tsconfig.json` match those in `vite.config.ts` (and other build configs)

### Phase B3: Verify-build script + npm script wiring

- Create `verify-build` script in `package.json`
- Ensure script runs successfully and validates build output
- Wire up npm scripts for build verification

### Phase B4: Smoke checklist ✅

- [x] Create smoke test checklist document (`docs/SMOKE_CHECKLIST.md`)
- [x] Include manual verification steps for critical extension/backend functionality
- [x] Add debug tips section for common issues

### Phase B5: ESLint + boundary rules

- Add ESLint rules to enforce architectural boundaries
- Examples: no Chrome APIs in `/core`, no direct DOM manipulation in services
- Configure rules to catch violations during development

### Phase B6: Minimal unit test harness (optional but recommended)

- Set up basic unit test infrastructure
- Add unit tests for critical paths: adapters, state management, core services
- Ensure tests can run in CI/CD pipeline

---

## Documentation Status

- **`AGENTS._LIVINGDOC.md`** is deprecated and will be removed after guardrails are in place. All guidance has been migrated to `/AGENTS.md` and `docs/*`.

## Definition of Done for Guardrails

Before considering guardrails complete, verify all items below:

- [ ] **Globals typed**: All global variables and window properties have TypeScript type definitions
- [ ] **tsconfig/vite alias parity**: Path aliases in `tsconfig.json` match those in `vite.config.ts` (and any other build configs)
- [ ] **verify-build exists + passes**: A `verify-build` script exists in `package.json` and runs successfully
- [x] **smoke checklist exists**: A smoke test checklist document exists (`docs/SMOKE_CHECKLIST.md`) with manual verification steps
- [ ] **eslint boundary rules exist**: ESLint rules enforce architectural boundaries (e.g., no Chrome APIs in `/core`, no direct DOM manipulation in services)
- [ ] **minimal unit tests exist** (optional but recommended): At least basic unit tests exist for critical paths (adapters, state management, core services)
