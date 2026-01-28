# Core AGENTS.md

> **Inherits from**: [/AGENTS.md](../AGENTS.md)  
> **Last Updated**: 2026-01-28  
> **Purpose**: Platform-agnostic domain logic, pure functions, DI patterns

## Table of Contents

- [Purpose](#purpose)
- [Non-Goals](#non-goals)
- [Architectural Boundaries](#architectural-boundaries)
- [Allowed & Forbidden Imports](#allowed--forbidden-imports)
- [Required Patterns](#required-patterns)
- [Testing Rules](#testing-rules)
- [Error Handling Rules](#error-handling-rules)
- [Logging](#logging)
- [Golden Path Workflows](#golden-path-workflows)
- [Common Failure Modes](#common-failure-modes)
- [PR Checklist](#pr-checklist)

---

## Purpose

The `/core` directory contains **platform-agnostic domain logic** that works in:

- Node.js (backend)
- Browser (extension)
- React Native (future mobile app)
- Next.js SSR (future web app)

**This directory SHOULD contain**:

- Domain models and types (`/core/domain`)
- Business logic services (`/core/services`)
- Transcript extraction providers (`/core/transcripts/providers`)
- Utility functions (`/core/utils`)
- Error types (`/core/errors`)
- Storage interfaces (`/core/storage`)

**This directory MUST contain ONLY**:

- Pure functions (deterministic input → output)
- Functions with injected dependencies (DI pattern)
- Platform-agnostic code (no `window`, `document`, `chrome`, `Express`)

---

## Non-Goals

**What this layer is NOT**:

- NOT Chrome extension code (use `/extension`)
- NOT backend API code (use `/backend`)
- NOT UI rendering code (use `/ui`)
- NOT site adapters (use `/integrations`)
- NOT allowed to use browser or Node globals directly

---

## Architectural Boundaries

### Platform-Agnostic Design

```
┌────────────────────────────────────────────────┐
│  PLATFORMS (Inject Dependencies)               │
│  - Extension: chrome.storage → StorageAdapter  │
│  - Backend: Supabase → DatabaseAdapter         │
│  - Web App: localStorage → StorageAdapter      │
└────────────────┬───────────────────────────────┘
                 ↓ (Dependency Injection)
┌────────────────────────────────────────────────┐
│  /core (Platform-Agnostic)                     │
│  ┌──────────────────────────────────────────┐ │
│  │ /domain - Types, models, interfaces      │ │
│  │ - Note.ts, types.ts, apiTypes.ts         │ │
│  └──────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────┐ │
│  │ /services - Business logic               │ │
│  │ - notesService.ts (content migration)    │ │
│  │ - Pure orchestration, NO side effects    │ │
│  └──────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────┐ │
│  │ /transcripts - Transcript providers      │ │
│  │ - providers/ (Panopto, Echo360, HTML5)   │ │
│  │ - Depends on fetcher interface (DI)     │ │
│  └──────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────┐ │
│  │ /utils - Pure helper functions           │ │
│  │ - logger.ts, validators                  │ │
│  └──────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────┐ │
│  │ /errors - Centralized error types        │ │
│  │ - AppError, ValidationError, etc.        │ │
│  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

### Module Organization

| Subdirectory   | Purpose                       | Platform-Specific Code? |
| -------------- | ----------------------------- | ----------------------- |
| `/domain`      | Type definitions, interfaces  | ❌ NO                   |
| `/services`    | Business logic orchestration  | ❌ NO                   |
| `/transcripts` | Transcript extraction logic   | ❌ NO (uses DI)         |
| `/utils`       | Pure helper functions         | ❌ NO                   |
| `/errors`      | Error type definitions        | ❌ NO                   |
| `/storage`     | Storage interface definitions | ❌ NO (interfaces only) |
| `/config`      | Configuration schemas         | ❌ NO                   |

---

## Allowed & Forbidden Imports

### Allowed Imports

**MUST use only**:

- Node.js built-ins: `path`, `util`, `crypto` (CommonJS, NOT platform-specific)
- Other `/core` modules
- TypeScript types

**MAY use with constraints**:

- `fetch` - ONLY if injected via DI (not global `fetch`)
- JSON serialization (platform-agnostic)

### Forbidden Imports

**MUST NOT import**:

- ❌ `window`, `document`, `navigator`, `localStorage`, `sessionStorage`
- ❌ `chrome` or any Chrome extension APIs
- ❌ `express`, `req`, `res`, or any Express types
- ❌ `react`, `react-dom` (UI code belongs in `/ui`)
- ❌ `next`, Next.js-specific APIs
- ❌ Browser-specific globals (`XMLHttpRequest`, `Blob` without polyfill)
- ❌ Node.js-specific globals (`process.env` directly - use config injection)
- ❌ Direct HTTP libraries (`axios`, `node-fetch` - use injected fetcher)

### Examples

```typescript
// ✅ GOOD - Platform-agnostic
export function calculateNoteHash(content: string): string {
  // Pure function, works everywhere
  return crypto.createHash('sha256').update(content).digest('hex');
}

// ✅ GOOD - Dependency injection
export async function fetchTranscript(url: string, fetcher: AsyncFetcher): Promise<string> {
  const response = await fetcher.fetch(url); // Injected fetcher
  return response.text();
}

// ❌ BAD - Browser global
export function saveToStorage(key: string, value: string) {
  localStorage.setItem(key, value); // NO! Browser-specific
}

// ❌ BAD - Chrome API
export function getChromeStorage(key: string) {
  return chrome.storage.local.get(key); // NO! Extension-specific
}

// ❌ BAD - Express
export function processRequest(req: Request, res: Response) {
  // NO! Backend-specific
}
```

---

## Required Patterns

### 1. Pure Functions Preferred

**MUST prefer pure functions** (deterministic, no side effects):

```typescript
// ✅ GOOD - Pure function
export function sanitizeNoteTitle(title: string, maxLength: number = 200): string {
  if (typeof title !== 'string') return '';
  return title.trim().slice(0, maxLength);
}

// ❌ BAD - Side effects (modifies external state)
let noteCount = 0;
export function createNote(title: string) {
  noteCount++; // Side effect!
  return { id: noteCount, title };
}

// ✅ GOOD - No side effects
export function createNoteData(id: number, title: string): Note {
  return { id, title, createdAt: Date.now() };
}
```

**Pure Function Rules**:

1. Same input → same output (deterministic)
2. No side effects (no mutations, no I/O, no global state changes)
3. Testable without mocks
4. Safe to call multiple times

### 2. Dependency Injection for Side Effects

**MUST inject dependencies** for platform-specific operations:

```typescript
// ✅ GOOD - Fetcher interface injection
interface AsyncFetcher {
  fetch(url: string, options?: RequestInit): Promise<Response>;
}

export class PanoptoProvider {
  async extractTranscript(
    video: DetectedVideo,
    fetcher: AsyncFetcher, // Injected dependency
  ): Promise<TranscriptResult> {
    const response = await fetcher.fetch(video.captionUrl);
    const vttText = await response.text();
    return parseWebVTT(vttText);
  }
}

// ❌ BAD - Direct global fetch
export class PanoptoProvider {
  async extractTranscript(video: DetectedVideo): Promise<TranscriptResult> {
    const response = await fetch(video.captionUrl); // NO! Platform-specific
    // ...
  }
}
```

**Dependency Injection Patterns**:

1. **Constructor injection**:

```typescript
class NoteService {
  constructor(private storage: StorageInterface) {}

  async save(note: Note) {
    await this.storage.set(`note:${note.id}`, note);
  }
}
```

2. **Parameter injection**:

```typescript
async function extractTranscript(
  video: DetectedVideo,
  fetcher: AsyncFetcher,
): Promise<TranscriptResult> {
  // Use injected fetcher
}
```

3. **Factory pattern**:

```typescript
export function createLogger(config: LoggerConfig): Logger {
  return new Logger(config.level, config.console);
}
```

### 3. No Side Effects on Import

**MUST NOT execute code on import**:

```typescript
// ❌ BAD - Side effects on import
import { logger } from './logger';
logger.info('Module loaded'); // Runs on import!

const config = fetchConfig(); // Side effect!
export { config };

// ✅ GOOD - Lazy initialization
let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (!cachedConfig) {
    cachedConfig = loadConfig(); // Lazy, on first call
  }
  return cachedConfig;
}
```

### 4. Interface-Based Design

**MUST define interfaces for external dependencies**:

```typescript
// ✅ GOOD - Interface definition
export interface StorageInterface {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

// Platform implementations (in /extension, /backend)
class ChromeStorageAdapter implements StorageInterface {
  async get<T>(key: string): Promise<T | null> {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
  }
  // ...
}

class SupabaseStorageAdapter implements StorageInterface {
  async get<T>(key: string): Promise<T | null> {
    const { data } = await this.supabase.from('storage').select('value').eq('key', key);
    return data?.[0]?.value ?? null;
  }
  // ...
}
```

---

## Testing Rules

### Unit Test Pure Functions

**MUST test pure functions with deterministic inputs**:

```typescript
// core/utils/__tests__/validators.test.ts
import { test } from 'node:test';
import { assert } from 'node:assert';
import { isValidEmail } from '../validators';

test('isValidEmail returns true for valid emails', () => {
  assert.equal(isValidEmail('user@example.com'), true);
  assert.equal(isValidEmail('test.user+tag@domain.co.uk'), true);
});

test('isValidEmail returns false for invalid emails', () => {
  assert.equal(isValidEmail('notanemail'), false);
  assert.equal(isValidEmail('@missing.com'), false);
  assert.equal(isValidEmail('missing@'), false);
});
```

### Test with Mocked Dependencies

**MUST mock injected dependencies**:

```typescript
// core/transcripts/providers/__tests__/panoptoProvider.test.ts
import { test } from 'node:test';
import { assert } from 'node:assert';
import { PanoptoProvider } from '../panoptoProvider';

test('extractTranscript parses WebVTT captions', async () => {
  // Mock fetcher
  const mockFetcher = {
    fetch: async (url: string) => ({
      ok: true,
      text: async () => `WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nHello world`,
    }),
  };

  const provider = new PanoptoProvider();
  const video = { captionUrl: 'https://panopto.example.com/captions.vtt' };

  const result = await provider.extractTranscript(video, mockFetcher);

  assert.equal(result.segments.length, 1);
  assert.equal(result.segments[0].text, 'Hello world');
});
```

### Test Node.js Compatibility

**MUST verify code runs in Node.js**:

```bash
# Run in pure Node.js environment (no browser globals)
node -e "require('./core/utils/validators.js'); console.log('✓ Node compatible')"
```

**If code throws** `ReferenceError: window is not defined` → You have platform leakage!

---

## Error Handling Rules

### 1. Use Centralized Error Types

**MUST throw typed errors from `/core/errors`**:

```typescript
import { ValidationError, NotFoundError } from '@core/errors';

export function findNoteById(notes: Note[], id: string): Note {
  const note = notes.find((n) => n.id === id);

  if (!note) {
    throw new NotFoundError(`Note ${id} not found`);
  }

  return note;
}

export function validateNoteContent(content: string): void {
  if (content.length > 50000) {
    throw new ValidationError('Note content exceeds 50,000 character limit');
  }
}
```

### 2. Propagate Errors

**MUST propagate errors with context**:

```typescript
// ✅ GOOD - Add context and re-throw
export async function extractTranscript(
  video: DetectedVideo,
  fetcher: AsyncFetcher,
): Promise<TranscriptResult> {
  try {
    const response = await fetcher.fetch(video.captionUrl);
    return parseWebVTT(await response.text());
  } catch (error) {
    throw new NetworkError(`Failed to extract transcript for video ${video.id}`, { cause: error });
  }
}
```

---

## Logging

### Use Centralized Logger

**MUST use `/core/utils/logger.ts`**:

```typescript
import { logger } from '@core/utils/logger';

export function processTranscript(video: DetectedVideo) {
  logger.debug('Processing transcript', { videoId: video.id, provider: video.provider });

  try {
    const result = extractSegments(video);
    logger.info('Transcript processed', {
      videoId: video.id,
      segmentCount: result.segments.length,
    });
    return result;
  } catch (error) {
    logger.error('Transcript processing failed', { videoId: video.id, error });
    throw error;
  }
}
```

### Domain-Specific Loggers

**MAY create domain loggers** (for filtering):

```typescript
// core/transcripts/utils/transcriptLogger.ts
import { createLogger } from '@core/utils/logger';

export const transcriptLogger = createLogger('transcripts');

// Usage
transcriptLogger.debug('Panopto caption URL detected', { url });
```

---

## Golden Path Workflows

### Adding Domain Logic

**Step-by-step**:

1. **Define types** (`/core/domain/types.ts`):

```typescript
export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  noteId: string;
  createdAt: number;
}
```

2. **Create service** (`/core/services/flashcardService.ts`):

```typescript
import { Flashcard } from '@core/domain/types';
import { ValidationError } from '@core/errors';

export function createFlashcard(question: string, answer: string, noteId: string): Flashcard {
  if (!question || !answer) {
    throw new ValidationError('Question and answer are required');
  }

  return {
    id: crypto.randomUUID(),
    question: question.trim(),
    answer: answer.trim(),
    noteId,
    createdAt: Date.now(),
  };
}
```

3. **Write tests** (`/core/services/__tests__/flashcardService.test.ts`):

```typescript
test('createFlashcard generates valid flashcard', () => {
  const flashcard = createFlashcard('What is React?', 'A UI library', 'note-1');

  assert.ok(flashcard.id);
  assert.equal(flashcard.question, 'What is React?');
  assert.equal(flashcard.noteId, 'note-1');
});
```

4. **Update types export** (`/core/domain/types.ts`):

```typescript
export type { Flashcard };
```

### Adding a Transcript Provider

**Step-by-step**:

1. **Implement provider interface** (`/core/transcripts/providers/youTubeProvider.ts`):

```typescript
import { TranscriptProviderV2, DetectedVideo, AsyncFetcher } from '../types';

export class YouTubeProvider implements TranscriptProviderV2 {
  canHandle(url: string): boolean {
    return url.includes('youtube.com') || url.includes('youtu.be');
  }

  async extractTranscript(video: DetectedVideo, fetcher: AsyncFetcher): Promise<TranscriptResult> {
    // Implementation with injected fetcher
    const captionData = await fetcher.fetch(video.captionUrl);
    return parseYouTubeCaptions(await captionData.json());
  }
}
```

2. **Register provider** (`/core/transcripts/providerRegistry.ts`):

```typescript
import { YouTubeProvider } from './providers/youTubeProvider';

export const providers = [
  new PanoptoProvider(),
  new Echo360Provider(),
  new HTML5Provider(),
  new YouTubeProvider(), // Add here
];
```

3. **Write tests** (`/core/transcripts/providers/__tests__/youTubeProvider.test.ts`):

```typescript
test('YouTubeProvider extracts captions', async () => {
  const mockFetcher = {
    fetch: async () => ({
      /* mock response */
    }),
  };
  const provider = new YouTubeProvider();

  const result = await provider.extractTranscript(mockVideo, mockFetcher);
  assert.ok(result.segments.length > 0);
});
```

---

## Common Failure Modes

### 1. Using Browser Globals

**Symptom**: `ReferenceError: window is not defined` in Node.js

```typescript
// ❌ BAD
export function saveNote(note: Note) {
  localStorage.setItem(`note:${note.id}`, JSON.stringify(note)); // Browser-only!
}

// ✅ GOOD - Inject storage
export function saveNote(note: Note, storage: StorageInterface) {
  return storage.set(`note:${note.id}`, note); // Platform-agnostic
}
```

**Fix**: Inject storage via DI pattern

### 2. Using Chrome APIs Directly

**Symptom**: `ReferenceError: chrome is not defined`

```typescript
// ❌ BAD
export async function getSettings() {
  return chrome.storage.sync.get('settings'); // Chrome-specific!
}

// ✅ GOOD - Move to /extension or use DI
// In /extension:
export async function getSettings() {
  return chrome.storage.sync.get('settings');
}

// In /core (if needed):
export async function getSettings(storage: StorageInterface) {
  return storage.get('settings');
}
```

**Fix**: Move Chrome code to `/extension`, use DI in `/core`

### 3. Side Effects on Import

**Symptom**: Tests fail with "unexpected side effect" or initialization errors

```typescript
// ❌ BAD - Executes on import
import { config } from './config';
const db = connectDatabase(config); // Side effect!
export { db };

// ✅ GOOD - Lazy initialization
let dbInstance: Database | null = null;

export function getDatabase(config: Config): Database {
  if (!dbInstance) {
    dbInstance = connectDatabase(config);
  }
  return dbInstance;
}
```

**Fix**: Use lazy initialization or factory pattern

### 4. Non-Pure Functions

**Symptom**: Functions with inconsistent outputs or side effects

```typescript
// ❌ BAD - Non-deterministic
export function generateNoteId() {
  return Math.random().toString(36); // Different every call
}

// ✅ GOOD - Deterministic with injected randomness
export function generateNoteId(randomFn: () => number = Math.random): string {
  return randomFn().toString(36);
}

// Or even better - pure factory
export function createNoteId(seed: string): string {
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 16);
}
```

**Fix**: Make functions pure or inject dependencies

### 5. Missing Fetcher Injection

**Symptom**: Transcript providers fail in different environments

```typescript
// ❌ BAD - Direct fetch
export async function fetchCaption(url: string) {
  const response = await fetch(url); // Global fetch not available everywhere
  return response.text();
}

// ✅ GOOD - Injected fetcher
export async function fetchCaption(url: string, fetcher: AsyncFetcher) {
  const response = await fetcher.fetch(url); // Platform provides fetcher
  return response.text();
}
```

**Fix**: Use fetcher interface pattern (see transcript providers)

---

## PR Checklist

Before merging `/core` changes, verify:

### Platform Purity

- [ ] No browser globals (`window`, `document`, `navigator`, `localStorage`)
- [ ] No Chrome APIs (`chrome.*`)
- [ ] No Express types (`req`, `res`, `Request`, `Response`)
- [ ] No direct `fetch` (must be injected via DI)
- [ ] Code runs in Node.js without errors

### Pure Functions

- [ ] Functions are deterministic (same input → same output)
- [ ] No side effects (mutations, I/O, global state)
- [ ] No side effects on module import

### Dependency Injection

- [ ] Platform-specific operations use injected dependencies
- [ ] Interfaces defined for external dependencies (fetcher, storage)
- [ ] No hardcoded platform assumptions

### Testing

- [ ] Pure functions tested with deterministic inputs
- [ ] Dependencies mocked in tests
- [ ] Test coverage >90% for utils/services
- [ ] Tests run in pure Node.js environment

### Error Handling

- [ ] Uses centralized error types (`/core/errors`)
- [ ] Errors include context when propagated
- [ ] No swallowed errors

### Documentation

- [ ] Types exported from `/core/domain`
- [ ] JSDoc comments for public APIs
- [ ] `docs/reference/CODE_OVERVIEW.md` updated if structure changed

---

## Questions?

1. Check [/AGENTS.md](../AGENTS.md) for project-wide principles
2. Review existing services/providers for patterns
3. Test in Node.js to catch platform leakage

**Remember**: No browser globals, no Chrome APIs, no Express. Use DI for side effects. Prefer pure functions. Test in Node.js.
