# Environment Strategy and Configuration

Last updated: 2026-01-27

This is the canonical guide for how Lock-in configures environments, secrets, and environment files across the extension and backend.

## Environment Model

Lock-in separates environments by both runtime and data:

- Development: local machines and local tooling
- Staging: deployed preview environment for integration testing
- Production: live environment for real users

As of 2026-01-27, the repository documents the following mapping:

| Environment | Runtime Surface                 | Typical Deployment Target                | Supabase Project                                         |
| ----------- | ------------------------------- | ---------------------------------------- | -------------------------------------------------------- |
| Development | Local extension + local backend | Local machine                            | Development project (for example `uszxfuzauetcchwcgufe`) |
| Staging     | Deployed backend                | Azure Container Apps (`lock-in-dev`)     | Development project                                      |
| Production  | Deployed backend                | Azure Container Apps (`lock-in-backend`) | Production project (for example `vtuflatvllpldohhimao`)  |

## Canonical Environment Files

There are two separate environment file systems: root (extension build) and backend runtime.

### Root (Extension Build and Shared Tooling)

These files live at the repository root:

- `.env`: safe defaults only, committed
- `.env.local`: real secrets, gitignored
- `.env.example`: canonical template, committed
- `.env.example.local`: legacy template pointer (do not copy from this)

Recommended workflow:

1. Copy the template.
2. Put all real values in `.env.local`.
3. Leave `.env` as non-sensitive defaults and placeholders.

```bash
cp .env.example .env.local
```

Key points:

- Vite embeds `VITE_*` values into the extension bundle at build time.
- Never store real secrets in `.env` because it is committed.
- Treat `.env.local` as the only place for real keys in local development.

### Backend Runtime (`backend/`)

These files live under `backend/`:

- `backend/.env`: backend runtime env for local dev (gitignored by convention)
- `backend/.env.example`: backend template, committed

The backend bootstraps with `dotenv` and loads `backend/.env` at startup.

```bash
cd backend
cp .env.example .env
npm run dev
```

## Naming Conventions

Environment variables follow two consistent conventions:

- Prefix `VITE_` for extension build-time variables
- Suffix `_DEV` and `_PROD` for environment-specific credentials

Examples:

- Extension build: `VITE_SUPABASE_URL_DEV`, `VITE_BACKEND_URL_DEV`
- Backend runtime: `SUPABASE_URL_DEV`, `SUPABASE_SERVICE_ROLE_KEY_PROD`

The backend selects Supabase credentials by `NODE_ENV`:

- `NODE_ENV=production` selects `*_PROD`
- Any other value selects `*_DEV`

## Security Rules (Non-Negotiable)

- Do not commit real secrets to the repository.
- Keep all real secrets in `.env.local` (root) and `backend/.env` (backend).
- Production secrets should live in Azure Key Vault and be referenced by the runtime.
- Avoid mixing `*_DEV` and `*_PROD` values in the same local file.

## Quick Verification Checklist

After setting environment files:

1. Build the extension:

```bash
npm run build
```

2. Start the backend locally:

```bash
cd backend
npm run dev
```

3. Confirm the backend validates env on startup.

## Related Documentation

- Azure deployment: `docs/deployment/AZURE.md`
- CI/CD pipelines: `docs/deployment/CICD.md`
- Local development workflow: `docs/setup/LOCAL_DEVELOPMENT.md`
- Database reference: `docs/reference/DATABASE.md`
