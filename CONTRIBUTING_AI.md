# Contributing AI Guidelines

**ATTENTION AI AGENTS (Claude, GPT, Gemini, etc.)**

This repository follows a strict **Hexagonal / Clean Architecture**. Before writing code, you **MUST** read the `AGENTS.md` file in the directory you are modifying.

## Quick Reference

| Directory       | Role             | Strict Constraints                                              |
| :-------------- | :--------------- | :-------------------------------------------------------------- |
| `/core`         | Domain Logic     | **NO** `chrome`, `window`, `react`, `express`. Pure logic only. |
| `/integrations` | Site Adapters    | **NO** `fetch`, `API calls`, `storage`. Pure DOM parsing only.  |
| `/backend`      | API Server       | **NO** browser globals. Node.js environment only.               |
| `/extension`    | Chrome Glue      | The only place allowed to use `chrome.*` APIs directly.         |
| `/ui`           | React Components | UI only. No business logic (delegate to hooks/core).            |

## Enforcement

- **ESLint** is configured to reject illegal imports.
- **PRs** will fail if these boundaries are crossed.

## How to Proceed

1.  Read root `/AGENTS.md`.
2.  Read local `AGENTS.md`.
3.  Check `eslint.config.js` if unsure about imports.
