# Lock-in Code Overview

This page is the index for implementation-level ownership. Detailed sections are split into owned docs under `docs/reference/code-overview/`.

## Section Ownership

| Section                 | Scope                                                | Owner                 | File                                          |
| ----------------------- | ---------------------------------------------------- | --------------------- | --------------------------------------------- |
| Extension Runtime       | content script, background, popup, bundled globals   | Extension maintainers | `docs/reference/code-overview/extension.md`   |
| Backend Runtime         | routes/controllers/services/repos/providers          | Backend maintainers   | `docs/reference/code-overview/backend.md`     |
| Cross-Layer Contracts   | shared APIs, transcript boundaries, error model      | Core/API maintainers  | `docs/reference/code-overview/cross-layer.md` |
| Operations & Validation | guardrails, quality gates, observability entrypoints | Repo maintainers      | `docs/reference/code-overview/operations.md`  |

## Update Checklist

When code ownership or structure changes, update:

1. The relevant section file(s) in `docs/reference/code-overview/`
2. This ownership table if scope/owner changed
3. `docs/architecture/REPO_MAP.md` when entrypoints or folders move

## Fast Links

- `docs/reference/code-overview/extension.md`
- `docs/reference/code-overview/backend.md`
- `docs/reference/code-overview/cross-layer.md`
- `docs/reference/code-overview/operations.md`
