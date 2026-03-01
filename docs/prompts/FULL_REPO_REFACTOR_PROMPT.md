# Full Repository Refactor Prompt for Codex

> **Purpose**: Industry-grade refactor to achieve bulletproof code quality with guardrails against code drift.
> **Created**: 2026-02-05 | **Updated**: 2026-02-06
> **Scope**: Entire Lock-in repository

---

## Context for AI Agent

You are refactoring the **Lock-in** Chrome extension monorepo - an AI-powered study assistant for Monash University students. The codebase has existing guardrails but needs hardening to achieve **paranoid-level, bulletproof quality**.

### Existing Infrastructure (DO NOT REMOVE)

- **Dependency Cruiser**: `.dependency-cruiser.cjs` enforces architectural boundaries
- **ESLint**: `eslint.config.js` with max-lines (500), complexity (20), architectural rules
- **Coverage**: `vitest.config.ts` with coverage thresholds (currently 35% baseline)
- **CI/CD**: `.github/workflows/quality-gate.yml` with `npm run validate`
- **Docs**: `AGENTS.md` files define layer rules; `docs/tracking/REFACTOR_PLAN.md` tracks progress
- **Zod**: Already installed and used in `/backend/validators`
- **TypeScript**: `strict: true` already enabled in `tsconfig.json`

### Current Gaps (from STATUS.md)

- Phase 4: Retry/timeout policy inconsistent across extension/backend
- Phase 6: Large modules need cohesion-driven splits
- Lint warnings remain (non-blocking but noisy)
- Runtime validation incomplete at API boundaries
- No contract tests between layers
- Hidden shared state in some modules
- Observability gaps (no request tracing)

---

## Refactor Objectives

Transform this codebase into **industry-grade, bulletproof quality** by implementing:

---

## PILLAR 1: Architecture Enforcement (Not Just Documentation)

### 1.1 Module Boundaries in Lint Rules

The architecture MUST be enforceable via tooling, not just documented.

**ESLint Boundary Rules** (add to `eslint.config.js`):

```javascript
// STRICT: Prevent ALL cross-layer violations
{
  files: ['core/**/*.{ts,tsx,js}'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['**/extension/**', '**/backend/**', '**/ui/**', 'express', 'react*'],
          message: 'Core must be platform-agnostic. No extension/backend/UI imports.' },
        { group: ['chrome', 'window', 'document'],
          message: 'Core cannot use browser globals.' }
      ]
    }]
  }
},
{
  files: ['backend/services/**/*.js'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['**/controllers/**', '**/routes/**', '**/middleware/**'],
          message: 'Services cannot import controllers/routes/middleware (layer violation).' },
        { group: ['express'],
          message: 'Services must not depend on Express (HTTP concern).' }
      ]
    }]
  }
},
{
  files: ['backend/controllers/**/*.js'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['**/repositories/**', '**/providers/**', '**/db/**'],
          message: 'Controllers must call services only (no direct repo/provider/db access).' }
      ]
    }]
  }
}
```

### 1.2 Stricter Circular Dependency Rules

Update `.dependency-cruiser.cjs`:

```javascript
{
  name: 'no-circular-dependencies',
  severity: 'error',  // BLOCK on any cycle
  from: {},
  to: { circular: true }
},
{
  name: 'no-orphan-modules',
  severity: 'warn',
  from: { orphan: true, pathNot: '(test|spec|__tests__|fixtures|mocks)' },
  to: {}
},
{
  name: 'no-deprecated-core-imports',
  severity: 'error',
  from: {},
  to: { path: 'core/deprecated/' }
}
```

### 1.3 Layer Dependency Matrix (Enforce in CI)

```
FROM → TO        | core | api | backend | extension | ui | integrations
-----------------|------|-----|---------|-----------|----|--------------
core             |  ✓   |  ✗  |    ✗    |     ✗     | ✗  |      ✗
api              |  ✓   |  ✓  |    ✗    |     ✗     | ✗  |      ✗
backend          |  ✓   |  ✗  |    ✓    |     ✗     | ✗  |      ✗
extension        |  ✓   |  ✓  |    ✗    |     ✓     | ✓  |      ✓
ui               |  ✓   |  ✓  |    ✗    |     ✗     | ✓  |      ✗
integrations     |  ✓   |  ✗  |    ✗    |     ✗     | ✗  |      ✓
```

---

## PILLAR 2: TypeScript/JS Tooling at "Paranoid" Level

### 2.1 TypeScript Compiler Strictness

Update `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    // EXISTING (keep these)
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    // ADD THESE (paranoid mode)
    "noImplicitReturns": true,
    "noUncheckedIndexedAccess": true, // Arrays/objects may be undefined
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitOverride": true,
    "useUnknownInCatchVariables": true, // catch(e) is unknown, not any
  },
}
```

### 2.2 ESLint Rules for Correctness

```javascript
// Add to eslint.config.js TypeScript section
{
  files: ['**/*.{ts,tsx}'],
  rules: {
    // Eliminate any
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',

    // Promise safety
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/promise-function-async': 'error',
    '@typescript-eslint/await-thenable': 'error',

    // Type safety
    '@typescript-eslint/explicit-function-return-type': ['error', {
      allowExpressions: true,
      allowTypedFunctionExpressions: true
    }],
    '@typescript-eslint/strict-boolean-expressions': ['error', {
      allowString: false,
      allowNumber: false,
      allowNullableObject: false
    }],
    '@typescript-eslint/switch-exhaustiveness-check': 'error',

    // Consistency
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/consistent-type-exports': 'error',
    '@typescript-eslint/naming-convention': ['error',
      { selector: 'interface', format: ['PascalCase'], prefix: ['I'] },
      { selector: 'typeAlias', format: ['PascalCase'] },
      { selector: 'enum', format: ['PascalCase'] },
      { selector: 'enumMember', format: ['UPPER_CASE'] }
    ]
  }
}
```

### 2.3 Complexity & Size Guards (Stricter)

```javascript
// Global rules in eslint.config.js
{
  files: ['**/*.{js,ts,tsx}'],
  rules: {
    'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
    'complexity': ['error', 12],          // Reduced from 20
    'max-depth': ['error', 4],
    'max-nested-callbacks': ['error', 3],
    'max-params': ['error', 4],
    'max-statements': ['error', 20],

    // Code quality
    'no-magic-numbers': ['warn', {
      ignore: [0, 1, -1, 2, 100, 1000],
      ignoreArrayIndexes: true,
      enforceConst: true
    }],
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'no-else-return': 'error',
    'no-lonely-if': 'error',
    'no-unneeded-ternary': 'error',

    // Safety
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-proto': 'error',
    'no-extend-native': 'error'
  }
}
```

---

## PILLAR 3: Runtime Validation & Domain Invariants

### 3.1 Boundary Schemas (Zod Everywhere)

**RULE**: Every data boundary MUST have Zod validation.

**Boundaries requiring validation**:

1. HTTP request bodies (controllers)
2. HTTP response bodies (API client)
3. Chrome message payloads (background ↔ content)
4. External API responses (OpenAI, Supabase)
5. Storage reads (chrome.storage, localStorage)
6. Database query results (optional but recommended)

**Pattern - API Client Response Validation**:

```typescript
// api/validation.ts
import { z } from 'zod';

export const NoteSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().max(500).nullable(),
  content: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Note = z.infer<typeof NoteSchema>;

// api/resources/notesClient.ts
export async function getNote(id: string): Promise<Note> {
  const response = await fetcher.get(`/notes/${id}`);
  return NoteSchema.parse(response.data); // Runtime validation!
}
```

**Pattern - Chrome Message Validation**:

```typescript
// extension/background/messageSchemas.ts
import { z } from 'zod';

export const GetTranscriptMessage = z.object({
  type: z.literal('GET_TRANSCRIPT'),
  payload: z.object({
    videoId: z.string().min(1),
    provider: z.enum(['panopto', 'echo360', 'youtube', 'html5']),
  }),
});

// In message handler
const parsed = GetTranscriptMessage.safeParse(message);
if (!parsed.success) {
  return { error: 'Invalid message format', details: parsed.error.flatten() };
}
```

### 3.2 Domain Invariants in Core

**RULE**: Domain objects MUST enforce their own invariants.

```typescript
// core/domain/Note.ts
import { z } from 'zod';

const NoteInvariantsSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    content: z.string().min(1, 'Note content cannot be empty'),
    title: z.string().max(500).nullable(),
  })
  .refine((note) => note.content.length <= 100_000, {
    message: 'Note content exceeds maximum length',
  });

export class Note {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly content: string,
    public readonly title: string | null,
  ) {}

  static create(data: unknown): Note {
    const validated = NoteInvariantsSchema.parse(data);
    return new Note(validated.id, validated.userId, validated.content, validated.title);
  }

  // Domain methods that maintain invariants
  updateContent(newContent: string): Note {
    return Note.create({ ...this, content: newContent });
  }
}
```

### 3.3 Error Taxonomy Enforcement

**RULE**: Only errors from `/core/errors` may be thrown.

```typescript
// core/errors/index.ts
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
  abstract readonly retryable: boolean;

  getUserMessage(): string {
    return 'An unexpected error occurred. Please try again.';
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly httpStatus = 400;
  readonly retryable = false;

  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
  }
}

export class NetworkError extends AppError {
  readonly code = 'NETWORK_ERROR';
  readonly httpStatus = 503;
  readonly retryable = true;
}

export class TimeoutError extends AppError {
  readonly code = 'TIMEOUT_ERROR';
  readonly httpStatus = 504;
  readonly retryable = true;

  constructor(
    public readonly operationName: string,
    public readonly timeoutMs: number,
  ) {
    super(`Operation '${operationName}' timed out after ${timeoutMs}ms`);
  }
}

// ESLint rule to enforce (custom plugin or manual review)
// 'no-throw-literal': 'error'
// 'no-restricted-syntax': ['error', { selector: 'ThrowStatement > :not(NewExpression)', message: 'Must throw AppError subclass' }]
```

---

## PILLAR 4: Testing Strategy as Safety Net

### 4.1 Coverage Gates Per Layer

Update `vitest.config.ts`:

```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'html', 'json-summary', 'lcov'],
  thresholds: {
    // Global minimum
    global: {
      statements: 60,
      branches: 50,
      functions: 60,
      lines: 60
    }
  },
  // Per-folder thresholds (stricter for critical paths)
  perFile: false,
  watermarks: {
    statements: [60, 80],
    branches: [50, 70],
    functions: [60, 80],
    lines: [60, 80]
  }
}
```

**Target Coverage by Layer**:
| Layer | Min Coverage | Target |
|-------|-------------|--------|
| core/domain | 90% | 95% |
| core/services | 85% | 90% |
| backend/services | 80% | 90% |
| backend/controllers | 70% | 80% |
| api/ | 80% | 90% |
| ui/hooks | 70% | 80% |

### 4.2 Contract Tests for Critical Seams

**What are contract tests?** Tests that verify two systems agree on the shape/behavior of their interface.

**Required Contract Tests**:

1. **API Client ↔ Backend Controllers**

```typescript
// api/__tests__/contracts/notesContract.test.ts
import { NoteSchema, CreateNoteRequestSchema } from '@api/validation';

describe('Notes API Contract', () => {
  test('GET /notes/:id response matches NoteSchema', async () => {
    const response = await testClient.get('/notes/test-id');
    expect(() => NoteSchema.parse(response.data)).not.toThrow();
  });

  test('POST /notes request matches CreateNoteRequestSchema', () => {
    const validRequest = { content: 'Test', title: 'Title' };
    expect(() => CreateNoteRequestSchema.parse(validRequest)).not.toThrow();
  });
});
```

2. **Chrome Messages (Extension ↔ Background)**

```typescript
// extension/__tests__/contracts/messageContract.test.ts
describe('Message Contract', () => {
  test('GET_TRANSCRIPT message format', () => {
    const message = { type: 'GET_TRANSCRIPT', payload: { videoId: '123', provider: 'panopto' } };
    expect(() => GetTranscriptMessage.parse(message)).not.toThrow();
  });
});
```

3. **Transcript Providers**

```typescript
// core/__tests__/contracts/transcriptProviderContract.test.ts
import { ALL_PROVIDERS } from '@core/transcripts/providers';

describe.each(ALL_PROVIDERS)('Provider %s contract', (provider) => {
  test('implements required interface', () => {
    expect(provider.canHandle).toBeInstanceOf(Function);
    expect(provider.extract).toBeInstanceOf(Function);
    expect(provider.providerId).toBeDefined();
  });

  test('canHandle returns boolean', () => {
    const result = provider.canHandle({ url: 'https://example.com' });
    expect(typeof result).toBe('boolean');
  });
});
```

### 4.3 Regression Tests for Bugs

**RULE**: Every bug fix MUST include a regression test.

**Pattern**:

```typescript
// In PR description
// Fixes: #123 - Note editor loses content on rapid saves

// __tests__/regressions/noteEditor.regression.test.ts
describe('Regression: #123 - Note editor rapid save', () => {
  test('does not lose content when saves overlap', async () => {
    // Reproduce the exact bug scenario
    const editor = renderNoteEditor({ initialContent: 'Original' });

    // Rapid saves
    await editor.type('A');
    editor.save(); // Don't await
    await editor.type('B');
    editor.save(); // Don't await
    await editor.type('C');
    await editor.save();

    // Verify content preserved
    expect(editor.getContent()).toBe('OriginalABC');
  });
});
```

### 4.4 Mutation Testing (Hardcore)

Add mutation testing for critical paths:

```bash
npm install --save-dev @stryker-mutator/core @stryker-mutator/vitest-runner
```

```javascript
// stryker.config.js
module.exports = {
  mutate: [
    'core/domain/**/*.ts',
    'core/services/**/*.ts',
    'backend/services/**/*.js',
    '!**/*.test.*',
  ],
  testRunner: 'vitest',
  reporters: ['html', 'clear-text', 'progress'],
  thresholds: { high: 80, low: 60, break: 50 },
};
```

Add npm script:

```json
"test:mutation": "stryker run"
```

---

## PILLAR 5: Reliability & Scalability Patterns

### 5.1 Time-Box Everything That Can Hang

**RULE**: Every async operation MUST have a timeout.

```typescript
// core/utils/timeout.ts
export class TimeoutError extends Error {
  constructor(
    public readonly operation: string,
    public readonly timeoutMs: number,
  ) {
    super(`${operation} timed out after ${timeoutMs}ms`);
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new TimeoutError(operationName, timeoutMs)), timeoutMs),
    ),
  ]);
}

// Usage
const result = await withTimeout(fetchTranscript(videoId), 30_000, 'fetchTranscript');
```

**Default Timeouts**:
| Operation | Timeout |
|-----------|---------|
| API calls | 30s |
| LLM calls | 60s |
| Transcription | 5min |
| File upload | 2min |
| Database query | 10s |

### 5.2 Idempotency & Deduping

**RULE**: All mutating operations MUST support idempotency.

```typescript
// backend/middleware/idempotency.js
const idempotencyStore = require('../utils/idempotencyStore');

module.exports = function idempotent(options = {}) {
  return async (req, res, next) => {
    const key = req.headers['idempotency-key'];
    if (!key) return next();

    const cached = await idempotencyStore.get(key);
    if (cached) {
      return res.status(cached.status).json(cached.body);
    }

    // Capture response
    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      await idempotencyStore.set(key, { status: res.statusCode, body }, options.ttl || 86400);
      return originalJson(body);
    };

    next();
  };
};

// Usage in routes
router.post('/notes', idempotent(), validate(schema), createNote);
```

### 5.3 No Hidden Shared State

**RULE**: Modules MUST NOT have mutable module-level state.

**BAD**:

```javascript
// ❌ Hidden shared state
let cachedConfig = null;
export function getConfig() {
  if (!cachedConfig) cachedConfig = loadConfig();
  return cachedConfig;
}
```

**GOOD**:

```javascript
// ✅ Explicit dependency injection
export function createConfigLoader(dependencies) {
  let cached = null;
  return {
    getConfig() {
      if (!cached) cached = dependencies.loadConfig();
      return cached;
    },
    clearCache() {
      cached = null;
    },
  };
}
```

**ESLint Rule** (add custom):

```javascript
// Detect module-level let/var
'no-restricted-syntax': ['error',
  { selector: 'Program > VariableDeclaration[kind="let"]', message: 'No module-level mutable state' },
  { selector: 'Program > VariableDeclaration[kind="var"]', message: 'No module-level mutable state' }
]
```

### 5.4 Observability Built-In

**Request Tracing**:

```javascript
// backend/middleware/tracing.js
const { randomUUID } = require('crypto');

module.exports = function tracing() {
  return (req, res, next) => {
    req.requestId = req.headers['x-request-id'] || randomUUID();
    res.setHeader('x-request-id', req.requestId);

    // Attach to logger context
    req.log = logger.child({ requestId: req.requestId, path: req.path });

    const start = Date.now();
    res.on('finish', () => {
      req.log.info('Request completed', {
        status: res.statusCode,
        durationMs: Date.now() - start,
      });
    });

    next();
  };
};
```

**Structured Logging Pattern**:

```typescript
// ALL logs must include context
logger.info('Operation completed', {
  requestId: req.requestId,
  userId: req.user?.id,
  operation: 'createNote',
  durationMs: elapsed,
  noteId: result.id,
});
```

---

## PILLAR 6: Preventing Code Drift Over Time

### 6.1 Pre-Commit Hooks (Strict)

Update `.husky/pre-commit`:

```bash
#!/bin/sh
set -e

echo "🔍 Running pre-commit checks..."

# Format check (fast)
npm run format:check || { echo "❌ Format check failed. Run 'npm run format'"; exit 1; }

# Type check (fast)
npm run type-check || { echo "❌ Type check failed"; exit 1; }

# Lint (medium)
npm run lint:all || { echo "❌ Lint failed"; exit 1; }

# Architecture check (fast)
npm run lint:deps || { echo "❌ Architecture violation detected"; exit 1; }

# Tests for changed files only (fast)
npm run test -- --changed --passWithNoTests || { echo "❌ Tests failed"; exit 1; }

echo "✅ Pre-commit checks passed"
```

### 6.2 PR Quality Bot (CI Workflow)

Create `.github/workflows/pr-quality-check.yml`:

```yaml
name: PR Quality Check

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Type Check
        run: npm run type-check

      - name: Lint
        run: npm run lint:all

      - name: Architecture Boundaries
        run: npm run lint:deps

      - name: Tests with Coverage
        run: npm run test:coverage

      - name: Check Coverage Regression
        run: |
          # Compare coverage to main branch
          CURRENT=$(jq '.total.lines.pct' coverage/coverage-summary.json)
          echo "Current coverage: $CURRENT%"
          # Fail if coverage dropped significantly

      - name: File Size Check
        run: |
          # Warn if adding >100 lines to files already >200 lines
          git diff --stat origin/main... | while read line; do
            # Parse and check file sizes
            echo "$line"
          done

      - name: Complexity Check
        run: npm run lint -- --format json | node scripts/ci/check-complexity-delta.js
```

### 6.3 Architecture Decision Records (ADRs)

Create `docs/architecture/decisions/` with template:

```markdown
# ADR-NNN: [Title]

**Status**: [Proposed | Accepted | Deprecated | Superseded by ADR-XXX]
**Date**: YYYY-MM-DD
**Authors**: [Names]

## Context

What is the issue that we're seeing that is motivating this decision?

## Decision

What is the change that we're proposing/doing?

## Consequences

What becomes easier or harder as a result of this change?

### Positive

- ...

### Negative

- ...

### Risks

- ...
```

### 6.4 Automated Codebase Health Metrics

Add `scripts/ci/codebase-health.js`:

```javascript
// Tracks metrics over time
const metrics = {
  totalFiles: countFiles(),
  avgFileSize: calculateAvgFileSize(),
  maxComplexity: findMaxComplexity(),
  circularDeps: countCircularDeps(),
  anyTypes: countAnyTypes(),
  testCoverage: getCoverage(),
  outdatedDeps: countOutdatedDeps(),
};

// Output to JSON for tracking
console.log(JSON.stringify(metrics, null, 2));

// Fail if thresholds exceeded
if (metrics.maxComplexity > 15) process.exit(1);
if (metrics.circularDeps > 0) process.exit(1);
```

---

## PILLAR 7: SOLID Principles Enforcement (Detailed)

### 7.1 Single Responsibility (SRP)

- Split any file >300 lines into focused modules
- Controllers: HTTP only (parse req, call service, send res) - MAX 50 lines/function
- Services: Business logic only - MAX 150 lines/function
- Repositories: Data access only
- Providers: External API wrappers only

### 7.2 Open/Closed (OCP)

- Replace `if (type === 'x')` chains with polymorphic patterns (strategy/factory)
- Ensure new features extend abstractions, not modify core

### 7.3 Liskov Substitution (LSP)

- Audit all `BaseAdapter` implementations for contract compliance
- Add interface tests that run against all implementations

### 7.4 Interface Segregation (ISP)

- Split fat interfaces (e.g., transcript providers with optional capabilities)
- Use capability detection patterns for optional features

### 7.5 Dependency Inversion (DIP)

- All external dependencies (fetch, storage, chrome, DB) must be injectable
- No `require`/`import` of concrete implementations in business logic

---

## PILLAR 8: Module Split Plan (Cohesion-Driven)

**Priority Splits**:

| File                                             | Lines | Split Into                                                                                       |
| ------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------ |
| `extension/background.js`                        | >500  | `background/router.js`, `background/handlers/*.js`, `background/lifecycle.js`                    |
| `backend/controllers/assistant/ai.js`            | >200  | `controllers/assistant/chat.js`, `controllers/assistant/explain.js`, `services/promptBuilder.js` |
| `backend/services/llmClient.js`                  | >300  | `providers/llm/openai.js`, `providers/llm/rateLimiter.js`, `providers/llm/index.js`              |
| `extension/src/transcripts/transcriptHandler.ts` | >400  | `transcripts/extraction.ts`, `transcripts/caching.ts`, `transcripts/coordinator.ts`              |

---

## Execution Instructions

### Phase 1: Guardrail Hardening (No functional changes)

1. Update `tsconfig.json` with paranoid compiler options
2. Update `eslint.config.js` with stricter rules (start with WARN, upgrade to ERROR)
3. Update `.dependency-cruiser.cjs` with new boundary rules
4. Update `.husky/pre-commit` with strict checks
5. Add PR quality workflow `.github/workflows/pr-quality-check.yml`
6. Create `docs/architecture/decisions/` folder with ADR template
7. Run `npm run validate` - fix ERRORS only, document warnings
8. Commit: "chore: harden code quality guardrails"

### Phase 2: Runtime Validation

1. Add Zod schemas for ALL API boundaries (`api/validation.ts`)
2. Add Chrome message schemas (`extension/background/messageSchemas.ts`)
3. Update API client to validate responses with schemas
4. Add domain invariant classes in `core/domain/`
5. Standardize error taxonomy in `core/errors/`
6. Commit: "feat: add runtime validation at all boundaries"

### Phase 3: Lint Warning Resolution

1. Fix all ESLint warnings systematically by folder
2. Order: `core/` → `api/` → `backend/` → `extension/` → `ui/`
3. Upgrade warning rules to error after folder is clean
4. Commit per folder: "fix(folder): resolve lint warnings"

### Phase 4: Module Splits

1. Split files per the table above
2. Maintain 100% behavior parity (no functional changes)
3. Add/update tests for split modules
4. Commit per split: "refactor(module): split X into focused submodules"

### Phase 5: Reliability Patterns

1. Implement `core/utils/timeout.ts` with `withTimeout()` helper
2. Create unified retry wrapper `core/network/retry.ts`
3. Add circuit breaker for external APIs
4. Implement request tracing middleware
5. Audit and remove hidden shared state
6. Verify all mutable state is injectable/resettable
7. Commit: "refactor(reliability): add timeout, retry, tracing"

### Phase 6: Test Coverage Boost

1. Add missing unit tests for services/utils
2. Add contract tests for API boundaries
3. Add regression test template and examples
4. Reach 60%+ global, 80%+ on critical paths
5. (Optional) Add mutation testing for core/domain
6. Commit: "test: boost coverage and add contract tests"

### Phase 7: Type Safety Hardening

1. Eliminate all `any` types
2. Add `noUncheckedIndexedAccess` handling
3. Add explicit return types to all functions
4. Fix `useUnknownInCatchVariables` issues
5. Commit: "refactor(types): eliminate any, add strict typing"

---

## Validation Commands

After EVERY phase, run:

```bash
npm run validate  # MUST pass - this is the ultimate gate
npm run lint:deps # No architecture violations
npm run test:coverage # Coverage thresholds met
```

**CRITICAL**: If `npm run validate` fails, fix before proceeding.

---

## DO NOT

- Remove existing guardrails (dependency-cruiser rules, ESLint boundaries)
- Change public API contracts without updating tests
- Add new dependencies without justification in ADR
- Skip tests for refactored code
- Make functional changes during refactor commits
- Ignore the AGENTS.md files - they define architectural rules
- Introduce module-level mutable state
- Swallow errors silently
- Use `any` type (use `unknown` and narrow)
- Make network calls without timeout
- Store cross-request state in memory

## DO

- Preserve all existing tests
- Update `docs/tracking/REFACTOR_PLAN.md` as phases complete
- Update `docs/tracking/STATUS.md` with progress
- Add ADRs for significant architectural decisions
- Keep `npm run validate` green after each commit
- Add regression tests for every bug fix
- Use Zod for all boundary validation
- Add request IDs to all logs
- Time-box all async operations
- Use dependency injection for external dependencies

---

## Success Criteria

### Tooling Gates (Automated)

- [ ] Zero ESLint errors
- [ ] Zero dependency-cruiser violations
- [ ] `npm run validate` passes
- [ ] TypeScript compiles with paranoid options
- [ ] Pre-commit hooks block bad commits

### Quality Metrics

- [ ] All files <300 lines (except justified exceptions documented in ADR)
- [ ] All functions <50 lines
- [ ] Cyclomatic complexity <12 for all functions
- [ ] Max 4 levels of nesting
- [ ] Max 3 nested callbacks

### Type Safety

- [ ] No `any` types in TypeScript
- [ ] All functions have explicit return types
- [ ] `noUncheckedIndexedAccess` enabled and handled

### Runtime Safety

- [ ] All API boundaries have Zod validation
- [ ] All Chrome messages have schema validation
- [ ] All async operations have timeouts
- [ ] Error taxonomy enforced (only AppError subclasses thrown)

### Testing

- [ ] 60%+ global coverage
- [ ] 80%+ coverage on core/services, backend/services
- [ ] Contract tests for all critical seams
- [ ] Regression tests for all bug fixes

### Reliability

- [ ] Unified retry/timeout across codebase
- [ ] No hidden shared state (all state injectable)
- [ ] Request tracing in backend
- [ ] Circuit breakers for external APIs

### Process

- [ ] Pre-commit hooks enforce all gates
- [ ] PR workflow blocks on quality regression
- [ ] ADR folder exists with template
- [ ] Documentation up to date

---

## Reference Files

**Architecture Rules** (READ FIRST):

- `/AGENTS.md` - Project-wide principles
- `/backend/AGENTS.md` - Backend layering rules
- `/core/AGENTS.md` - Domain logic patterns
- `/extension/AGENTS.md` - Chrome extension patterns
- `/integrations/AGENTS.md` - Site adapter patterns

**Current State**:

- `/docs/tracking/REFACTOR_PLAN.md` - Refactor progress
- `/docs/tracking/STATUS.md` - Outstanding issues
- `/docs/reference/CODE_OVERVIEW.md` - Implementation details
- `/docs/reference/DATABASE.md` - Database schema

**Tooling Config**:

- `tsconfig.json` - TypeScript compiler
- `eslint.config.js` - Linting rules
- `.dependency-cruiser.cjs` - Architecture boundaries
- `vitest.config.ts` - Test configuration
- `.husky/pre-commit` - Pre-commit hooks
