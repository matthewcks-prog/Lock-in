# AI Services Architecture - Lock-in

**Last Updated:** 2026-01-19

## Overview

Lock-in uses a **provider factory pattern** with **automatic fallback** for AI services. Each service (chat, embeddings, transcription) has a dedicated factory that handles provider selection and fallback logic.

---

## Service Strategy

### 1. Chat Completions â†’ OpenAI (Primary Only)

**Provider:** OpenAI  
**Model:** `gpt-4o-mini`  
**Cost:** ~$0.23/month  
**Rationale:** No Azure GPT quota available on student accounts  
**Fallback:** None (student budget optimized for single provider)

**Architecture:**

- Factory: `backend/providers/llmProviderFactory.js`
- Consumer: `backend/services/llmClient.js`
- Line count: 492 lines (chat orchestration + prompt building)

**Key Files:**

```
backend/providers/llmProviderFactory.js  (chat client factory)
backend/services/llmClient.js            (chat orchestration & prompts)
```

---

### 2. Text Embeddings â†’ Azure OpenAI (Primary) â†’ OpenAI (Fallback)

**Primary:** Azure OpenAI Embeddings  
**Fallback:** OpenAI Embeddings  
**Model:** `text-embedding-3-small`  
**Cost:** FREE (uses $100 Azure credits)  
**Quota:** 1000 TPM (Tokens Per Minute)

**Architecture:**

- Factory: `backend/providers/embeddingsFactory.js` (219 lines)
- Service: `backend/services/embeddings.js` (102 lines)
- Consumers:
- `backend/services/notes/notesService.js` (semantic search, note embeddings)
- `backend/services/notes/chatService.js` (RAG queries)

**Key Features:**

- Checks `isAzureEmbeddingsEnabled()` (validates deployment exists)
- Automatic fallback on quota/auth errors
- Batch embedding support (for bulk operations)
- Singleton client instance (performance optimization)

**Key Files:**

```
backend/providers/embeddingsFactory.js       (factory + fallback logic)
backend/providers/azureEmbeddingsClient.js   (Azure-specific implementation)
backend/services/embeddings.js               (service wrapper)
backend/services/notes/notesService.js       (consumer: note embeddings)
backend/services/notes/chatService.js        (consumer: RAG queries)
```

---

### 3. Transcription â†’ Azure Speech (Primary) â†’ OpenAI Whisper (Fallback)

**Primary:** Azure Speech-to-Text  
**Fallback:** OpenAI Whisper  
**Cost:** FREE (5 hours/month on Azure)  
**Rationale:** Azure Speech has higher limits and better regional support

**Architecture:**

- Factory: `backend/providers/transcriptionFactory.js` (207 lines)
- Service: `backend/services/transcripts/transcriptionService.js` (120 lines)
- Consumer: `backend/services/transcripts/transcriptsService.js` (transcript job orchestration)

**Key Features:**

- Language code mapping (ISO 639-1 â†’ Azure locale format)
- File size validation (25MB limit for Whisper, 200MB for Azure Speech)
- Automatic format detection
- Response normalization (Azure â†” Whisper format compatibility)

**Key Files:**

```
backend/providers/transcriptionFactory.js       (factory + fallback logic)
backend/providers/azureSpeechClient.js          (Azure Speech implementation)
backend/services/transcripts/transcriptionService.js (service wrapper)
backend/services/transcripts/transcriptsService.js   (consumer: job orchestration)
```

---

## File Organization

### Provider Layer (`backend/providers/`)

- **Purpose:** Client instantiation, fallback logic, error handling
- **Pattern:** Factory pattern with dependency injection
- **Files:**
  - `llmProviderFactory.js` - Chat completion clients
  - `embeddingsFactory.js` - Embeddings clients (Azure + OpenAI)
  - `transcriptionFactory.js` - Transcription clients (Azure Speech + Whisper)
  - `azureEmbeddingsClient.js` - Azure-specific embeddings implementation
  - `azureSpeechClient.js` - Azure Speech-specific implementation
  - `withFallback.js` - Retry + fallback utility (shared)

### Service Layer (`backend/services/`)

- **Purpose:** Business logic, request/response normalization
- **Pattern:** Service wrapper with singleton instances
- **Files:**
  - `embeddings.js` - Embeddings service (uses embeddingsFactory)
  - `transcripts/transcriptionService.js` - Transcription service (uses transcriptionFactory)
  - `transcripts/transcriptsService.js` - Transcript job orchestration (uses transcription service)
  - `llmClient.js` - Chat completions orchestration (uses llmProviderFactory)

### Controller Layer (`backend/controllers/`)

- **Purpose:** HTTP request handling, business logic coordination
- **Files:**
  - `assistant/ai.js` - Main chat endpoint (delegates to assistantService -> llmClient)
  - `assistant/chat.js` - Chat listing and message retrieval
  - `assistant/title.js` - Chat title generation (chatTitleService -> llmClient)
  - `notes/crud.js` - Note CRUD + embeddings (uses embeddings service)
  - `notes/chat.js` - RAG queries (notes chat service -> embeddings + llmClient)

---

## Configuration

### Environment Variables

**OpenAI:**

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDINGS_MODEL=text-embedding-3-small
```

**Azure OpenAI (Embeddings Only):**

```env
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://....openai.azure.com
AZURE_OPENAI_API_VERSION=2024-02-01
AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT=text-embedding-3-small
```

**Azure Speech (Transcription Only):**

```env
AZURE_SPEECH_API_KEY=...
AZURE_SPEECH_REGION=australiaeast
AZURE_SPEECH_LANGUAGE=en-US
```

### Configuration Functions

**backend/config/index.js:**

```javascript
// Chat: Always OpenAI (no Azure check needed)
isOpenAIEnabled(); // Checks OPENAI_API_KEY

// Embeddings: Azure (primary) â†’ OpenAI (fallback)
isAzureEmbeddingsEnabled(); // Checks AZURE_OPENAI_API_KEY + ENDPOINT + EMBEDDINGS_DEPLOYMENT

// Transcription: Azure Speech (primary) â†’ Whisper (fallback)
isAzureSpeechEnabled(); // Checks AZURE_SPEECH_API_KEY + REGION
```

---

## Design Principles

### 1. Separation of Concerns

- **Factories:** Client instantiation + configuration
- **Services:** Business logic + normalization
- **Controllers:** HTTP handling + orchestration

### 2. Dependency Injection

- Factories create clients with explicit configuration
- Services depend on factory interfaces, not concrete implementations
- Enables testing with mock clients

### 3. Fail-Fast Validation

- Configuration validation at startup (backend/index.js)
- Provider availability checks before request handling
- Clear error messages with remediation steps

### 4. Graceful Degradation

- Automatic fallback on quota/auth errors
- Detailed error context for debugging
- Log provider usage for monitoring

### 5. Cost Optimization

- Azure embeddings (FREE with $100 credits)
- Azure Speech (FREE 5hrs/month)
- OpenAI chat only (~$0.23/month for gpt-4o-mini)

---

## Module Line Counts

**Target:** Primary files <250 lines (per REFACTOR_PLAN.md)

| Module                                | Lines | Status                                |
| ------------------------------------- | ----- | ------------------------------------- |
| `embeddingsFactory.js`                | 219   | âœ… Under limit                       |
| `transcriptionFactory.js`             | 207   | âœ… Under limit                       |
| `llmProviderFactory.js`               | 41    | âœ… Under limit                       |
| `embeddings.js`                       | 102   | âœ… Under limit                       |
| `transcripts/transcriptionService.js` | 120   | âœ… Under limit                       |
| `services/llmClient.js`               | 492   | âš ï¸ Orchestration file (acceptable) |

**Refactor Complete:** All targeted modules are now under the 250-line threshold. `services/llmClient.js` is larger but serves as the main chat orchestration layer (prompt building, context management, streaming).

---

## Migration Summary (2026-01-19)

### Changes Made:

1. **Created `backend/services/embeddings.js`** - Uses embeddingsFactory with proper Azure check
2. **Updated `backend/providers/llmProviderFactory.js`** - Simplified to OpenAI-only for chat
3. **Updated `backend/services/transcripts/transcriptsService.js`** - Uses transcription service
4. **Updated controllers** - Use embeddings.js service instead of the LLM client
5. **Removed from services/llmClient.js** - Legacy embedText() and transcribeAudioFile() functions

### Before:

- âŒ embedText() in the legacy LLM client used `isAzureEnabled()` (chat check, not embeddings)
- âŒ embeddingsFactory existed but wasn't used
- âŒ transcriptsService imported from the legacy LLM client (wrong layer)
- âŒ Mixed concerns: chat, embeddings, transcription in one file

### After:

- âœ… Embeddings use `isAzureEmbeddingsEnabled()` (correct check)
- âœ… embeddingsFactory properly used via embeddings.js service
- âœ… Transcription uses dedicated transcription service
- âœ… services/llmClient.js focused on chat only (492 lines, down from 710)
- âœ… Clear separation: factories â†’ services â†’ controllers

### Verification:

```bash
npm run check  # âœ… All tests pass, build succeeds
```

---

## Testing

### Unit Tests:

- `core/transcripts/providers/__tests__/` - Provider extraction logic
- `core/services/__tests__/notesService.test.ts` - Note service (embeddings)

### Integration Tests:

- Test factories with mock clients
- Test fallback logic with simulated failures
- Test response normalization

### End-to-End:

- Manual testing with real API keys
- Monitor provider usage in production logs

---

## Future Considerations

1. **Rate Limiting:** Add per-user rate limits for embeddings/transcription
2. **Caching:** Cache embeddings for frequently accessed notes
3. **Monitoring:** Track provider usage, fallback frequency, error rates
4. **Cost Tracking:** Monitor OpenAI usage vs. Azure credits
5. **Batch Processing:** Optimize bulk embedding operations

---

## Related Documentation

- `AGENTS.md` - Overall architecture and coding rules
- `docs/tracking/REFACTOR_PLAN.md` - Refactor progress and acceptance criteria
- `backend/README.md` - Backend setup and deployment
- `.env.example` - Environment variable reference
