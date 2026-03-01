# Backend Runtime Overview

## Entrypoints

- `backend/index.js`: bootstrap, env validation, graceful shutdown
- `backend/app.js`: Express app assembly
- `backend/config/index.js`: runtime config and limits
- `backend/observability/index.js`: logging + telemetry exports

## Layered Flow

1. Routes (`backend/routes/*`)
2. Controllers (`backend/controllers/*`)
3. Services (`backend/services/*`)
4. Repositories/providers (`backend/repositories/*`, `backend/providers/*`)

## Service Domains

- Assistant/chat: `backend/services/assistant/*`
- Notes/assets: `backend/services/notes/*`
- LLM orchestration: `backend/services/llm*`, `backend/providers/llm/*`
- Transcripts/jobs: `backend/services/transcripts/*`
- Auth/JWT strategies: `backend/services/auth/*`

## Provider Stack

- LLM adapters: Gemini/Groq/OpenAI under `backend/providers/llm/adapters/*`
- Provider chain/retry/fallback logic under `backend/providers/llm/providerChain*`
- Contracts and error/fallback helpers under `backend/providers/llm/contracts/*`

## Data Access

- Supabase client: `backend/db/supabaseClient.js`
- Repository-only DB access pattern (`backend/repositories/*`)
- No direct DB access in controllers/services
