# Prompt Log

Log of refactoring prompts and outcomes. Tracks major architectural changes and refactor-prep work.

| Prompt ID                            | Tool      | Mode | Purpose                           | Output Summary                                                                                                                                                                        | Date       |
| ------------------------------------ | --------- | ---- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 2026-01-06-echo360-transcripts       | Codex CLI | edit | Add Echo360 transcript support    | Added Echo360 provider, detection, background wiring, provider bundle build step, tests, and doc updates.                                                                             | 2026-01-06 |
| C1-import-hygiene                    | Codex     | edit | Normalize import paths            | Normalized `@core/*` and `@shared/ui` path aliases, removed deep relative imports.                                                                                                    | 2024-12    |
| C2-docs-scaffolds                    | Codex     | edit | Create documentation structure    | Created `docs/ARCHITECTURE.md`, `docs/REPO_MAP.md`, `docs/STATUS.md` for stable contracts and living snapshots.                                                                       | 2024-12    |
| C3-vite-dedupe                       | Codex     | edit | Deduplicate Vite configs          | Centralized shared Vite configuration, removed duplication.                                                                                                                           | 2024-12    |
| C4-api-layering                      | Codex     | edit | Layer API client architecture     | Layered API client into fetcher + resource clients, added contract guardrails, retry/abort/conflict/asset mapping tests, updated docs.                                                | 2024-12    |
| C4C-1-content-runtime-v1             | Codex     | edit | Version content runtime           | Versioned `window.LockInContent` runtime, migrated helpers to canonical API, added surface test + ESLint guard.                                                                       | 2024-12    |
| C4C-2-remove-compat-shim             | Codex     | edit | Remove legacy compat              | Removed content runtime compat shim; ESLint guard now errors on legacy identifiers; surface tests enforce canonical-only keys.                                                        | 2024-12    |
| C5A-init-api-globals                 | Codex     | edit | Add init API contract tests       | Init API globals contract gate (initApi surface test covering `window.LockInAPI`/`window.LockInAuth` + compat aliases).                                                               | 2024-12    |
| C5B-ui-globals                       | Codex     | edit | Add UI globals contract tests     | UI globals contract gate (LockInUI surface test covering keys + sidebar factory contract).                                                                                            | 2024-12    |
| C5C-manifest-order                   | Codex     | edit | Add manifest order guardrail      | Manifest content_scripts order guardrail (locks `content_scripts[0].js` sequence and critical ordering assertions).                                                                   | 2024-12    |
| C5D-init-order                       | Codex     | edit | Add init order guardrail          | Content bootstrap init-order guardrail (tests late UI/runtime availability and idempotent bootstrap to prevent race regressions).                                                     | 2024-12    |
| C5E-ci-gate                          | Codex     | edit | Add CI refactor gate              | CI refactor gate + local check script (GitHub Actions workflow runs lint → test → type-check → build → verify-build plus backend npm ci/test; root `npm run check` mirrors the gate). | 2024-12    |
| 2026-01-04-transcript-error-handling | Codex     | edit | Improve transcript error handling | Enhanced network request handling (30s timeout, 3 retries, comprehensive logging), improved error classification, created troubleshooting guide.                                      | 2026-01-04 |

## Notes

- **Codex steps (C1-C5E)**: Refactor-prep work focused on guardrails, documentation, tests, and build scripts
- **Phase B6**: Current phase focused on test hardening and lint noise reduction
- **All steps**: Documented in `docs/REFACTOR_PLAN.md` with completion status
- **Current status**: Tracked in `docs/STATUS.md`
