# Backend AGENTS.md

> **Inherits**: [`/AGENTS.md`](../AGENTS.md) — All root rules apply here

## Layer Stack

```
Routes → Controllers → Services → Repositories/Providers
         (HTTP)       (Logic)    (Data/External)
```

**Each layer calls only the one below. Never skip layers.**

---

## Layer Rules

### Routes (`/routes`)

- Wire HTTP method + path to controller
- Apply middleware (auth, validation)
- **Max 50 lines** per file
- **NO** service/repo/provider imports

### Controllers (`/controllers`)

- Parse `req.params`, `req.query`, `req.body`
- Call service, return `res.json()`
- **Max 50 lines** per function, **200 lines** per file
- **NO** direct DB/provider access
- **NO** business logic (delegate to services)

### Services (`/services`)

- Business logic and orchestration
- Build prompts via `/config/prompts.js`
- **Max 300 lines** per file
- **NO** `req`/`res` (HTTP-agnostic)
- **NO** direct Supabase client

### Repositories (`/repositories`)

- Supabase queries only
- **NO** business logic
- **NO** service/controller imports

### Providers (`/providers`)

- External API wrappers (OpenAI, etc.)
- Retry/timeout logic
- **NO** DB access, **NO** Express

---

## Validation

All inputs validated via Zod middleware in routes:

```javascript
router.post('/notes', validate(createNoteSchema), createNote);
```

Schemas live in `/validators/*.js`.

---

## Prompts

- Define in `/config/prompts.js` as functions
- **NO** hardcoded prompts in controllers/services
- Prompts return `{ system, user }` objects

---

## Testing

- Controllers: Integration tests with supertest
- Services: Unit tests with mocked repos/providers
- Repos: Unit tests with mocked Supabase client

---

## PR Checklist

- [ ] Layer boundaries respected (no skip-layer imports)
- [ ] Validation schema added for new endpoints
- [ ] Prompts in `/config/prompts.js`, not inline
- [ ] Tests added for service logic
- [ ] `npm run test:backend` passes
