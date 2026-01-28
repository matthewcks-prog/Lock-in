# Lock-in Project AGENTS.md

> **Last Updated**: 2026-01-28  
> **Version**: 2.0 - Industry Standard Architecture Documentation

## Table of Contents

- [Project Overview](#project-overview)
- [Documentation Hierarchy](#documentation-hierarchy)
- [Core Principles](#core-principles)
- [Architectural Boundaries](#architectural-boundaries)
- [Cross-Cutting Concerns](#cross-cutting-concerns)
- [Reliability Requirements](#reliability-requirements)
- [Testing Strategy](#testing-strategy)
- [Making Changes](#making-changes)
- [Common Failure Modes](#common-failure-modes)
- [PR Quality Gates](#pr-quality-gates)
- [Sub-AGENTS Index](#sub-agents-index)

---

## Project Overview

**Lock-in** is an AI-powered study assistant Chrome extension focused on Monash University students. It helps students understand and explain content from learning platforms (Moodle, Edstem, Panopto, etc.) while capturing notes and tasks.

**Core Philosophy**: Extension-first, web-app-friendly. The extension is the primary surface; a future web app will share the same backend and data.

### Core Experience Loop

Every feature MUST reinforce this loop:

1. **Capture** → Highlight text / video / assignment spec
2. **Understand** → Explain / summarize
3. **Distil** → Turn into note, flashcard, or todo
4. **Organize** → Auto-bucket by unit, week, topic
5. **Act** → Show upcoming tasks, revision items, questions

**Decision filter**: Does this change support the loop? Does it make capture → understand → distil → organize → act easier?

---

## Documentation Hierarchy

This project uses a **stable contract + living snapshot** documentation approach:

### Stable Contracts (AGENTS Files)

- **`/AGENTS.md`** (this file) - Project-wide principles, boundaries, MUST/MUST NOT rules
- **`/backend/AGENTS.md`** - Backend layering, prompt contracts, testing
- **`/extension/AGENTS.md`** - Chrome-specific patterns, god file prevention
- **`/shared/ui/AGENTS.md`** - UI primitives only
- **`/core/AGENTS.md`** - Platform-agnostic domain logic
- **`/integrations/AGENTS.md`** - Site adapter patterns

**Update when**: Architectural boundaries, coding rules, or workflow patterns change

### Living Snapshots (Reference Docs)

- **`docs/architecture/ARCHITECTURE.md`** - Stable architecture invariants
- **`docs/tracking/STATUS.md`** - Outstanding issues, recent changes
- **`docs/reference/CODE_OVERVIEW.md`** - Current implementation details
- **`docs/reference/DATABASE.md`** - Database schema and migrations
- **`docs/architecture/REPO_MAP.md`** - Repository structure map

**Update when**: Implementation details change, files move, schema evolves

### Documentation Update Rules

| Change Type                | Files to Update                    | Required? |
| -------------------------- | ---------------------------------- | --------- |
| New architectural boundary | `/AGENTS.md` + relevant sub-AGENTS | **MUST**  |
| Database schema change     | `docs/reference/DATABASE.md`       | **MUST**  |
| File structure change      | `docs/reference/CODE_OVERVIEW.md`  | **MUST**  |
| Folder convention change   | Folder-level `AGENTS.md`           | **MUST**  |
| Implementation detail      | `docs/reference/CODE_OVERVIEW.md`  | SHOULD    |
| Refactoring                | `docs/tracking/REFACTOR_PLAN.md`   | SHOULD    |

---

## Core Principles

### 1. SOLID Principles (NON-NEGOTIABLE)

#### Single Responsibility Principle

- **MUST**: Each module has ONE reason to change
- **Example**: `userRepository.js` handles DB access only, NOT validation or business logic
- **Anti-pattern**: Controller that validates input, builds prompts, calls DB, and formats responses

#### Open/Closed Principle

- **MUST**: Open for extension, closed for modification
- **Example**: Site adapters implement `BaseAdapter` interface
- **Anti-pattern**: Adding `if (site === 'moodle')` checks throughout codebase

#### Liskov Substitution Principle

- **MUST**: Subtypes MUST be replaceable for base types without breaking behavior
- **Example**: Any `BaseAdapter` implementation can replace another
- **Anti-pattern**: Adapter that throws errors for `BaseAdapter` required methods

#### Interface Segregation Principle

- **MUST**: Clients MUST NOT depend on interfaces they don't use
- **Example**: `AsyncFetcher` vs `EnhancedAsyncFetcher` (optional capabilities)
- **Anti-pattern**: Forcing all adapters to implement video detection when only Panopto needs it

#### Dependency Inversion Principle

- **MUST**: Depend on abstractions, NOT concretions
- **Example**: Transcript providers depend on `fetcher` interface, NOT `chrome.runtime`
- **Anti-pattern**: Core code importing `chrome` directly

### 2. DRY (Don't Repeat Yourself)

- **MUST NOT**: Duplicate business logic across layers
- **Example**: Validation rules in ONE place (validators), used by controllers
- **Anti-pattern**: Same validation logic copied in controller and service

### 3. Separation of Concerns

```
/extension     → Chrome-specific code ONLY (manifest, background, content scripts)
/core          → Business logic, domain models (NO Chrome, NO Express)
/integrations  → Site-specific adapters (Moodle, Edstem)
/api           → Backend API client (NO Chrome dependencies)
/backend       → Node.js/Express server (NO browser globals)
/ui/extension  → Extension sidebar React components (NOT reused by web app)
/shared/ui     → Low-level UI primitives (Button, Card, Input)
```

**Litmus test**: Can you import `/core` in Node.js without errors? If not, you have leakage.

### 4. Testability

- **MUST**: All new modules MUST specify "how to test" in PR
- **MUST**: Business logic MUST be testable without mocking entire system
- **SHOULD**: Prefer pure functions (deterministic input → output)

### 5. Fail-Safe Defaults

- **MUST**: System MUST degrade gracefully when services fail
- **Example**: If OpenAI fails, show error message, don't crash extension
- **Anti-pattern**: Unhandled promise rejection crashing background script

---

## Architectural Boundaries

### Two Surfaces, One Backend

```
┌─────────────────────────────────────────────────────────┐
│                  CHROME EXTENSION                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Sidebar Widget (/ui/extension)                  │  │
│  │  - Chat, Notes, Settings                         │  │
│  │  - Extension-specific, NOT reused by web app     │  │
│  └──────────────────────────────────────────────────┘  │
│                         ↓                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Chrome Wrappers (/extension)                    │  │
│  │  - background.js, content scripts                │  │
│  │  - Chrome API wrappers                           │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│               SHARED LAYERS (Platform-Agnostic)          │
│  ┌──────────────┬──────────────┬──────────────────────┐│
│  │ /core        │ /api         │ /integrations        ││
│  │ Domain logic │ API client   │ Site adapters        ││
│  │ NO Chrome    │ NO Chrome    │ NO direct backend    ││
│  └──────────────┴──────────────┴──────────────────────┘│
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   BACKEND API (Node.js)                  │
│  Routes → Controllers → Services → Repos → DB/APIs       │
└─────────────────────────────────────────────────────────┘
```

### Layer Dependency Rules

**MUST follow these dependencies** (arrows show allowed direction):

```
Extension → Core → (nothing)
Extension → API → Core → (nothing)
Extension → Integrations → Core → (nothing)
Backend Controllers → Backend Services → Backend Repos → Supabase
Backend Services → Backend Providers → External APIs
```

**MUST NOT**:

- Core importing from Extension
- Core importing from Backend
- Integrations importing from Backend (use API client in extension layer)
- Services importing from Controllers

---

## Cross-Cutting Concerns

### Error Handling

**MUST use centralized error taxonomy** (`/core/errors/`):

```typescript
// Standardized error codes
ErrorCodes = {
  AUTH_INVALID_TOKEN: 'auth/invalid-token',
  VALIDATION_INVALID_INPUT: 'validation/invalid-input',
  NETWORK_TIMEOUT: 'network/timeout',
  // ... see /core/errors/ErrorCodes.ts
};

// Typed error classes
throw new AuthError(ErrorCodes.AUTH_INVALID_TOKEN, 'Token expired');
throw new ValidationError(ErrorCodes.VALIDATION_INVALID_INPUT, 'Invalid email');
throw new NetworkError(ErrorCodes.NETWORK_TIMEOUT, 'Request timed out');
```

**Error Handling Rules**:

1. **MUST**: Catch errors at boundaries (controllers, content scripts, background handlers)
2. **MUST**: Use typed error classes from `/core/errors`
3. **MUST**: Log errors with context (user ID, request ID, error code)
4. **MUST NOT**: Swallow errors silently
5. **SHOULD**: Provide user-friendly error messages via `getUserMessage()`

### Logging

**MUST use centralized logger** (`/core/utils/logger.ts`):

```typescript
import { logger } from '@core/utils/logger';

logger.debug('Fetching transcript', { videoId, provider });
logger.info('Transcript cached', { videoId, segments: count });
logger.warn('Fallback to AI transcription', { videoId });
logger.error('Transcript extraction failed', { videoId, error });
```

**Logging Rules**:

1. **MUST**: Use structured logging (objects, not string concatenation)
2. **MUST**: Include context (IDs, operation name, duration)
3. **MUST NOT**: Log sensitive data (passwords, tokens, PII)
4. **SHOULD**: Use appropriate log levels (debug/info/warn/error)
5. **SHOULD**: Use `transcriptLogger` for transcript-specific logs (domain-specific loggers)

### Security & Privacy

**MUST follow these privacy rules**:

1. **No API keys in extension code** - Use backend proxy
2. **No user data in logs** - Redact sensitive fields
3. **Input validation at ALL boundaries** - Don't trust frontend
4. **Rate limiting** - Protect against abuse
5. **CORS restrictions** - Locked to known origins

**Example - Sensitive Data Redaction**:

```javascript
// ❌ BAD
logger.info('User logged in', { email: user.email, token: user.token });

// ✅ GOOD
logger.info('User logged in', { userId: user.id });
```

### Telemetry

**Error tracking** (Sentry):

- **Extension**: Isolated `BrowserClient` + `Scope` (not `Sentry.init()`)
- **Privacy**: Request bodies, auth headers, query params stripped
- **User context**: NOT attached to error events

---

## Reliability Requirements

### 1. Retry & Timeout Policy

**MUST use shared retry wrappers**:

- **Extension**: `/extension/src/networkUtils.js` (Chrome-specific CORS/credentials)
- **API client**: `/api/fetcher.ts` (exponential backoff with jitter)
- **Backend**: `/backend/providers/withFallback.js` (retry + fallback)

**Retry Rules**:

1. **MUST**: Retry transient errors (429, 502, 503, 504)
2. **MUST**: Use exponential backoff with jitter (prevent thundering herd)
3. **MUST**: Set max retries (3-5 attempts)
4. **MUST NOT**: Retry non-idempotent operations without idempotency keys
5. **MUST**: Set timeouts (network: 30s, LLM: 60s, transcription: 5min)

### 2. Idempotency

**MUST be idempotent** (safe to retry):

- Note creation (via idempotency key)
- Chat message insertion (duplicate detection)
- File uploads (via content hash)
- Transcript job creation (via video ID + user ID)

**Implementation**:

```javascript
// Backend: Idempotency store
const { createIdempotencyStore } = require('../utils/idempotency');
const idempotencyStore = createIdempotencyStore();

// Controller: Check idempotency key
const key = extractIdempotencyKey(req);
const cached = await idempotencyStore.get(key);
if (cached) return res.status(cached.status).json(cached.body);
```

### 3. Input Validation

**MUST validate at boundaries**:

```javascript
// ❌ BAD - Trusting frontend input
const user = await db.users.findById(req.body.userId);

// ✅ GOOD - Validate UUID format
const { userId } = req.body;
if (!isValidUUID(userId)) {
  throw new ValidationError('Invalid user ID format');
}
const user = await db.users.findById(userId);
```

**Validation Rules**:

1. **MUST**: Validate at HTTP entry (controllers)
2. **MUST**: Check types, formats, lengths, ranges
3. **MUST**: Whitelist allowed values (not blacklist)
4. **MUST**: Sanitize user inputs (prevent XSS, SQL injection)
5. **SHOULD**: Use shared validation schemas (Zod, Joi)

### 4. Scalability Guardrails

**MUST NOT store cross-request state in memory**:

- ❌ In-memory job queue (lost on restart)
- ❌ In-memory rate limits (inconsistent across instances)
- ❌ In-memory locks (not distributed)

**MUST use durable storage**:

- ✅ Supabase for jobs, rate limits, idempotency
- ✅ Supabase Storage for transcript chunks
- ✅ Database for locks (advisory locks)

---

## Testing Strategy

### Testing Pyramid

```
         ╱╲
        ╱  ╲         E2E Tests (Manual)
       ╱────╲        - Extension flows on real sites
      ╱      ╲       - User acceptance testing
     ╱────────╲
    ╱          ╲     Integration Tests
   ╱            ╲    - Backend API contracts
  ╱──────────────╲   - Adapter with real DOM
 ╱                ╲
╱──────────────────╲ Unit Tests (Most tests here)
                     - Pure functions
                     - Services with mocked dependencies
                     - Utilities
```

### Unit Testing Rules

**MUST write unit tests for**:

- Pure functions (`/core/utils`)
- Business logic (`/core/services`, `/backend/services`)
- Adapters (`/integrations/adapters`)
- Parsers (`/core/transcripts/parsers`)

**Unit Test Pattern**:

```javascript
// ✅ GOOD - Mock dependencies
test('extractTranscript with Panopto captions', async () => {
  const mockFetcher = {
    fetch: async (url) => ({ ok: true, text: async () => 'WEBVTT\n...' }),
  };

  const provider = new PanoptoProvider();
  const result = await provider.extractTranscript(video, mockFetcher);

  assert.equal(result.segments.length, 5);
});
```

**MUST NOT**:

- Test implementation details (private methods)
- Make real network calls in unit tests
- Use real database in unit tests

### Integration Testing Rules

**MUST write integration tests for**:

- Backend controllers (with mock services)
- API client (with mock backend)
- Adapter selection (with real DOM fixtures)

**Integration Test Pattern**:

```javascript
// Backend controller test
test('POST /api/notes creates note', async () => {
  const mockService = {
    createNote: async (data) => ({ id: '123', ...data }),
  };

  const res = await request(app)
    .post('/api/notes')
    .send({ title: 'Test', content: 'Content' })
    .expect(201);

  assert.equal(res.body.id, '123');
});
```

### Test File Naming

**MUST follow these conventions**:

- ✅ Unit tests: `*.test.js`, `*.test.ts`
- ✅ Integration tests: `*.integration.test.js`
- ❌ NEVER: `test-*.js` (conflicts with test runner)
- ✅ Utilities: `verify-*`, `check-*`, `setup-*`

### Mocking Guidelines

**MUST mock these external dependencies**:

| Dependency  | Mock Strategy         | Example                                                  |
| ----------- | --------------------- | -------------------------------------------------------- |
| Supabase    | Mock client methods   | `supabase.from().select()` returns fixture               |
| OpenAI      | Mock SDK methods      | `client.chat.completions.create()` returns mock response |
| Chrome APIs | Mock `chrome.*`       | `chrome.storage.local.get()` returns test data           |
| Fetcher     | Mock interface        | `fetcher.fetch()` returns mock HTTP response             |
| DOM         | Use jsdom or fixtures | `document.querySelector()` works with fixture HTML       |

**Example**:

```javascript
// Mock Supabase
const mockSupabase = {
  from: () => ({
    select: () => ({ data: [{ id: '1', title: 'Note' }], error: null }),
    insert: () => ({ data: { id: '2' }, error: null }),
  }),
};
```

---

## Making Changes

### Workflow Summary

1. **Scan docs** → Read `/AGENTS.md` + relevant sub-AGENTS + `docs/reference/CODE_OVERVIEW.md`
2. **Plan** → Identify files, check boundaries, determine doc updates
3. **Implement** → Follow layer rules, respect patterns
4. **Test** → Add tests per testing strategy
5. **Document** → Update living docs (DATABASE.md, CODE_OVERVIEW.md)
6. **Review** → Use PR checklist

### Golden Paths (Detailed in Sub-AGENTS)

- **Adding a backend endpoint** → See `/backend/AGENTS.md`
- **Adding an extension feature** → See `/extension/AGENTS.md`
- **Adding a new site** → See `/integrations/AGENTS.md`
- **Adding core domain logic** → See `/core/AGENTS.md`
- **Adding UI components** → See `/shared/ui/AGENTS.md`

---

## Common Failure Modes

### 1. God Files

**Symptom**: Single file >500 lines with multiple responsibilities

**Examples**:

- `background.js` handling routing + fetching + business logic
- `lockinController.js` validating + building prompts + calling DB + formatting

**Prevention**:

- **MUST**: Extract functions to focused modules when file >200 lines (controllers), >300 lines (services)
- **MUST**: Delegate to helpers/utils for complex logic
- **SHOULD**: Review file structure every sprint

**Fix**:

```javascript
// ❌ BAD - God controller
async function handleRequest(req, res) {
  // 200 lines of validation
  // 100 lines of prompt building
  // 50 lines of DB queries
  // 50 lines of formatting
}

// ✅ GOOD - Delegated
async function handleRequest(req, res) {
  const validated = validateInput(req.body); // validation.js
  const prompt = buildPrompt(validated); // promptBuilder.js
  const result = await service.process(prompt); // service.js
  res.json(formatResponse(result)); // formatter.js
}
```

### 2. Layering Violations

**Symptom**: Controllers calling DB directly, services depending on Express

**Examples**:

- Controller imports `supabaseClient.js`
- Service function takes `req, res` parameters
- Core code imports `chrome.storage`

**Prevention**:

- **MUST**: Review imports in PR (controllers should NOT import Supabase)
- **SHOULD**: Use ESLint rules to enforce boundaries
- **MUST**: Reject PRs with cross-layer imports

**Fix**:

```javascript
// ❌ BAD - Controller accesses DB
async function createNote(req, res) {
  const note = await supabase.from('notes').insert(req.body);
}

// ✅ GOOD - Controller calls service
async function createNote(req, res) {
  const validated = validateNoteInput(req.body);
  const note = await noteService.create(validated, req.user.id);
  res.json(note);
}
```

### 3. Scattered Prompts

**Symptom**: Prompt strings in controllers, hardcoded system messages

**Examples**:

- `const systemMessage = "You are a helpful assistant"` in controller
- Prompt construction mixed with HTTP handling

**Prevention**:

- **MUST**: Build prompts in dedicated prompt builder modules
- **MUST**: Define prompt contracts (inputs, max lengths, sanitization)
- **MUST**: Keep prompt logic in services or utils, NOT controllers

**Fix**: See `/backend/AGENTS.md` for prompt-building patterns

### 4. Platform Leakage

**Symptom**: `/core` code using `window`, `chrome`, `document`

**Examples**:

- Transcript provider calling `chrome.storage` directly
- Domain service using `localStorage`

**Prevention**:

- **MUST**: Pass platform APIs as parameters (Dependency Injection)
- **MUST**: Use interfaces for platform-specific code (fetcher pattern)
- **MUST**: Test core code in Node.js environment (catches browser globals)

**Fix**: See `/core/AGENTS.md` for platform-agnostic patterns

### 5. Missing Tests

**Symptom**: PR adds business logic without tests

**Examples**:

- New service method with no unit test
- New validation rule with no test cases
- Bug fix with no regression test

**Prevention**:

- **MUST**: Require tests for all new business logic (PR checklist)
- **SHOULD**: Enforce coverage thresholds (80%+ for services/utils)
- **MUST**: Review test quality, not just presence

---

## PR Quality Gates

### Mandatory Checklist

Before merging, PR **MUST** satisfy:

- [ ] **Supports Core Loop**: Change reinforces Capture → Understand → Distil → Organize → Act
- [ ] **Layer Boundaries**: No cross-layer imports (see [Architectural Boundaries](#architectural-boundaries))
- [ ] **File Size**: Controllers <200 lines, Services <300 lines (or justification provided)
- [ ] **Platform Purity**: `/core` and `/api` free of browser globals (`window`, `document`, `chrome`)
- [ ] **Prompt Building**: Prompts in dedicated builders, NOT controllers (backend only)
- [ ] **Error Handling**: Uses centralized error types from `/core/errors`
- [ ] **Retry/Timeout**: Network calls use shared retry wrappers
- [ ] **Input Validation**: All boundaries validate input (controllers, background handlers)
- [ ] **Testing**: Business logic has unit tests, boundaries have integration tests
- [ ] **Mocking**: Test mocks external dependencies (Supabase, OpenAI, Chrome APIs)
- [ ] **Documentation**: Updated `docs/reference/CODE_OVERVIEW.md` if file structure changed
- [ ] **Documentation**: Updated `docs/reference/DATABASE.md` if schema changed
- [ ] **Documentation**: Updated folder `AGENTS.md` if conventions changed

### Recommended Checks

**SHOULD** satisfy (best practices):

- [ ] Test coverage >80% for services/utils
- [ ] No code duplication (DRY violations)
- [ ] Accessibility: UI components are keyboard-navigable with ARIA labels
- [ ] Performance: No unnecessary re-renders, debounced autosave
- [ ] Security: No sensitive data in logs, inputs sanitized

### Size Limits

| File Type  | Max Lines | Justification Required? |
| ---------- | --------- | ----------------------- |
| Controller | 200       | Yes, if exceeded        |
| Service    | 300       | Yes, if exceeded        |
| Repository | 200       | Yes, if exceeded        |
| Component  | 150       | Yes, if exceeded        |
| Utility    | 100       | No (pure functions)     |

**When size exceeded**: Extract helper functions, split into multiple modules

---

## Sub-AGENTS Index

Each sub-AGENTS file inherits principles from this root file and adds layer-specific enforcement:

### `/backend/AGENTS.md`

**Purpose**: Backend API layering, prompt contracts, provider patterns  
**Key Rules**: Routes → Controllers → Services → Repos → DB/APIs  
**Golden Path**: Adding a new API endpoint  
**See**: [backend/AGENTS.md](./backend/AGENTS.md)

### `/extension/AGENTS.md`

**Purpose**: Chrome extension wrappers, god file prevention  
**Key Rules**: Thin wrappers, delegate to core/services  
**Golden Path**: Adding Chrome extension feature  
**See**: [extension/AGENTS.md](./extension/AGENTS.md)

### `/core/AGENTS.md`

**Purpose**: Platform-agnostic domain logic, pure functions, DI  
**Key Rules**: No browser globals, no Express, pure functions preferred  
**Golden Path**: Adding domain logic, transcript provider  
**See**: [core/AGENTS.md](./core/AGENTS.md)

### `/integrations/AGENTS.md`

**Purpose**: Site adapters (Moodle, Edstem, Panopto)  
**Key Rules**: Implement `BaseAdapter`, pure DOM parsing  
**Golden Path**: Adding a new site integration  
**See**: [integrations/AGENTS.md](./integrations/AGENTS.md)

### `/shared/ui/AGENTS.md`

**Purpose**: Low-level UI primitives (Button, Card, Input)  
**Key Rules**: No business logic, accessible by default  
**Golden Path**: Adding reusable UI component  
**See**: [shared/ui/AGENTS.md](./shared/ui/AGENTS.md)

---

## Questions?

1. Check relevant sub-AGENTS file for layer-specific rules
2. Review `docs/reference/CODE_OVERVIEW.md` for current implementation
3. Check `docs/tracking/STATUS.md` for outstanding issues
4. Ask before making large architectural changes

**Remember**: Extension-first, but web-app-friendly. Keep shared code (`/core`, `/api`, `/integrations`) platform-agnostic. Follow the principle hierarchy: this file defines rules, sub-AGENTS enforce them.
