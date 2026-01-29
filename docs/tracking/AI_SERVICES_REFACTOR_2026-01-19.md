# AI Services Refactor Summary

**Date:** 2026-01-19  
**Session Type:** Architecture Refactor + Bug Fix  
**Status:** âœ… Complete

**Note (2026-01-29):** Paths updated to match current layout (`services/llmClient.js`, `services/transcripts/*`); line counts updated to current values.

---

## Problem Statement

The existing AI services architecture had several issues:

1. **Wrong Configuration Check:** `embedText()` in the legacy LLM client (now `services/llmClient.js`) used `isAzureEnabled()` (checks chat deployment) instead of `isAzureEmbeddingsEnabled()` (checks embeddings deployment)
2. **Unused Factory:** `embeddingsFactory.js` existed but wasn't being used
3. **Mixed Concerns:** Legacy LLM client (now `services/llmClient.js`) contained chat, embeddings, and transcription logic (710 lines)
4. **Wrong Layer Dependencies:** `services/transcripts/transcriptsService.js` imported from the legacy LLM client instead of using a dedicated transcription service

---

## Solution

Implemented **provider factory pattern** with proper separation of concerns:

### 1. Chat Completions â†’ OpenAI (Primary Only)

- **Rationale:** No Azure GPT quota on student accounts
- **Model:** `gpt-4o-mini` (~$0.23/month)
- **Factory:** `backend/providers/llmProviderFactory.js` (simplified to OpenAI-only)
- **Consumer:** `backend/services/llmClient.js` (492 lines, down from 710)

### 2. Text Embeddings â†’ Azure OpenAI (Primary) â†’ OpenAI (Fallback)

- **Rationale:** Uses $100 Azure credits (FREE), 1000 TPM quota
- **Factory:** `backend/providers/embeddingsFactory.js` (219 lines)
- **Service:** `backend/services/embeddings.js` (NEW, 102 lines)
- **Fix:** Now uses `isAzureEmbeddingsEnabled()` (correct check)
- **Consumers:** `services/notes/notesService.js`, `services/notes/chatService.js`

### 3. Transcription â†’ Azure Speech (Primary) â†’ OpenAI Whisper (Fallback)

- **Rationale:** Azure Speech has higher limits (5hrs/month free)
- **Factory:** `backend/providers/transcriptionFactory.js` (207 lines)
- **Service:** `backend/services/transcripts/transcriptionService.js` (120 lines)
- **Consumer:** `backend/services/transcripts/transcriptsService.js`

---

## Changes Made

### Files Created:

- âœ… `backend/services/embeddings.js` (102 lines)

### Files Modified:

- âœ… `backend/providers/llmProviderFactory.js` - Simplified to OpenAI-only for chat
- âœ… `backend/services/transcripts/transcriptsService.js` - Now imports from `./transcriptionService` instead of the legacy LLM client
- âœ… `backend/controllers/notes/crud.js` - Uses `embeddings.js` service
- âœ… `backend/controllers/notes/chat.js` - Uses `embeddings.js` service
- âœ… `backend/services/llmClient.js` - Removed `embedText()` and `transcribeAudioFile()`

### Documentation Updated:

- âœ… `docs/architecture/AI_SERVICES_ARCHITECTURE.md` - Complete architecture documentation
- âœ… `docs/tracking/REFACTOR_PLAN.md` - Marked Phase 3 OpenAI provider item as complete

---

## Architecture Improvements

### Before:

```
Legacy LLM client (710 lines)
â”œâ”€â”€ Chat completions âœ“
â”œâ”€â”€ Embeddings (wrong check) âœ—
â””â”€â”€ Transcription âœ—

Controllers
â””â”€â”€ Import from legacy LLM client âœ—
```

### After:

```
Factories (Provider Layer)
â”œâ”€â”€ llmProviderFactory.js â†’ services/llmClient.js (492 lines)
â”œâ”€â”€ embeddingsFactory.js â†’ embeddings.js (102 lines)
â””â”€â”€ transcriptionFactory.js â†’ services/transcripts/transcriptionService.js (120 lines)

Services (Business Logic)
â”œâ”€â”€ embeddings.js (uses embeddingsFactory)
â”œâ”€â”€ services/transcripts/transcriptionService.js (uses transcriptionFactory)
â””â”€â”€ services/llmClient.js (uses llmProviderFactory)

Controllers (HTTP Layer)
â”œâ”€â”€ Use embeddings.js âœ“
â”œâ”€â”€ Use services/transcripts/transcriptionService.js via services/transcripts/transcriptsService.js âœ“
â””â”€â”€ Use services/llmClient.js âœ“
```

---

## Benefits

### 1. Correct Configuration Checks

- âœ… Embeddings now use `isAzureEmbeddingsEnabled()` (validates deployment exists)
- âœ… Chat uses `isOpenAIEnabled()` (OpenAI-only)
- âœ… Transcription uses `isAzureSpeechEnabled()` (Azure Speech check)

### 2. Proper Separation of Concerns

- âœ… Factories handle client instantiation and fallback logic
- âœ… Services handle business logic and normalization
- âœ… Controllers handle HTTP requests and orchestration

### 3. Scalability & Maintainability

- âœ… All modules under 250 lines (except orchestration layer)
- âœ… Clear dependency flow: Controllers â†’ Services â†’ Factories
- âœ… Easy to test with mock clients

### 4. Cost Optimization

- âœ… Azure embeddings (FREE with $100 credits)
- âœ… Azure Speech (FREE 5hrs/month)
- âœ… OpenAI chat only (~$0.23/month)

---

## Module Line Counts

| Module                                         | Lines | Target | Status                    |
| ---------------------------------------------- | ----- | ------ | ------------------------- |
| `embeddingsFactory.js`                         | 219   | <250   | âœ…                       |
| `transcriptionFactory.js`                      | 207   | <250   | âœ…                       |
| `llmProviderFactory.js`                        | 41    | <250   | âœ…                       |
| `embeddings.js`                                | 102   | <250   | âœ…                       |
| `services/transcripts/transcriptionService.js` | 120   | <250   | âœ…                       |
| `services/llmClient.js`                        | 492   | N/A    | âš ï¸ Orchestration layer |

**Result:** All targeted modules are under the 250-line threshold âœ…

---

## Testing & Verification

### Commands Run:

```bash
npm run check
```

### Results:

- âœ… **Linting:** 74 warnings (no errors) - existing warnings, not introduced by changes
- âœ… **Tests:** 252 tests passed (23 test files)
- âœ… **Type Check:** No errors
- âœ… **Build:** All bundles built successfully

### Test Coverage:

- Unit tests for provider extraction logic
- Integration tests for notes service (embeddings)
- Surface tests for UI/extension contract

---

## Migration Path

### For Developers:

No code changes required in controllers or UI. The refactor is **backward compatible** at the API level.

### For Deployment:

Ensure environment variables are configured:

```env
# OpenAI (Chat)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Azure OpenAI (Embeddings)
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT=text-embedding-3-small

# Azure Speech (Transcription)
AZURE_SPEECH_API_KEY=...
AZURE_SPEECH_REGION=australiaeast
```

---

## Follow-Up Work

### Recommended Next Steps:

1. **Monitoring:** Track provider usage and fallback frequency in production
2. **Caching:** Add embedding caching for frequently accessed notes
3. **Rate Limiting:** Add per-user rate limits for embeddings/transcription
4. **Cost Tracking:** Monitor OpenAI usage vs. Azure credits

### Not Required (Working as Designed):

- Chat fallback (not needed for student accounts)
- Additional provider options (OpenAI + Azure sufficient)

---

## Related Issues

- [REFACTOR_PLAN.md Phase 3](./REFACTOR_PLAN.md) - OpenAI provider finalization
- [AI_SERVICES_ARCHITECTURE.md](../architecture/AI_SERVICES_ARCHITECTURE.md) - Complete architecture documentation

---

## Summary

This refactor **fixes the critical bug** where embeddings were using the wrong configuration check (`isAzureEnabled()` for chat instead of `isAzureEmbeddingsEnabled()` for embeddings) and **establishes clean architecture boundaries** following industry best practices:

- âœ… **Separation of Concerns:** Factories â†’ Services â†’ Controllers
- âœ… **Proper Configuration Checks:** Each service uses its own validation
- âœ… **Code Quality:** All modules under 250 lines (per REFACTOR_PLAN.md)
- âœ… **Cost Optimization:** Azure (free) for embeddings/transcription, OpenAI for chat
- âœ… **Verified:** All tests pass, build succeeds

The codebase is now **production-ready** with clear boundaries and proper provider routing.
