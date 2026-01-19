# Lock-in Backend API

Express.js backend server that powers the Lock-in Chrome extension. Provides AI-powered text processing, chat persistence, and note management with semantic search capabilities.

## Quick Start

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up environment:**

   ```bash
   # Copy template
   cp .env.example .env

   # Edit .env with your credentials
   # See docs/setup/ENVIRONMENT_SETUP.md for full guide
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

   📚 **Full documentation:**
   - [Environment Setup Guide](../docs/setup/ENVIRONMENT_SETUP.md) - Comprehensive setup instructions
   - [Quick Reference](../docs/setup/ENV_QUICK_REFERENCE.md) - Cheat sheet
   - [Migration Checklist](./MIGRATION_CHECKLIST.md) - Upgrade from legacy .env

3. **Run development server:**

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
├── config.js                   # Centralized configuration
├── utils/
│   └── validateEnv.js          # Environment validation
├── routes/
│   ├── lockinRoutes.js         # Chat/processing API routes
│   └── noteRoutes.js           # Notes API routes
├── controllers/
│   ├── lockinController.js     # Chat/processing request handlers
│   ├── notesController.js      # Notes CRUD operations
│   └── notesChatController.js  # Notes-based chat (RAG)
├── repositories/
│   └── notesRepository.js      # Database operations for notes
├── openaiClient.js             # LLM provider integration (Azure OpenAI + fallback)
├── chatRepository.js           # Chat persistence operations
├── supabaseClient.js           # Supabase client configuration
├── authMiddleware.js           # Authentication middleware
├── rateLimiter.js              # Rate limiting
├── utils/
│   └── validation.js           # Input validation utilities
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

| Variable                                | Description                           | Default                |
| --------------------------------------- | ------------------------------------- | ---------------------- |
| `AZURE_OPENAI_API_KEY`                  | Azure OpenAI API key (primary)        | -                      |
| `AZURE_OPENAI_ENDPOINT`                 | Azure OpenAI endpoint (primary)       | -                      |
| `AZURE_OPENAI_API_VERSION`              | Azure OpenAI API version              | 2024-02-01             |
| `AZURE_OPENAI_CHAT_DEPLOYMENT`          | Azure chat deployment name            | gpt-4o-mini            |
| `AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT`    | Azure embeddings deployment name      | text-embedding-3-small |
| `AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT` | Azure transcription deployment name   | whisper-1              |
| `OPENAI_API_KEY`                        | OpenAI API key (fallback)             | -                      |
| `OPENAI_FALLBACK_ENABLED`               | Enable OpenAI fallback                | true when key set      |
| `OPENAI_MODEL`                          | OpenAI chat model (fallback)          | gpt-4o-mini            |
| `OPENAI_EMBEDDINGS_MODEL`               | OpenAI embeddings model (fallback)    | text-embedding-3-small |
| `OPENAI_TRANSCRIPTION_MODEL`            | OpenAI transcription model (fallback) | whisper-1              |
| `SUPABASE_URL`                          | Supabase project URL (required)       | -                      |
| `SUPABASE_SERVICE_ROLE_KEY`             | Supabase service role key (required)  | -                      |
| `PORT`                                  | Server port                           | 3000                   |
| `DAILY_REQUEST_LIMIT`                   | Requests per user per day             | 100                    |
| `CHAT_LIST_LIMIT`                       | Default chat list size                | 20                     |
| `MAX_CHAT_LIST_LIMIT`                   | Maximum chat list size                | 100                    |

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
npm run test:azure          # Run verify-azure-embeddings.js
```

**Note:** `verify-azure-embeddings.js` and similar utility scripts are NOT unit tests. They make actual API calls and are used for manual verification only.

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

## License

MIT
