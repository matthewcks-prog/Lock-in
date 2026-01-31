# Backend AGENTS.md

> **Inherits from**: [/AGENTS.md](../AGENTS.md)  
> **Last Updated**: 2026-01-28  
> **Purpose**: Backend API layering, prompt contracts, testing, provider patterns

## Table of Contents

- [Purpose](#purpose)
- [Non-Goals](#non-goals)
- [Architectural Boundaries](#architectural-boundaries)
- [Allowed & Forbidden Imports](#allowed--forbidden-imports)
- [Required Patterns](#required-patterns)
- [Testing Rules](#testing-rules)
- [Error Handling Rules](#error-handling-rules)
- [Logging & Telemetry](#logging--telemetry)
- [Security & Privacy](#security--privacy)
- [Golden Path Workflows](#golden-path-workflows)
- [Common Failure Modes](#common-failure-modes)
- [PR Checklist](#pr-checklist)

---

## Purpose

The `/backend` directory contains the **Node.js/Express API server** that:

1. Authenticates requests (Supabase JWT)
2. Handles AI processing (OpenAI chat completions, embeddings, transcription)
3. Manages data persistence (notes, chats, transcripts, assets)
4. Enforces rate limiting and quotas
5. Provides durable job processing (transcript AI fallback)

**This directory SHOULD contain**:

- HTTP routes and middleware
- Request/response transformation (controllers)
- Business logic orchestration (services)
- Database access (repositories)
- External API clients (providers)
- Migrations and configuration

**This directory MUST NOT contain**:

- Browser-specific code (`window`, `document`, DOM manipulation)
- Chrome extension APIs
- UI rendering logic (use `/ui` for React components)
- Site-specific adapters (use `/integrations`)

---

## Non-Goals

**What this layer is NOT**:

- NOT a Chrome extension (that's `/extension`)
- NOT a UI framework (that's `/ui`)
- NOT a site adapter (that's `/integrations`)
- NOT a domain logic library (that's `/core`)

---

## Architectural Boundaries

### Strict Layering (NON-NEGOTIABLE)

```
┌──────────────────────────────────────────────────┐
│  ROUTES (Wiring Only)                            │
│  - HTTP method + path → handler                  │
│  - Middleware chain assembly                     │
│  - MAX 50 lines per route file                   │
└──────────────────────┬───────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────┐
│  CONTROLLERS (HTTP Translation)                  │
│  - Parse req.params, req.query, req.body         │
│  - Validate inputs (UUIDs, formats)              │
│  - Call service layer                            │
│  - Map results to HTTP (status + JSON)           │
│  - MAX 200 lines per controller                  │
└──────────────────────┬───────────────────────────┘
                       ↓
┌──────────────────────────────────────────────────┐
│  SERVICES (Business Logic & Orchestration)       │
│  - Implement business rules                      │
│  - Orchestrate repository calls                  │
│  - Build prompts (via prompt builders)           │
│  - Handle idempotency boundaries                 │
│  - MAX 300 lines per service                     │
└──────────────────────┬───────────────────────────┘
                       ↓
┌──────────────┬───────────────────────────────────┐
│ REPOSITORIES │  PROVIDERS (External APIs)        │
│ (DB Access)  │  - OpenAI SDK wiring              │
│ - Supabase   │  - Retry/fallback logic           │
│   queries    │  - Timeout enforcement            │
│ - No         │  - NO DB, NO Express              │
│   business   │  - MAX 200 lines per provider     │
│   logic      │                                   │
│ - MAX 200    │                                   │
│   lines      │                                   │
└──────────────┴───────────────────────────────────┘
                       ↓
               ┌──────────────┐
               │  Supabase    │
               │  OpenAI      │
               │  FFmpeg      │
               └──────────────┘
```

### Layer Responsibilities

| Layer            | Responsibility               | Calls                                    | Called By   | Size Limit |
| ---------------- | ---------------------------- | ---------------------------------------- | ----------- | ---------- |
| **Routes**       | HTTP wiring                  | Controllers                              | Express     | 50 lines   |
| **Controllers**  | HTTP ↔ Service translation   | Services, Validators                     | Routes      | 200 lines  |
| **Services**     | Business logic orchestration | Repositories, Providers, Prompt Builders | Controllers | 300 lines  |
| **Repositories** | DB access only               | Supabase                                 | Services    | 200 lines  |
| **Providers**    | External API wrappers        | OpenAI, FFmpeg                           | Services    | 200 lines  |

---

## Allowed & Forbidden Imports

### Routes

**MUST import**:

- `express` (Router, Request, Response)
- Controllers (handler functions)
- Middleware (`authMiddleware`, `uploadMiddleware`)

**MUST NOT import**:

- Supabase client
- OpenAI client
- Services or Repositories (call via controllers)

**Example**:

```javascript
// ✅ GOOD
const express = require('express');
const { createNote, listNotes } = require('../controllers/notes/crud');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/notes', authenticate, createNote);
```

### Controllers

**MUST import**:

- Services (business logic)
- Validators (input validation)
- Core domain types (`/core/domain/types.ts`)
- Error types (`/core/errors`)

**MUST NOT import**:

- `db/supabaseClient.js` (use services/repos instead)
- `services/llmClient.js` (use services/providers instead)
- Repositories directly (use services as intermediary)

**Example**:

```javascript
// ✅ GOOD
const { noteService } = require('../services/noteService');
const { validateNoteInput } = require('../utils/validation');
const { ValidationError } = require('../../core/errors');

async function createNote(req, res) {
  const validated = validateNoteInput(req.body);
  const note = await noteService.create(validated, req.user.id);
  res.status(201).json(note);
}

// ❌ BAD
const supabase = require('../db/supabaseClient'); // NO!
async function createNote(req, res) {
  const note = await supabase.from('notes').insert(req.body); // NO!
}
```

### Services

**MUST import**:

- Repositories (data access)
- Providers (external APIs)
- Prompt builders (`/backend/utils/prompts/`)
- Core domain types
- Other services (for orchestration)

**MUST NOT import**:

- `express` types (no `req`, `res` parameters)
- Controllers
- Middleware
- `supabaseClient` directly (use repositories)

**Example**:

```javascript
// ✅ GOOD
const { notesRepository } = require('../repositories/notesRepository');
const { buildChatPrompt } = require('../utils/prompts/chatPrompts');
const { getPrimaryProvider } = require('../providers/llm');

async function generateChatResponse(input, context, userId) {
  const prompt = buildChatPrompt({ input, context });
  const provider = getPrimaryProvider();
  const response = await provider.chatCompletion(prompt.messages, {
    model: prompt.model,
    temperature: prompt.temperature,
  });
  return response;
}

// ❌ BAD - Depends on Express
async function generateChatResponse(req, res) { // NO req/res!
  const prompt = `You are a helpful assistant...`; // NO inline prompts!
  const response = await openai.chat.completions.create(...); // NO direct OpenAI!
}
```

### Repositories

**MUST import**:

- `db/supabaseClient.js` ONLY
- Core domain types

**MUST NOT import**:

- OpenAI client
- Express types
- Services or Controllers
- Prompt builders

**Example**:

```javascript
// ✅ GOOD
const supabase = require('../db/supabaseClient');

async function createNote(userId, noteData) {
  const { data, error } = await supabase
    .from('notes')
    .insert({ user_id: userId, ...noteData })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### Providers

**MUST import**:

- External SDKs (OpenAI, Azure)
- Retry/fallback utilities (`withFallback.js`)
- Core domain types

**MUST NOT import**:

- Supabase client
- Express types
- Services or Controllers
- Repositories

**Example**:

```javascript
// ✅ GOOD - Provider
const OpenAI = require('openai');
const { withFallback } = require('./withFallback');

async function chatCompletion(messages, options = {}) {
  return withFallback(
    () => primaryClient.chat.completions.create({ messages, ...options }),
    () => fallbackClient.chat.completions.create({ messages, ...options }),
  );
}
```

---

## Required Patterns

### 1. Prompt Building Contract

**MUST build prompts in dedicated modules** (`/backend/utils/prompts/` or `/backend/services/prompts/`):

```javascript
// ✅ GOOD - Dedicated prompt builder
// File: /backend/utils/prompts/chatPrompts.js

function buildChatPrompt({ mode, input, context, maxLength = 4000 }) {
  if (!mode || !input) {
    throw new ValidationError('mode and input are required');
  }

  // Sanitization
  const sanitizedInput = sanitizeInput(input, maxLength);
  const sanitizedContext = context ? sanitizeInput(context, maxLength) : '';

  // Prompt construction
  const sections = [
    buildSystemMessage(mode),
    buildContextSection(sanitizedContext),
    buildUserPrompt(sanitizedInput, mode),
  ];

  return {
    messages: sections.filter(Boolean),
    model: getModelForMode(mode),
    temperature: getTemperatureForMode(mode),
  };
}

module.exports = { buildChatPrompt };
```

**Prompt Contract Requirements**:

1. **MUST**: Accept structured parameters (no raw strings from controllers)
2. **MUST**: Sanitize inputs (remove sensitive data, enforce max lengths)
3. **MUST**: Redact secrets (API keys, tokens, passwords)
4. **MUST**: Handle "selection" vs full context
5. **SHOULD**: Return prompt object with `messages`, `model`, `temperature`

**Controller Usage**:

```javascript
// ✅ GOOD - Controller calls prompt builder via service
async function handleChatRequest(req, res) {
  const { mode, input, context } = validateChatInput(req.body);
  const response = await chatService.processChat({
    mode,
    input,
    context,
    userId: req.user.id,
  });
  res.json(response);
}

// Service layer
async function processChat({ mode, input, context, userId }) {
  const prompt = buildChatPrompt({ mode, input, context }); // Prompt builder
  const result = await llmProvider.chat(prompt.messages, {
    model: prompt.model,
    temperature: prompt.temperature,
  });
  return result;
}
```

### 2. Service Layer Idempotency

**MUST wrap idempotent operations**:

```javascript
// ✅ GOOD - Service implements idempotency
async function createNote(noteData, userId, idempotencyKey) {
  // Check idempotency first
  const cached = await idempotencyStore.get(idempotencyKey);
  if (cached) return cached.result;

  // Execute unit of work
  const note = await notesRepository.create(userId, noteData);

  // Cache result
  await idempotencyStore.set(idempotencyKey, { result: note, status: 201 });

  return note;
}
```

**Idempotent Operations**:

- Note creation
- Chat message insertion
- File uploads
- Job creation

### 3. Error Mapping

**MUST use centralized error-to-HTTP mapping**:

```javascript
// ✅ GOOD - Controller maps errors to HTTP
const { AppError, AuthError, ValidationError, NotFoundError } = require('../../core/errors');

async function createNote(req, res) {
  try {
    const validated = validateNoteInput(req.body);
    const note = await noteService.create(validated, req.user.id);
    res.status(201).json(note);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.getUserMessage() });
    }
    if (error instanceof AuthError) {
      return res.status(401).json({ error: error.getUserMessage() });
    }
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.getUserMessage() });
    }
    // Unknown error
    logger.error('Unexpected error in createNote', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

**OR use centralized error handler middleware**:

```javascript
// middleware/errorHandler.js
function errorHandler(err, req, res, next) {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.getUserMessage() });
  }
  // ... handle other error types
}
```

### 4. Input Validation at Boundary

**MUST validate at controller entry**:

```javascript
// ✅ GOOD - Validation utility
function validateNoteInput(body) {
  const { title, content, tags = [] } = body;

  if (!title || typeof title !== 'string') {
    throw new ValidationError('title is required and must be a string');
  }

  if (title.length > 200) {
    throw new ValidationError('title must be ≤200 characters');
  }

  if (content && content.length > 50000) {
    throw new ValidationError('content must be ≤50,000 characters');
  }

  if (!Array.isArray(tags) || tags.length > 20) {
    throw new ValidationError('tags must be an array with ≤20 items');
  }

  return { title: title.trim(), content, tags };
}
```

---

## Testing Rules

### Controller Tests

**MUST mock service layer**:

```javascript
// controllers/__tests__/notesCrud.test.js
const { test } = require('node:test');
const assert = require('node:assert');

test('createNote returns 201 on success', async () => {
  const mockService = {
    create: async (data, userId) => ({ id: '123', ...data, userId }),
  };

  const req = {
    body: { title: 'Test', content: 'Content' },
    user: { id: 'user-1' },
  };
  const res = {
    status: (code) => {
      assert.equal(code, 201);
      return {
        json: (data) => {
          assert.equal(data.id, '123');
        },
      };
    },
  };

  // Inject mock service
  const controller = createController(mockService);
  await controller.createNote(req, res);
});
```

### Service Tests

**MUST mock repositories and providers**:

```javascript
// services/__tests__/chatService.test.js
test('processChat builds prompt and calls LLM', async () => {
  const mockRepo = {
    saveMessage: async (msg) => ({ id: '456', ...msg }),
  };
  const mockProvider = {
    chat: async (messages) => ({ content: 'AI response' }),
  };

  const service = createChatService(mockRepo, mockProvider);
  const result = await service.processChat({
    mode: 'explain',
    input: 'What is React?',
    userId: 'user-1',
  });

  assert.equal(result.content, 'AI response');
});
```

### Repository Tests

**MUST mock Supabase client**:

```javascript
// repositories/__tests__/notesRepository.test.js
test('createNote inserts into database', async () => {
  const mockSupabase = {
    from: () => ({
      insert: () => ({
        select: () => ({
          single: () => ({
            data: { id: '789', title: 'Note' },
            error: null,
          }),
        }),
      }),
    }),
  };

  const repo = createNotesRepository(mockSupabase);
  const note = await repo.create('user-1', { title: 'Note' });

  assert.equal(note.id, '789');
});
```

### Provider Tests

**MUST mock OpenAI SDK**:

```javascript
// providers/__tests__/llmProvider.test.js
test('chatCompletion calls OpenAI with retry', async () => {
  let callCount = 0;
  const mockClient = {
    chat: {
      completions: {
        create: async (params) => {
          callCount++;
          if (callCount === 1) throw new Error('Transient error');
          return { choices: [{ message: { content: 'Response' } }] };
        },
      },
    },
  };

  const provider = createProvider(mockClient);
  const result = await provider.chat([{ role: 'user', content: 'Hi' }]);

  assert.equal(callCount, 2); // Retried once
  assert.equal(result.content, 'Response');
});
```

### Test File Naming

**MUST follow**:

- ✅ `*.test.js` for unit tests
- ✅ `*.integration.test.js` for integration tests
- ❌ NEVER `test-*.js` (conflicts with test runner)

---

## Error Handling Rules

### 1. Use Centralized Error Types

**MUST throw typed errors**:

```javascript
const { ValidationError, AuthError, NotFoundError } = require('../../core/errors');

// ✅ GOOD
if (!isValidUUID(userId)) {
  throw new ValidationError('Invalid user ID format');
}

if (!user) {
  throw new NotFoundError(`User ${userId} not found`);
}
```

### 2. Log Errors with Context

**MUST log errors before throwing/returning**:

```javascript
// ✅ GOOD
try {
  const result = await externalAPI.call();
} catch (error) {
  logger.error('External API call failed', {
    service: 'externalAPI',
    method: 'call',
    userId: req.user.id,
    errorCode: error.code,
    errorMessage: error.message,
  });
  throw new NetworkError('External service unavailable');
}
```

### 3. Never Swallow Errors Silently

**MUST handle or propagate errors**:

```javascript
// ❌ BAD
try {
  await riskyOperation();
} catch (error) {
  // Silent failure - bad!
}

// ✅ GOOD - Propagate
try {
  await riskyOperation();
} catch (error) {
  logger.error('Risky operation failed', { error });
  throw error; // Re-throw
}

// ✅ GOOD - Handle with fallback
try {
  return await riskyOperation();
} catch (error) {
  logger.warn('Risky operation failed, using fallback', { error });
  return fallbackValue;
}
```

---

## Logging & Telemetry

### Structured Logging

**MUST use structured logs** (objects, not strings):

```javascript
const { logger } = require('../observability/logger');

// ✅ GOOD
logger.info('Note created', {
  noteId: note.id,
  userId: user.id,
  contentLength: note.content.length,
  duration: Date.now() - startTime,
});

// ❌ BAD
logger.info(`Note ${note.id} created by ${user.id}`); // String concatenation
```

### Log Levels

| Level   | When to Use                  | Example                                                     |
| ------- | ---------------------------- | ----------------------------------------------------------- |
| `debug` | Development debugging        | `logger.debug('Cache hit', { key })`                        |
| `info`  | Normal operations            | `logger.info('Request processed', { requestId, duration })` |
| `warn`  | Recoverable errors           | `logger.warn('Fallback used', { reason })`                  |
| `error` | Failures requiring attention | `logger.error('DB query failed', { error, query })`         |

### Sensitive Data Redaction

**MUST NOT log**:

- Passwords, tokens, API keys
- Email addresses (use user ID instead)
- Full request/response bodies (log size/shape only)

```javascript
// ✅ GOOD
logger.info('User logged in', {
  userId: user.id,
  method: 'oauth',
});

// ❌ BAD
logger.info('User logged in', {
  email: user.email, // PII
  token: user.accessToken, // Secret
});
```

---

## Security & Privacy

### 1. Authentication

**MUST validate JWT on protected routes**:

```javascript
// middleware/authMiddleware.js
async function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const { data: user, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = user; // Attach to request
  next();
}
```

### 2. Input Sanitization

**MUST sanitize user inputs**:

```javascript
function sanitizeInput(input, maxLength = 10000) {
  if (typeof input !== 'string') return '';

  // Remove null bytes, control characters
  let cleaned = input.replace(/\0/g, '').replace(/[\x00-\x1F\x7F]/g, '');

  // Trim whitespace
  cleaned = cleaned.trim();

  // Enforce max length
  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength);
  }

  return cleaned;
}
```

### 3. Rate Limiting

**MUST enforce per-user rate limits**:

```javascript
// Configured in services/rateLimitService.js
const RATE_LIMITS = {
  AI_REQUESTS: { windowMs: 60000, maxRequests: 20 }, // 20/min
  CHAT_ASSETS: { windowMs: 60000, maxRequests: 5 }, // 5/min
};
```

---

## Golden Path Workflows

### Adding a New API Endpoint

**Step-by-step**:

1. **Define route** (`routes/featureRoutes.js`):

```javascript
router.post('/feature', authenticate, handleFeature);
```

2. **Create controller** (`controllers/featureController.js`):

```javascript
async function handleFeature(req, res) {
  const validated = validateFeatureInput(req.body);
  const result = await featureService.process(validated, req.user.id);
  res.status(200).json(result);
}
```

3. **Create service** (`services/featureService.js`):

```javascript
async function process(input, userId) {
  const data = await repository.getData(userId);
  const result = await provider.callExternalAPI(input, data);
  await repository.saveResult(userId, result);
  return result;
}
```

4. **Add validation** (`utils/validation.js`):

```javascript
function validateFeatureInput(body) {
  // Validate types, lengths, formats
  return sanitized;
}
```

5. **Write tests**:
   - Controller test (mock service)
   - Service test (mock repo + provider)
   - Validation test

6. **Update docs**:
   - `docs/reference/CODE_OVERVIEW.md` (new controller/service)
   - `docs/reference/DATABASE.md` (if schema changed)

---

## Common Failure Modes

### 1. Prompt Building in Controllers

**Symptom**: Controllers contain LLM prompt strings

```javascript
// ❌ BAD
async function handleChat(req, res) {
  const systemMessage = "You are a helpful assistant..."; // NO!
  const response = await openai.chat.completions.create({
    messages: [{ role: 'system', content: systemMessage }, ...]
  });
}

// ✅ GOOD
async function handleChat(req, res) {
  const { mode, input, context } = validateChatInput(req.body);
  const response = await chatService.processChat({ mode, input, context, userId: req.user.id });
  res.json(response);
}
```

**Fix**: Extract to `utils/prompts/` or `services/prompts/`

### 2. DB Calls in Controllers

**Symptom**: Controllers import `supabaseClient`

```javascript
// ❌ BAD
const supabase = require('../db/supabaseClient');

async function createNote(req, res) {
  const { data } = await supabase.from('notes').insert(req.body);
  res.json(data);
}

// ✅ GOOD
async function createNote(req, res) {
  const validated = validateNoteInput(req.body);
  const note = await noteService.create(validated, req.user.id);
  res.status(201).json(note);
}
```

**Fix**: Move to service → repository

### 3. Business Logic in Repositories

**Symptom**: Repositories calculate, transform, or validate

```javascript
// ❌ BAD - Repository
async function createNote(userId, noteData) {
  // Business logic in repository - NO!
  if (noteData.tags.length > 20) {
    throw new Error('Too many tags');
  }

  const embedding = await calculateEmbedding(noteData.content); // NO!

  return supabase.from('notes').insert({ ...noteData, embedding });
}

// ✅ GOOD - Service handles business logic
async function createNote(userId, noteData) {
  validateNoteTags(noteData.tags); // Service layer
  const embedding = await embeddingService.generate(noteData.content); // Service
  return notesRepository.create(userId, { ...noteData, embedding }); // Repository
}
```

**Fix**: Move validation/business logic to services

### 4. Express in Services

**Symptom**: Service functions accept `req, res`

```javascript
// ❌ BAD
async function processChat(req, res) {
  const { input } = req.body;
  const result = await llm.process(input);
  res.json(result);
}

// ✅ GOOD
async function processChat(input, userId) {
  const result = await llm.process(input);
  return result;
}
```

**Fix**: Remove Express dependencies from services

### 5. God Controllers

**Symptom**: Controller >200 lines with mixed responsibilities

**Fix**: Extract validators, prompt builders, formatters to separate modules

---

## PR Checklist

Before merging backend changes, verify:

### Layering

- [ ] Routes only wire HTTP (no business logic) - <50 lines
- [ ] Controllers only translate HTTP ↔ service (no DB, no prompts) - <200 lines
- [ ] Services orchestrate business logic (no Express, no inline prompts) - <300 lines
- [ ] Repositories only access DB (no business logic) - <200 lines
- [ ] Providers only wrap external APIs (no DB, no Express) - <200 lines

### Prompts

- [ ] Prompts built in dedicated modules (`utils/prompts/` or `services/prompts/`)
- [ ] Prompt builders accept structured parameters (not raw strings)
- [ ] Inputs sanitized (max lengths, redaction, XSS prevention)
- [ ] No prompt strings in controllers

### Testing

- [ ] Controllers tested with mocked services
- [ ] Services tested with mocked repos + providers
- [ ] Repositories tested with mocked Supabase client
- [ ] Providers tested with mocked SDKs
- [ ] Test coverage >80% for services/utils

### Errors & Validation

- [ ] Input validated at controller boundary
- [ ] Centralized error types used (`ValidationError`, `AuthError`, etc.)
- [ ] Errors logged with context before throwing
- [ ] Error-to-HTTP mapping implemented

### Security

- [ ] Authentication middleware on protected routes
- [ ] Rate limiting enforced
- [ ] Sensitive data NOT logged (tokens, passwords, emails)
- [ ] Inputs sanitized (SQL injection, XSS prevention)

### Documentation

- [ ] `docs/reference/CODE_OVERVIEW.md` updated if new controllers/services
- [ ] `docs/reference/DATABASE.md` updated if schema changed
- [ ] Comments explain "why", not "what"

---

## Questions?

1. Check [/AGENTS.md](../AGENTS.md) for project-wide principles
2. Review existing controllers/services for patterns
3. Ask before violating size limits or layering rules

**Remember**: Routes wire, controllers translate, services orchestrate, repositories persist, providers integrate. Keep prompts out of controllers. Test every layer independently.
