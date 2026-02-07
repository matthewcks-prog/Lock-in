# Lock-in Backend API

Express.js backend server that powers the Lock-in Chrome extension. Provides AI-powered text processing, chat persistence, and note management with semantic search capabilities.

## Quick Start

### Local Development (Recommended)

**Prerequisites:** Node.js >= 18, npm >= 9, Docker (optional)

```bash
# 1. Run automated setup script
.\scripts\dev\setup-local.ps1

# 2. Start backend
cd backend
npm run dev

# 3. Verify health
curl http://localhost:3000/health
```

**What the script does:**

- ✅ Starts local Supabase (http://127.0.0.1:54321)
- ✅ Creates `.env.local` from template
- ✅ Installs dependencies
- ✅ Applies database migrations

**Manual setup:** See [Local Development Guide](../docs/setup/LOCAL_DEVELOPMENT.md)

### Cloud Development

If you prefer using cloud Supabase (staging environment):

```bash
# 1. Copy template
cp .env.example .env

# 2. Add cloud credentials
# See docs/deployment/ENVIRONMENTS.md for full guide
```

**Minimum required:**

```env
NODE_ENV=development
SUPABASE_URL_DEV=https://your-dev-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY_DEV=your_service_role_key
AZURE_OPENAI_API_KEY=your_azure_openai_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o-mini
```

**Full documentation:**

- [Local Development Guide](../docs/setup/LOCAL_DEVELOPMENT.md) - **START HERE** for local Supabase
- [Environment Guide](../docs/deployment/ENVIRONMENTS.md) - Cloud environment strategy
- [Azure Embeddings Setup](./docs/AZURE_EMBEDDINGS_SETUP.md) - Azure embeddings verification

### Run Development Server

```bash
npm start  # Validates environment + starts server
```

Or with nodemon (auto-reload):

```bash
npm run dev
```

4. **For production:**
   ```bash
   npm run start:prod
   ```

## Environment Variables

### Security Model

- **Development:** Uses `*_DEV` credentials (local Supabase, dev AI resources)
- **Production:** Uses `*_PROD` credentials (prod Supabase, prod AI resources)
- **Validation:** Fails fast on startup if required variables are missing
- **Isolation:** Never mix dev/prod credentials in the same .env file

### Required Variables

See [.env.example](./.env.example) for complete list with descriptions.

**Core requirements:**

- `NODE_ENV` - Environment selection (development|staging|production)
- `SUPABASE_URL_DEV` / `SUPABASE_URL_PROD` - Database connection
- `SUPABASE_SERVICE_ROLE_KEY_DEV` / `SUPABASE_SERVICE_ROLE_KEY_PROD` - Database auth
- `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_ENDPOINT` - AI provider (or `OPENAI_API_KEY`)

## Project Structure

```
backend/
├── index.js                    # Server entry point + validation
├── app.js                      # Express application setup
├── config/
│   ├── index.js                # Centralized configuration
│   └── prompts.js              # Prompt templates
├── db/
│   └── supabaseClient.js       # Supabase client configuration
├── docs/
│   └── AZURE_EMBEDDINGS_SETUP.md
├── middleware/
│   ├── authMiddleware.js       # Authentication middleware
│   ├── errorHandler.js         # Error response mapping
│   └── uploadMiddleware.js     # Multer upload validation
├── observability/
│   ├── index.js                # Logger wiring
│   └── sentry.js               # Sentry integration
├── routes/
│   ├── assistantRoutes.js      # Chat/processing API routes
│   ├── noteRoutes.js           # Notes API routes
│   ├── transcriptsRoutes.js    # Transcript job routes
│   └── feedbackRoutes.js       # User feedback routes
├── controllers/
│   ├── assistant/
│   │   ├── ai.js               # AI request handlers
│   │   ├── chat.js             # Chat CRUD/listing
│   │   ├── title.js            # Chat title generation
│   │   └── assets.js           # Chat attachments
│   ├── notes/
│   │   ├── crud.js             # Notes CRUD operations
│   │   ├── chat.js             # Notes-based chat (RAG)
│   │   └── assets.js           # Note asset upload/list/delete
│   ├── transcripts/
│   │   └── index.js            # Transcript cache + job lifecycle
│   └── feedback/
│       └── index.js            # User feedback handlers
├── repositories/
│   ├── chatRepository.js       # Chat persistence operations
│   ├── notesRepository.js      # Database operations for notes
│   ├── noteAssetsRepository.js # Note asset metadata
│   ├── chatAssetsRepository.js # Chat asset metadata
│   ├── transcriptsRepository.js # Transcript jobs + cache
│   ├── feedbackRepository.js   # Feedback storage
│   └── rateLimitRepository.js  # Rate limit counters
├── providers/
│   ├── llm/                    # LLM providers (Gemini, Groq, OpenAI)
│   │   ├── index.js            # Main entry point
│   │   ├── providerChain.js    # Fallback & retry logic
│   │   ├── rateLimiter.js      # Rate limiting & cost tracking
│   │   └── adapters/           # Provider implementations
│   ├── embeddingsFactory.js    # Embeddings client factory
│   ├── transcriptionFactory.js # Transcription client factory
│   ├── storageRepository.js  # Supabase Storage wrapper (via repositories/)
├── services/
│   ├── llmClient.js            # LLM orchestration + prompts
│   ├── embeddings.js           # Embeddings service
│   ├── rateLimitService.js     # Rate limit enforcement
│   ├── feedbackService.js      # Feedback orchestration
│   ├── assistant/
│   │   ├── assistantService.js # /api/lockin orchestration
│   │   ├── chatService.js      # Chat CRUD/listing
│   │   ├── chatAssetsService.js # Chat asset lifecycle
│   │   └── chatTitleService.js # Chat title generation
│   ├── notes/
│   │   ├── notesService.js     # Notes orchestration
│   │   ├── noteAssetsService.js # Note asset lifecycle
│   │   └── chatService.js      # Notes-based chat (RAG)
│   └── transcripts/
│       ├── transcriptsService.js       # Transcript processing
│       ├── transcriptJobsService.js    # Job lifecycle orchestration
│       ├── transcriptionService.js     # Azure Speech / Whisper
│       ├── transcriptCacheService.js   # Cache upserts
│       └── transcriptStorage.js        # Storage wrapper
├── scripts/
│   ├── verify-azure-embeddings.js
│   └── verify-embeddings.js
├── utils/
│   ├── validateEnv.js          # Environment validation
│   └── chatAssetValidation.js  # Chat attachment validation
└── package.json                # Dependencies
```

## API Documentation

### Health Check

```
GET /health
```

Returns the status of the API.

**Response:**

```json
{
  "status": "ok",
  "message": "Lock-in API is running",
  "limits": {
    "maxSelectionLength": 5000,
    "maxUserMessageLength": 1500
  }
}
```

### Chat & Text Processing

#### Process Text

```
POST /api/lockin
```

Process text with AI assistance (Explain, General).

**Request Body:**

```json
{
  "selection": "The text to process",
  "mode": "explain",
  "chatHistory": [],
  "newUserMessage": "Optional follow-up question",
  "chatId": "optional-existing-chat-id"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "mode": "explain",
    "explanation": "AI-generated response",
    "notes": [],
    "todos": [],
    "tags": [],
    "difficulty": "medium"
  },
  "chatId": "uuid",
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 50
  }
}
```

#### List Chats

```
GET /api/chats?limit=20&cursor=2026-01-12T00:00:00.000Z
```

Get recent chats for authenticated user.

**Response:**

```json
{
  "chats": [
    {
      "id": "uuid",
      "title": "Chat title",
      "created_at": "2026-01-12T00:00:00.000Z",
      "updated_at": "2026-01-12T00:00:00.000Z",
      "last_message_at": "2026-01-12T00:00:00.000Z"
    }
  ],
  "pagination": {
    "hasMore": true,
    "nextCursor": "2026-01-11T23:59:00.000Z"
  }
}
```

#### Delete Chat

```
DELETE /api/chats/:chatId
```

Delete a chat and all its messages.

#### Get Chat Messages

```
GET /api/chats/:chatId/messages
```

Get all messages for a specific chat.

### Notes Management

#### Create Note

```
POST /api/notes
```

Create a new note with optional embedding for semantic search.

**Request Body:**

```json
{
  "title": "Note title",
  "content": "Note content",
  "sourceSelection": "Original text selection",
  "sourceUrl": "https://example.com/page",
  "courseCode": "CS101",
  "noteType": "manual",
  "tags": ["tag1", "tag2"]
}
```

**Response:**

```json
{
  "id": "uuid",
  "title": "Note title",
  "content": "Note content",
  "created_at": "2024-01-01T00:00:00Z",
  ...
}
```

#### List Notes

```
GET /api/notes?sourceUrl=&courseCode=&limit=
```

Get all notes for the authenticated user. Optional query parameters can be used for server-side filtering, but the client typically fetches all notes and filters client-side.

**Query Parameters:**

- `sourceUrl` (optional): Filter by page URL (for specific use cases)
- `courseCode` (optional): Filter by course code (for specific use cases)
- `limit` (optional): Max results (default: 50, max: 100)

#### Search Notes (Semantic Search)

```
GET /api/notes/search?q=query&courseCode=&k=
```

Search notes using semantic similarity (vector embeddings).

**Query Parameters:**

- `q` (required): Search query
- `courseCode` (optional): Filter by course code
- `k` (optional): Number of results (default: 10)

#### Chat with Notes (RAG)

```
POST /api/notes/chat
```

Answer questions using the user's notes as context (Retrieval-Augmented Generation).

**Request Body:**

```json
{
  "query": "What did I learn about databases?",
  "courseCode": "CS101",
  "k": 8
}
```

**Response:**

```json
{
  "answer": "AI-generated answer based on your notes",
  "usedNotes": [
    {
      "id": "uuid",
      "title": "Database Concepts",
      "courseCode": "CS101"
    }
  ]
}
```

## Environment Variables

| Variable                         | Description                               | Notes                                                    |
| -------------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| `NODE_ENV`                       | Environment selection                     | `production` uses `*_PROD`; any other value uses `*_DEV` |
| `SUPABASE_URL_DEV`               | Supabase URL for dev/staging              | Required when `NODE_ENV != production`                   |
| `SUPABASE_SERVICE_ROLE_KEY_DEV`  | Supabase service role key for dev/staging | Required when `NODE_ENV != production`                   |
| `SUPABASE_ANON_KEY_DEV`          | Supabase anon key for dev/staging         | Optional                                                 |
| `SUPABASE_URL_PROD`              | Supabase URL for production               | Required when `NODE_ENV = production`                    |
| `SUPABASE_SERVICE_ROLE_KEY_PROD` | Supabase service role key for production  | Required when `NODE_ENV = production`                    |
| `SUPABASE_ANON_KEY_PROD`         | Supabase anon key for production          | Optional                                                 |
| `AZURE_OPENAI_API_KEY`           | Azure OpenAI API key                      | Required unless `OPENAI_API_KEY` is set                  |
| `AZURE_OPENAI_ENDPOINT`          | Azure OpenAI endpoint                     | Required with `AZURE_OPENAI_API_KEY`                     |
| `OPENAI_API_KEY`                 | OpenAI API key                            | Satisfies the AI provider requirement on its own         |
| `PORT`                           | Server port                               | Default `3000`                                           |
| `DAILY_REQUEST_LIMIT`            | Per-user daily request limit              | Default `100`                                            |

For the full variable list and defaults, see `backend/.env.example` and `docs/deployment/ENVIRONMENTS.md`.

## Database Schema

### Chats Table

- `id` (UUID, primary key)
- `user_id` (UUID, foreign key)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### Messages Table

- `id` (UUID, primary key)
- `chat_id` (UUID, foreign key)
- `role` (text: 'user' | 'assistant')
- `content` (text)
- `created_at` (timestamp)

### Notes Table

- `id` (UUID, primary key)
- `user_id` (UUID, foreign key)
- `title` (text)
- `content` (text)
- `source_selection` (text, optional)
- `source_url` (text, optional)
- `course_code` (text, optional)
- `note_type` (text)
- `tags` (text array)
- `embedding` (vector, 1536 dimensions for OpenAI)
- `created_at` (timestamp)
- `updated_at` (timestamp)

**Required Supabase Configuration:**

1. **pgvector Extension**: Must be enabled in the `extensions` schema
2. **Search Path**: Database roles must have `search_path = public, extensions`
   ```sql
   ALTER ROLE authenticator SET search_path = public, extensions;
   ALTER ROLE anon SET search_path = public, extensions;
   ALTER ROLE authenticated SET search_path = public, extensions;
   ALTER ROLE service_role SET search_path = public, extensions;
   ```
3. **Function**: `match_notes(query_embedding vector, match_count int, in_user_id uuid)` - Vector similarity search

See `migrations/004_vector_extension_schema.sql` for full setup.

## Security

- ✅ All endpoints require authentication (Supabase JWT)
- ✅ Rate limiting per user (configurable daily limit)
- ✅ Input validation and sanitization
- ✅ CORS restricted to Chrome extensions
- ✅ No sensitive data in logs
- ✅ Error messages don't expose internal details

## Dependencies

- **express**: Web framework
- **cors**: Cross-origin resource sharing
- **dotenv**: Environment variable management
- **openai**: Official OpenAI API client (chat + embeddings)
- **@supabase/supabase-js**: Supabase client library

## Development

```bash
npm run dev  # Starts with nodemon for auto-reload
npm start    # Production server
```

## Testing

### Unit Tests

Run all unit tests using Node.js test runner:

```bash
npm test                    # Run all *.test.js files with spec reporter
npm run test:ci             # CI-specific test command (same as npm test)
```

**Test Files:**

- `**/*.test.js` - All unit test files
- Tests use Node.js built-in test runner (node:test)
- Mock external dependencies (Supabase, OpenAI)

### Integration Tests & Utilities

Verify Azure OpenAI embeddings configuration:

```bash
npm run test:azure          # Run scripts/verify-azure-embeddings.js
```

**Note:** `scripts/verify-azure-embeddings.js` and similar utility scripts are NOT unit tests. They make actual API calls and are used for manual verification only.

### API Testing

```bash
# Health check
curl http://localhost:3000/health

# Test explain mode (requires auth token)
curl -X POST http://localhost:3000/api/lockin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"selection":"Photosynthesis is the process","mode":"explain"}'
```

## LLM Rate Limiting

The backend implements industry-grade rate limiting for all LLM providers using token bucket algorithm with request queue smoothing.

### Features

- **Per-provider rate limits**: Gemini (200 RPM), Groq (30 RPM), OpenAI (50 RPM)
- **Request queue smoothing**: Prevents API burst overload
- **Retry-After header parsing**: Respects API rate limit signals
- **Automatic fallback**: Gemini → Groq → OpenAI on rate limit
- **Usage tracking**: Per-model token usage and cost visibility
- **Queue overflow protection**: Rejects requests when queue is full

### Configuration

Rate limits are configured in `providers/llm/rateLimiter.js`:

```javascript
const DEFAULT_LIMITS = {
  gemini: {
    reservoir: 200, // Requests per minute (paid tier, conservative)
    maxConcurrent: 10, // Max concurrent requests
    minTime: 50, // Minimum 50ms between requests
    highWater: 30, // Max queued jobs before rejecting
  },
  groq: {
    reservoir: 30, // Free tier: 30 RPM
    maxConcurrent: 3,
    minTime: 200,
    highWater: 10,
  },
  openai: {
    reservoir: 50, // Conservative (last resort)
    maxConcurrent: 5,
    minTime: 150,
    highWater: 15,
  },
};
```

### Usage

Rate limiting is automatically applied to all LLM requests:

```javascript
const { createChatProviderChain } = require('./providers/llm');

const chain = createChatProviderChain();
const result = await chain.chatCompletion(messages, options);
```

### Testing

**Unit tests:**

```bash
npm test  # Runs all tests including rateLimiter.test.js
```

**Integration tests:**

```bash
# Run integration tests (mock-based)
node --test backend/providers/llm/__tests__/rateLimiter.integration.test.js
```

**Real API testing:**

```bash
# Basic rate limiting test (10 requests)
node backend/providers/llm/__tests__/realApiTest.js

# Rate limit recovery test (50 rapid requests)
node backend/providers/llm/__tests__/realApiTest.js recovery
```

**Warning:** Real API tests consume API credits. Use sparingly.

### Monitoring

Usage statistics are logged every 5 minutes:

```json
{
  "message": "LLM usage stats",
  "models": [
    {
      "provider": "gemini",
      "model": "gemini-2.0-flash",
      "requests": 42,
      "tokens": 15234
    }
  ]
}
```

Get current queue stats programmatically:

```javascript
const { getRateLimiterManager } = require('./providers/llm/rateLimiter');
const manager = getRateLimiterManager();
const stats = manager.getQueueStats();
// { gemini: { running: 2, queued: 5, reservoir: 195 } }
```

### Error Handling

When rate limits are exceeded:

1. **Queue smoothing**: Requests are queued and executed when capacity is available
2. **Retry-After parsing**: System respects API-provided retry delays
3. **Automatic fallback**: Falls back to next provider (Groq, then OpenAI)
4. **Queue overflow**: Returns 429 with `X-Retry-After` header when queue is full

Example error response:

```json
{
  "error": "Rate limit queue full for gemini. Try again in a few seconds.",
  "status": 429,
  "retryAfter": 5
}
```

## License

MIT
