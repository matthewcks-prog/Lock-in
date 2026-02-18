# Lock-in Backend API

Express API for the Lock-in extension. It handles auth, chat orchestration, notes, transcripts, and provider fallback/rate-limits.

## Quick Start

### Local (recommended)

Prereqs: Node.js >= 18, npm >= 9, Docker (for local Supabase).

```bash
pwsh ./scripts/dev/setup-local.ps1
cd backend
npm run dev
```

Health check:

```bash
curl http://localhost:3000/health
```

### Manual setup

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

## Required Env Vars

Use `backend/.env.example` as the canonical list.

Minimum:

- `NODE_ENV`
- `SUPABASE_URL_DEV` / `SUPABASE_SERVICE_ROLE_KEY_DEV` (non-prod)
- `SUPABASE_URL_PROD` / `SUPABASE_SERVICE_ROLE_KEY_PROD` (prod)
- `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` or `OPENAI_API_KEY`
- `PORT` (optional, defaults to `3000`)

## Common Commands

```bash
npm run dev          # nodemon
npm start            # production-like start
npm test             # backend unit tests
npm run lint         # backend eslint
npm run build        # backend build checks (if configured)
```

From repo root:

```bash
npm run test:backend
npm run validate
```

## Runtime Architecture

Request flow:

1. Routes (`backend/routes/*`)
2. Controllers (`backend/controllers/*`)
3. Services (`backend/services/*`)
4. Repositories/providers (`backend/repositories/*`, `backend/providers/*`)

Key entrypoints:

- `backend/index.js`: bootstrap + graceful shutdown
- `backend/app.js`: middleware + route wiring
- `backend/config/index.js`: environment-driven config
- `backend/observability/index.js`: logging + telemetry

## Canonical Docs

- Local setup: `docs/setup/LOCAL_DEVELOPMENT.md`
- Environments/deployment: `docs/deployment/ENVIRONMENTS.md`
- Backend testing standards: `docs/testing/BACKEND_TESTING.md`
- Azure embeddings setup: `docs/backend/AZURE_EMBEDDINGS_SETUP.md`
- Migration checklist: `docs/backend/MIGRATION_CHECKLIST.md`
- Database reference: `docs/reference/DATABASE.md`
- Architecture map: `docs/architecture/REPO_MAP.md`

## Notes

- Backend operational docs are intentionally centralized under `docs/backend/`.
- Keep this README short; put deep operational playbooks in `docs/`.
