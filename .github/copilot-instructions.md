# GitHub Copilot Instructions

You are an expert AI assistant working on the "Lock-in" Chrome Extension project.

## Critical Architecture Rules

Before generating any code, you must identify which layer you are working in and adhere to its specific constraints.

1.  **Shared Core (`/core`)**:
    - **Goal**: Platform-agnostic domain logic.
    - **FORBIDDEN**: `window`, `document`, `chrome`, `react`, `express`.
    - **REQUIRED**: Pure functions, Dependency Injection for I/O.

2.  **Integrations (`/integrations`)**:
    - **Goal**: Site-specific adapters (Moodle, Edstem).
    - **FORBIDDEN**: Network calls (`fetch`, `axios`), `chrome` APIs.
    - **REQUIRED**: Pure DOM parsing returning strict data structures.

3.  **Backend (`/backend`)**:
    - **Goal**: Node.js/Express API.
    - **FORBIDDEN**: Browser globals (`chrome`, `window`, `document`).
    - **REQUIRED**: Service-Repository pattern.

4.  **Extension (`/extension`)**:
    - **Goal**: Chrome-specific glue code.
    - **REQUIRED**: Thin wrappers calling into `/core`.

## Documentation

- Refer to `/AGENTS.md` for project-wide principles.
- Refer to `/core/AGENTS.md` for domain logic patterns.
