# Chat Streaming (SSE) Architecture

> **Status**: Implemented | **Version**: 1.0 | **Date**: 2025-01

## Overview

The Lock-in chat feature supports **real-time streaming responses** using Server-Sent Events (SSE). This enables progressive display of LLM responses as tokens are generated, providing a superior user experience compared to blocking requests.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               Frontend (UI)                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  useChat(enableStreaming: true)                                       │   │
│  │    ├── useSendMessageStream()                                         │   │
│  │    │     ├── apiClient.processTextStream()                           │   │
│  │    │     │     └── parseSSEStream()                                  │   │
│  │    │     └── callbacks: onMeta, onDelta, onFinal, onError            │   │
│  │    └── streaming state: { isStreaming, streamedContent, meta, error }│   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┬─────────┘
                                                                    │
                                          HTTP POST /api/lockin/stream
                                          Content-Type: text/event-stream
                                                                    │
┌───────────────────────────────────────────────────────────────────▼─────────┐
│                               Backend (API)                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  POST /lockin/stream → streamController.handleLockinStreamRequest()  │   │
│  │    ├── sseWriter (writeMeta, writeDelta, writeFinal, writeError)    │   │
│  │    └── streamingAssistantService.handleLockinStreamRequest()        │   │
│  │          ├── Rate limiting                                           │   │
│  │          ├── Chat/message persistence                                │   │
│  │          └── providerChain.chatCompletionStream()                   │   │
│  │                ├── Gemini adapter (primary)                         │   │
│  │                ├── Groq adapter (fallback)                          │   │
│  │                └── OpenAI adapter (fallback)                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## SSE Event Protocol

### Event Types

| Event   | Payload                                    | Description                          |
| ------- | ------------------------------------------ | ------------------------------------ |
| `meta`  | `{ chatId, messageId, model }`             | Session metadata (sent first)        |
| `delta` | `{ content, index }`                       | Incremental token chunk              |
| `final` | `{ content, finishReason, usage, title? }` | Complete response with metadata      |
| `error` | `{ code, message, retryable }`             | Error during stream                  |
| `done`  | `{}`                                       | Stream complete signal (always last) |

### Example Stream

```
event: meta
data: {"chatId":"uuid-1234","messageId":"uuid-5678","model":"gemini-2.0-flash"}

event: delta
data: {"content":"Hello","index":0}

event: delta
data: {"content":" there!","index":1}

event: final
data: {"content":"Hello there!","finishReason":"stop","usage":{"inputTokens":10,"outputTokens":2}}

event: done
data: {}
```

## Usage

### Enabling Streaming

```tsx
// In your component
const chat = useChat({
  apiClient,
  mode: 'explain',
  pageUrl: window.location.href,
  courseCode: 'CS101',
  enableStreaming: true, // Enable streaming mode
});

// Access streaming state
const { streaming, cancelStream, isSending } = chat;

if (streaming?.isStreaming) {
  console.log('Current content:', streaming.streamedContent);
}

// Cancel a stream in progress
cancelStream?.();
```

### Streaming State

```ts
interface StreamingState {
  isStreaming: boolean; // Currently receiving data
  streamedContent: string; // Accumulated content
  meta: StreamMetaEvent | null; // Chat/message IDs
  error: StreamErrorEvent | null; // Error if failed
  isComplete: boolean; // Stream finished successfully
}
```

### Direct API Usage

For advanced use cases, use the streaming hook directly:

```tsx
const { sendMessageStream, isStreaming, streamedContent, meta, cancelPending } =
  useSendMessageStream({
    apiClient,
    mode: 'explain',
    pageUrl,
    courseCode,
    onStreamStart: (meta) => console.log('Started:', meta.chatId),
    onStreamDelta: (delta, accumulated) => {
      // Update UI progressively
    },
    onStreamComplete: (final) => {
      // Handle completion
    },
    onStreamError: (error) => {
      // Handle error
    },
  });
```

## Configuration

### Backend Environment

```env
# Enable/disable streaming endpoint (default: enabled)
ENABLE_STREAMING=true
```

### Feature Detection

The API client automatically detects streaming support:

```ts
if (apiClient.processTextStream) {
  // Streaming available
}
```

## Error Handling

### Stream Errors

Errors during streaming are delivered as `error` events:

```json
{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests",
  "retryable": true
}
```

### Client Disconnection

When the client disconnects mid-stream:

1. `AbortSignal` triggers on the server
2. LLM request is cancelled
3. Partial data is NOT saved (fail-fast strategy)

### Network Failures

The SSE parser handles:

- Chunked data reassembly
- Incomplete JSON buffering
- Graceful timeout handling

## Files

### Backend

| File                                                      | Purpose                         |
| --------------------------------------------------------- | ------------------------------- |
| `backend/providers/llm/contracts.js`                      | Streaming chunk types           |
| `backend/providers/llm/adapters/geminiAdapter.js`         | Gemini streaming implementation |
| `backend/providers/llm/providerChain.js`                  | Multi-provider streaming        |
| `backend/utils/sseWriter.js`                              | SSE response formatting         |
| `backend/controllers/assistant/stream.js`                 | Streaming endpoint handler      |
| `backend/services/assistant/streamingAssistantService.js` | Business logic                  |
| `backend/routes/assistantRoutes.js`                       | Route registration              |

### Frontend (API Client)

| File                            | Purpose                      |
| ------------------------------- | ---------------------------- |
| `api/fetcher/sseParser.ts`      | SSE event parsing            |
| `api/resources/lockinClient.ts` | `processTextStream()` method |
| `api/client.ts`                 | Type exports                 |

### Frontend (UI)

| File                                              | Purpose                      |
| ------------------------------------------------- | ---------------------------- |
| `ui/extension/chat/hooks/useSendMessageStream.ts` | Streaming React hook         |
| `ui/extension/chat/hooks/useChat.ts`              | Orchestration with streaming |
| `ui/extension/chat/hooks/chatHookTypes.ts`        | Return type definitions      |
| `ui/extension/chat/types.ts`                      | `enableStreaming` option     |

## Testing

### Backend Tests

```bash
cd backend && npm test -- --grep streaming
```

### Frontend Tests

```bash
npx vitest run api/__tests__/sseParser.test.ts
npx vitest run api/__tests__/lockinClientStream.test.ts
```

## Migration from Blocking Mode

Streaming is **opt-in** and backward compatible:

1. Existing code continues to work without changes
2. Set `enableStreaming: true` to enable
3. Both modes use the same success/error callbacks
4. `isSending` works for both modes

## Future Enhancements

- [ ] Groq adapter streaming support
- [ ] OpenAI adapter streaming support
- [ ] UI components for streaming display
- [ ] Retry logic for recoverable stream errors
- [ ] Server-side streaming cache for resume
