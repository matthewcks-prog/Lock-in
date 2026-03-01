# Lock-in Project AGENTS.md

> **Version**: 3.0 | **Updated**: 2026-02-06

## Quick Reference

| Layer           | Purpose                  | Forbidden                                 | Max Lines                       |
| --------------- | ------------------------ | ----------------------------------------- | ------------------------------- |
| `/core`         | Platform-agnostic domain | `chrome`, `window`, `document`, `express` | 300                             |
| `/api`          | Backend client           | `chrome`, `express`, backend internals    | 200                             |
| `/backend`      | Node.js API              | Browser globals, UI code                  | Controllers: 200, Services: 300 |
| `/extension`    | Chrome glue              | Backend internals, direct DB              | 300                             |
| `/integrations` | Site adapters            | Network calls, `chrome`, backend          | 200                             |
| `/ui`           | React components         | Business logic, direct API calls          | 150                             |

---

## Decision Framework

Before writing code, ask:

1. **Does it support the Core Loop?** Capture → Understand → Distil → Organize → Act
2. **Which layer owns this?** See table above
3. **Can I test it without mocking the world?** If no, redesign
4. **Does `npm run validate` pass?** Required for every commit

---

## Non-Negotiable Rules

### Architecture

- **NO cross-layer imports** — Enforced by `npm run lint:deps`
- **NO circular dependencies** — Blocked in CI
- **NO browser globals in `/core` or `/api`** — ESLint error
- **NO business logic in controllers** — Controllers call services only

### Code Quality

- **Files < 300 lines** — Split or justify in ADR
- **Functions < 50 lines** — Extract helpers
- **Complexity < 15** — Simplify or decompose
- **No `any` types** — Use `unknown` and narrow

### Runtime Safety

- **Validate at boundaries** — Zod schemas for all inputs/outputs
- **Timeout all async ops** — Use `withTimeout()` wrapper
- **No hidden shared state** — All state must be injectable
- **Throw only `AppError` subclasses** — From `/core/errors`

### Testing

- **Business logic requires tests** — No exceptions
- **Bug fixes require regression tests** — Prove it's fixed
- **Coverage gates enforced** — CI blocks on regression

---

## Layer Rules (Summary)

### `/core` — Platform-Agnostic Domain

```
ALLOWED: Pure functions, injected dependencies, domain types
FORBIDDEN: window, document, chrome, fetch (use injected fetcher)
TEST: Must pass in Node.js without polyfills
```

### `/backend` — API Server

```
LAYERS: Routes → Controllers → Services → Repos/Providers
RULE: Each layer only calls the one below
FORBIDDEN: Direct DB access in controllers, req/res in services
```

### `/extension` — Chrome Glue

```
PURPOSE: Thin wrappers that delegate to /core
FORBIDDEN: Business logic, god files (>500 lines)
PATTERN: background.js = router only, handlers in modules
```

### `/integrations` — Site Adapters

```
PURPOSE: Parse DOM, return structured data
FORBIDDEN: Network calls, chrome APIs, business logic
INTERFACE: Implement BaseAdapter contract
```

---

## Validation Commands

```bash
npm run validate      # MUST pass before commit
npm run lint:deps     # Architecture boundaries
npm run test:coverage # Coverage thresholds
```

---

## Documentation Map

| What                   | Where                                  |
| ---------------------- | -------------------------------------- |
| Architecture decisions | `docs/architecture/decisions/ADR-*.md` |
| Current implementation | `docs/reference/CODE_OVERVIEW.md`      |
| Database schema        | `docs/reference/DATABASE.md`           |
| Refactor progress      | `docs/tracking/REFACTOR_PLAN.md`       |
| Layer-specific rules   | `{layer}/AGENTS.md`                    |

---

## Sub-AGENTS

Each layer has its own AGENTS file with **layer-specific rules only**:

- [`/backend/AGENTS.md`](./backend/AGENTS.md) — Layering, prompts, providers
- [`/core/AGENTS.md`](./core/AGENTS.md) — DI patterns, transcript providers
- [`/extension/AGENTS.md`](./extension/AGENTS.md) — Chrome patterns, messaging
- [`/integrations/AGENTS.md`](./integrations/AGENTS.md) — Adapter contracts

**Inheritance**: Sub-AGENTS inherit all rules from this file. Don't repeat rules.

---

## PR Checklist

- [ ] `npm run validate` passes
- [ ] Layer boundaries respected (check `npm run lint:deps`)
- [ ] Tests added for new logic
- [ ] No `any` types added
- [ ] Files under size limits
- [ ] Docs updated if structure changed
