# Core AGENTS.md

> **Inherits**: [`/AGENTS.md`](../AGENTS.md) — All root rules apply here

## Purpose

Platform-agnostic domain logic. Must work in Node.js, Browser, and SSR.

---

## Forbidden

```javascript
// ❌ NEVER use these in /core
(window, document, chrome, localStorage, fetch, require('express'));
```

Use **dependency injection** instead:

```typescript
// ✅ GOOD - Injected fetcher
function extractTranscript(video: Video, fetcher: Fetcher): Promise<Transcript>;
```

---

## Module Structure

| Folder         | Purpose                          | Rules                      |
| -------------- | -------------------------------- | -------------------------- |
| `/domain`      | Types, interfaces, domain models | No side effects            |
| `/services`    | Business logic                   | Pure or DI-based           |
| `/transcripts` | Transcript providers             | Fetcher injected           |
| `/utils`       | Pure helpers                     | No external deps           |
| `/errors`      | Error taxonomy                   | Only `AppError` subclasses |
| `/storage`     | Storage interfaces               | Abstractions only          |

---

## Transcript Providers

All providers implement:

```typescript
interface TranscriptProvider {
  providerId: string;
  canHandle(context: VideoContext): boolean;
  extract(context: VideoContext, fetcher: Fetcher): Promise<TranscriptResult>;
}
```

**Registry**: `/transcripts/providers/index.ts` — single source of truth

---

## Error Handling

Throw only from `/core/errors`:

```typescript
throw new ValidationError('Invalid format');
throw new NetworkError('Timeout', { retryable: true });
```

---

## Testing

- **All functions testable without mocks** (or minimal mocks)
- **Test in Node.js** — if it fails, you have platform leakage
- **Providers**: Test with mock fetcher returning fixture data

---

## PR Checklist

- [ ] No browser/Node globals (run `npm run lint`)
- [ ] Dependencies injected, not imported
- [ ] Errors use `/core/errors` types
- [ ] Tests pass in Node.js environment
