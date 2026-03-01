# Lock-in Database Overview

This document describes the current Supabase/Postgres schema used by **Lock-in**.  
It exists so future humans and AI agents can understand how data is stored and avoid accidental breaking changes.

> **Key idea:** All tables are scoped by `user_id` (via Supabase `auth.users`) and support the core product loop:
> Capture → Understand → Distil → Organise → Act.

---

## Environment Separation

Lock-in uses **two separate Supabase projects** for environment isolation:

| Environment     | Project Reference      | URL                                      | Use Case                    |
| --------------- | ---------------------- | ---------------------------------------- | --------------------------- |
| **Development** | `uszxfuzauetcchwcgufe` | https://uszxfuzauetcchwcgufe.supabase.co | Local dev, staging, testing |
| **Production**  | `vtuflatvllpldohhimao` | https://vtuflatvllpldohhimao.supabase.co | Real users, real data       |

**Schema Sync Strategy:**

> **Single Source of Truth**: All migrations live in `supabase/migrations/` - this is the authoritative schema definition.

- Schema migrations are version-controlled in `supabase/migrations/`
- **Local dev**: Use `npm run db:reset` to apply migrations + seed data
- **Cloud sync**: Use `npm run db:push` to deploy to staging/production
- Apply migrations to dev first, test, then apply to prod
- See [docs/setup/LOCAL_DEVELOPMENT.md](/docs/setup/LOCAL_DEVELOPMENT.md) for local development setup

**Available Database Scripts** (from root package.json):

| Command             | Description                                |
| ------------------- | ------------------------------------------ |
| `npm run db:start`  | Start local Supabase containers            |
| `npm run db:stop`   | Stop local Supabase containers             |
| `npm run db:reset`  | Reset local DB with migrations + seed data |
| `npm run db:pull`   | Pull remote schema changes to local        |
| `npm run db:push`   | Push local migrations to remote Supabase   |
| `npm run db:status` | Show local Supabase status                 |
| `npm run db:keys`   | Output connection credentials (for .env)   |

---

## Database Roles

### Supabase Built-in Roles

| Role            | Description                          | RLS? |
| --------------- | ------------------------------------ | ---- |
| `authenticator` | Connection pooler role               | N/A  |
| `anon`          | Anonymous (unauthenticated) requests | Yes  |
| `authenticated` | Authenticated user requests          | Yes  |
| `service_role`  | Backend API (bypasses RLS)           | No   |

### Custom MCP Roles (Development Only)

| Role        | Description                  | Permissions                                  | Environment |
| ----------- | ---------------------------- | -------------------------------------------- | ----------- |
| `dev_admin` | MCP AI assistant (full CRUD) | SELECT, INSERT, UPDATE, DELETE on all tables | Dev only    |

**Note:** MCP has NO access to production database. All production writes go through the backend API.

**Setup Instructions:**

- [tools/mcp/docs/SUPABASE_DEV_ADMIN_SETUP.md](/tools/mcp/docs/SUPABASE_DEV_ADMIN_SETUP.md) - Full CRUD for MCP
- [tools/mcp/docs/SUPABASE_READONLY_SETUP.md](/tools/mcp/docs/SUPABASE_READONLY_SETUP.md) - Read-only for MCP (optional)

---

## Extensions & Schema Configuration

### pgvector Extension

The `pgvector` extension is used for semantic search via vector embeddings. It is installed in the `extensions` schema (not `public`).

**Important**: The database `search_path` must include the `extensions` schema for vector operations to work:

```sql
-- Required search_path configuration (run in Supabase SQL Editor)
SET search_path = public, extensions;

-- Make persistent for all roles:
ALTER ROLE authenticator SET search_path = public, extensions;
ALTER ROLE anon SET search_path = public, extensions;
ALTER ROLE authenticated SET search_path = public, extensions;
ALTER ROLE service_role SET search_path = public, extensions;
```

See `supabase/migrations/004_vector_extension_schema.sql` for full migration details.

---

## High-level Entities

- **User**
  - Comes from `auth.users` (Supabase).
  - Owns chats, messages, notes, folders, and AI request logs.

- **Chats & Messages**
  - `chats` = conversation sessions (e.g. per page, per topic).
  - `chat_messages` = individual turns within a chat (user/assistant/system).

- **Notes & Folders**
  - `notes` = saved study notes linked to pages/courses.
  - `folders` = user-defined groupings (e.g. "FIT2100 Week 1").
  - Currently there is **no explicit FK from notes → folders** – grouping is conceptual only.

- **Note Assets**
  - `note_assets` = uploaded files attached to a note (images, PDFs, docs).
  - Files live in Supabase Storage bucket `note-assets` at `<user_id>/<note_id>/<asset_id>.<ext>`.
  - Table stores metadata + storage path; URLs are derived with `getPublicUrl`.

- **AI Requests**
  - `ai_requests` = per-call log of AI usage (tokens in/out, mode).
  - Useful for analytics, quotas, and debugging.

- **Transcripts**
  - `transcripts` = per-user cached AI transcripts keyed by media fingerprint.
  - `transcript_jobs` = per-user AI transcription jobs (upload, processing, status).
  - `transcript_job_chunks` = uploaded chunk index tracking for integrity checks.

## Access Patterns

- Extension/web app clients call the backend through the shared TypeScript client (`/api`, bundled to `extension/dist/libs/initApi.js`) and attach the Supabase JWT from `window.LockInAuth`.

---

## Tables

### `chats`

Conversation sessions. Each chat represents a conversation thread.

```sql
CREATE TABLE public.chats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_message_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chats_pkey PRIMARY KEY (id),
  CONSTRAINT chats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```

**Fields:**

- `id` - Unique chat identifier
- `user_id` - Owner (FK to `auth.users`)
- `title` - Optional chat title (auto-generated or user-set)
- `created_at` - When chat was created
- `updated_at` - Last update timestamp
- `last_message_at` - Timestamp of most recent message (for sorting)

**Usage:** One chat per conversation thread. Title can be auto-generated from first message or user-set.

---

### `chat_messages`

Individual messages within a chat.

```sql
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  mode text,
  source text,
  input_text text,
  output_text text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_chat_id_fkey FOREIGN KEY (chat_id) REFERENCES public.chats(id),
  CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```

**Fields:**

- `id` - Unique message identifier
- `chat_id` - Parent chat (FK to `chats`)
- `user_id` - Owner (FK to `auth.users`)
- `role` - Message role: `"user"`, `"assistant"`, or `"system"`
- `mode` - Study mode used: `"explain"`, `"general"`
- `source` - Original selected text (for user messages)
- `input_text` - User input text
- `output_text` - Assistant response text
- `created_at` - Message timestamp

**Usage:** Stores conversation history. For user messages, `input_text` contains the user's question/selection. For assistant messages, `output_text` contains the AI response.

---

### `notes`

Study notes linked to pages/courses.

```sql
CREATE TABLE public.notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  content_json jsonb NOT NULL,
  editor_version text NOT NULL DEFAULT 'lexical_v1'::text,
  content_plain text,
  source_selection text,
  source_url text,
  course_code text,
  note_type text,
  tags ARRAY DEFAULT '{}'::text[],
  embedding USER-DEFINED,
  is_starred boolean NOT NULL DEFAULT FALSE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notes_pkey PRIMARY KEY (id),
  CONSTRAINT notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```

**Fields:**

- `id` - Unique note identifier
- `user_id` - Owner (FK to `auth.users`)
- `title` - Note title
- `content_json` - Canonical structured content (Lexical JSON), `NOT NULL`
- `editor_version` - Version tag for the editor that produced `content_json` (e.g., `lexical_v1`), `NOT NULL`, default `'lexical_v1'`
- `content_plain` - Plain text extracted from Lexical JSON for search/display purposes (nullable)
- `source_selection` - Original selected text that triggered note creation
- `source_url` - URL of the page where note was created
- `course_code` - Course code (e.g., "FIT1045") - auto-extracted or manual
- `note_type` - Type: `"manual"`, `"definition"`, `"formula"`, `"concept"`, `"general"`, `"ai-generated"`
- `tags` - Array of tags for organization
- `embedding` - Vector embedding for semantic search (pgvector)
- `is_starred` - Whether the note is starred/favorited for quick access (boolean, default `false`)
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

**Usage:** Stores user's study notes. Can be created manually or auto-generated from AI responses. Supports semantic search via embeddings.

**Content handling:**

- All notes must have `content_json` (Lexical JSON) and `editor_version` set.
- `content_plain` is automatically extracted from Lexical JSON and used for embeddings and search.
- Legacy notes with only HTML content are lazily migrated on read: the app converts HTML → minimal Lexical JSON and immediately persists `content_json` + `editor_version`.

---

### `note_assets`

Attachments for notes (images/documents). Files live in Supabase Storage bucket `note-assets` using the path `<user_id>/<note_id>/<asset_id>.<ext>`.

```sql
CREATE TABLE public.note_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  type text NOT NULL,         -- 'image', 'document', 'audio', 'video', 'other'
  mime_type text NOT NULL,
  storage_path text NOT NULL, -- path in Supabase Storage
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_note_assets_note_id ON public.note_assets(note_id);
CREATE INDEX idx_note_assets_user_id ON public.note_assets(user_id);
```

**Fields:**

- `id` - Asset id
- `note_id` - Parent note id (cascade delete)
- `user_id` - Owner (FK to `auth.users`)
- `type` - High-level category (`image`, `document`, `audio`, `video`, `other`)
- `mime_type` - Exact MIME type
- `storage_path` - Path inside the `note-assets` bucket
- `created_at` - Upload timestamp

**Usage:** Each record references a file in Supabase Storage. URLs are generated on read using `getPublicUrl(storage_path)`.

---

### `chat_message_assets`

Attachments for chat messages (images/documents/code files). Files live in Supabase Storage bucket `chat-assets` using the path `<user_id>/<chat_id>/<asset_id>.<ext>`.

```sql
CREATE TABLE public.chat_message_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  type text NOT NULL CHECK (type IN ('image', 'document', 'code', 'other')),
  mime_type text NOT NULL,
  storage_path text NOT NULL,  -- path in Supabase Storage bucket `chat-assets`
  file_name text,              -- original filename for display
  file_size integer,           -- size in bytes for validation
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_message_assets_message_id ON public.chat_message_assets(message_id);
CREATE INDEX idx_chat_message_assets_user_id ON public.chat_message_assets(user_id);
```

**Fields:**

- `id` - Asset id
- `message_id` - Parent chat message id (nullable for pending uploads, cascade delete)
- `user_id` - Owner (FK to `auth.users`)
- `type` - High-level category (`image`, `document`, `code`, `other`)
- `mime_type` - Exact MIME type
- `storage_path` - Path inside the `chat-assets` bucket
- `file_name` - Original filename for display purposes
- `file_size` - File size in bytes for validation and display
- `created_at` - Upload timestamp

**Usage:** Stores file attachments for chat messages. Images are sent to GPT-4o-mini for vision analysis. Documents and code files have their text extracted and included in the prompt context. Asset URLs are generated using signed URLs (private bucket).

**Cleanup:** Orphaned uploads (`message_id IS NULL`) older than 24 hours are deleted by `clean_orphaned_chat_assets()` (scheduled daily).

**RLS Policies:**

- Users can view, insert, and delete their own chat assets
- Access controlled via `user_id` column

---

### `folders`

User-defined folder groupings (future: for organizing notes).

```sql
CREATE TABLE public.folders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT folders_pkey PRIMARY KEY (id),
  CONSTRAINT folders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```

**Fields:**

- `id` - Unique folder identifier
- `user_id` - Owner (FK to `auth.users`)
- `name` - Folder name
- `created_at` - Creation timestamp

**Usage:** Currently not linked to notes via FK. Future: Add `folder_id` to `notes` table or use tags for organization.

---

### `ai_requests`

Log of AI API requests for analytics and quotas.

```sql
CREATE TABLE public.ai_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mode text NOT NULL,
  tokens_in integer,
  tokens_out integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ai_requests_pkey PRIMARY KEY (id),
  CONSTRAINT ai_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```

**Fields:**

- `id` - Unique request identifier
- `user_id` - User who made the request (FK to `auth.users`)
- `mode` - Study mode used: `"explain"`, `"general"`
- `tokens_in` - Input tokens consumed
- `tokens_out` - Output tokens generated
- `created_at` - Request timestamp

**Usage:** Tracks AI usage for rate limiting, analytics, and billing. Can be aggregated to show daily/weekly usage per user.

---

### `feedback`

User-submitted feedback (bug reports, feature requests, questions).

```sql
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  type text NOT NULL CHECK (type IN ('bug', 'feature', 'question', 'other')),
  message text NOT NULL,
  context jsonb, -- { url, courseCode, extensionVersion, browser, page }
  screenshot_url text, -- Optional Supabase Storage link (future)
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  admin_notes text, -- Internal notes (not shown to user)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_feedback_user_id ON public.feedback(user_id, created_at DESC);
CREATE INDEX idx_feedback_status ON public.feedback(status, created_at DESC);
```

**Fields:**

- `id` - Unique feedback identifier
- `user_id` - Submitting user (FK to `auth.users`)
- `type` - Feedback type: `"bug"`, `"feature"`, `"question"`, `"other"`
- `message` - User's feedback message
- `context` - Auto-captured context (URL, course code, extension version, browser)
- `screenshot_url` - Optional screenshot URL (future feature)
- `status` - Admin status: `"open"`, `"in_progress"`, `"resolved"`, `"closed"`
- `admin_notes` - Internal notes for admin (not shown to user)
- `created_at` - Submission timestamp
- `updated_at` - Last update timestamp

**Usage:** Stores user-submitted feedback. Users can view their own feedback; admins can view all (via future admin dashboard).

**RLS Policies:**

- Users can view and insert their own feedback
- Admin access will be added when admin dashboard is built

---

### `transcripts`

Per-user cached AI transcripts keyed by fingerprint.

```sql
CREATE TABLE public.transcripts (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  fingerprint text NOT NULL,
  provider text,
  media_url text,
  media_url_normalized text,
  etag text,
  last_modified text,
  duration_ms integer,
  transcript_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transcripts_pkey PRIMARY KEY (user_id, fingerprint)
);
```

**Fields:**

- `user_id` - Owner (FK to `auth.users`)
- `fingerprint` - Deterministic hash of media URL + duration
- `provider` - Transcription provider (e.g., `openai`)
- `media_url` - Redacted media URL (no raw tokens/queries)
- `media_url_normalized` - Redacted URL without query/hash (for cache keys)
- `etag` - Optional upstream ETag if known
- `last_modified` - Optional upstream Last-Modified if known
- `duration_ms` - Duration of media in milliseconds
- `transcript_json` - Canonical transcript payload (`TranscriptResult`)
- `created_at` - Cache insert time

**Usage:** Written by backend transcription pipeline. Read by jobs to return cached transcripts instantly.

**Access:** RLS enforced (users can only access their own cached transcripts).

---

### `transcript_jobs`

Per-user transcription jobs for tracking upload and processing state.

```sql
CREATE TABLE public.transcript_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  fingerprint text NOT NULL,
  provider text,
  media_url text,
  media_url_normalized text,
  duration_ms integer,
  status text NOT NULL DEFAULT 'created',
  error text,
  expected_total_chunks integer,
  bytes_received bigint NOT NULL DEFAULT 0,
  language_hint text,
  max_minutes integer,
  processing_started_at timestamptz,
  processing_heartbeat_at timestamptz,
  processing_worker_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transcript_jobs_pkey PRIMARY KEY (id)
);
```

**Fields:**

- `id` - Job id
- `user_id` - Owner (FK to `auth.users`)
- `fingerprint` - Cache key for the transcript
- `provider` - Source provider (panopto, echo360, html5)
- `media_url` - Redacted media URL used for upload
- `media_url_normalized` - Redacted URL without query/hash
- `duration_ms` - Duration of media in milliseconds
- `status` - Job state: `created` | `uploading` | `uploaded` | `processing` | `done` | `error` | `canceled`
- `error` - Failure reason when `status = error`
- `expected_total_chunks` - Total chunks expected for completion
- `bytes_received` - Total bytes received across unique chunks
- `language_hint` - Optional language hint for transcription (e.g., `en`)
- `max_minutes` - Optional max duration override in minutes for processing
- `processing_started_at` - When processing began (worker claim)
- `processing_heartbeat_at` - Last heartbeat timestamp for processing worker
- `processing_worker_id` - Worker instance identifier handling processing
- `created_at` - Job creation time
- `updated_at` - Last status update

**Usage:** Tracks AI transcription progress. Jobs are scoped by `user_id`.

---

### `transcript_job_chunks`

Unique chunk index tracking for transcript job uploads.

```sql
CREATE TABLE public.transcript_job_chunks (
  job_id uuid NOT NULL REFERENCES public.transcript_jobs(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  byte_size integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transcript_job_chunks_pkey PRIMARY KEY (job_id, chunk_index)
);
```

**Fields:**

- `job_id` - Parent transcription job
- `chunk_index` - Zero-based chunk index
- `byte_size` - Size of the chunk payload
- `created_at` - Chunk receipt time

**Usage:** Enforces idempotent uploads and validates completeness before processing.

**Storage:** Chunk binaries live in Supabase Storage bucket `transcript-jobs` with paths:
`<user_id>/<job_id>/chunk-000001.bin` (zero-padded indices for lexical ordering).
RLS policies allow users to read their own objects only within a 48-hour access window; backend service role bypasses this for processing/cleanup.

**Access:** RLS enforced via parent job ownership (`transcript_jobs.user_id`).

---

### `transcript_upload_windows`

Per-user per-minute upload windows used to enforce transcript chunk rate limits.

```sql
CREATE TABLE public.transcript_upload_windows (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  window_start timestamptz NOT NULL,
  bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transcript_upload_windows_pkey PRIMARY KEY (user_id, window_start)
);
```

**Fields:**

- `user_id` - Owner (FK to `auth.users`)
- `window_start` - UTC start of the 1-minute window
- `bytes` - Total bytes uploaded within the window
- `created_at` - Window record creation time
- `updated_at` - Last update time

**Usage:** Backing store for per-minute transcript upload throttling (atomic updates via RPC).

---

### `idempotency_keys`

Short-lived idempotency keys used to deduplicate Lock-in chat requests.

```sql
CREATE TABLE public.idempotency_keys (
  idempotency_key text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'in_progress',
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
```

**Fields:**

- `idempotency_key` - Client-supplied deduplication key
- `user_id` - Owner (FK to `auth.users`)
- `status` - `in_progress` | `completed` | `failed`
- `response` - Cached JSON response for completed requests
- `created_at` - Creation time
- `updated_at` - Last update time
- `expires_at` - TTL expiration time (short-lived)

**Usage:** Prevents duplicate AI requests across retries or network timeouts.

---

## TypeScript Types

See `/core/domain/types.ts` for TypeScript interfaces matching these tables:

- `ChatRecord` - Matches `chats` table
- `ChatMessageRecord` - Matches `chat_messages` table
- `NoteRecord` - Matches `notes` table
- `NoteAsset` - Frontend domain model for `note_assets` (camelCase: noteId, userId, mimeType, storagePath, createdAt)
- `NoteAssetType` - Union type: `'image' | 'document' | 'audio' | 'video' | 'other'`
- `ChatAsset` - Frontend domain model for `chat_message_assets` (defined in `api/resources/chatAssetsClient.ts`)
- `ChatAssetType` - Union type: `'image' | 'document' | 'code' | 'other'`
- `FolderRecord` - Matches `folders` table
- `AIRequestRecord` - Matches `ai_requests` table
- `FeedbackRecord` - Matches `feedback` table
- `FeedbackType` - Union type: `'bug' | 'feature' | 'question' | 'other'`
- `FeedbackStatus` - Union type: `'open' | 'in_progress' | 'resolved' | 'closed'`

---

## Relationships

```
auth.users (Supabase)
  -> chats (1:N)
     -> chat_messages (1:N)
        -> chat_message_assets (1:N)
  -> notes (1:N)
     -> note_assets (1:N)
  -> folders (1:N)
  -> ai_requests (1:N)
  -> feedback (1:N)
  -> idempotency_keys (1:N)
  -> transcripts (1:N)
  -> transcript_jobs (1:N)
      -> transcript_job_chunks (1:N)
  -> transcript_upload_windows (1:N)
```

**Note:** Currently no explicit relationship between `notes` and `folders`. Organization is done via `course_code` and `tags`.

## Indexes (Applied)

These indexes are in place for performance at scale (thousands of users). All indexes are defined in the migration that creates their table.

```sql
-- Notes: Primary listing (user + date)
CREATE INDEX idx_notes_user_created ON public.notes(user_id, created_at DESC);

-- Notes: Course code filter
CREATE INDEX idx_notes_course_code ON public.notes(user_id, course_code);

-- Notes: Source URL filter
CREATE INDEX idx_notes_source_url ON public.notes(user_id, source_url);

-- Notes: Optimistic locking queries
CREATE INDEX idx_notes_updated_at ON public.notes(user_id, updated_at DESC);

-- Notes: Starred notes filter (partial index for efficiency)
CREATE INDEX idx_notes_starred ON public.notes(user_id, is_starred, created_at DESC)
  WHERE is_starred = TRUE;

-- Notes: Semantic search (pgvector)
CREATE INDEX idx_notes_embedding ON public.notes
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Chats: Listing by user
CREATE INDEX idx_chats_user_last_message ON public.chats(user_id, last_message_at DESC);

-- Chat messages: History loading
CREATE INDEX idx_chat_messages_chat_created ON public.chat_messages(chat_id, created_at ASC);

-- Note assets: By note and user
CREATE INDEX idx_note_assets_note_id ON public.note_assets(note_id);
CREATE INDEX idx_note_assets_user_id ON public.note_assets(user_id);

-- Chat assets: Orphan cleanup (pending uploads)
CREATE INDEX idx_chat_message_assets_orphaned_created_at ON public.chat_message_assets(created_at)
  WHERE message_id IS NULL;

-- AI requests: Rate limiting + analytics
CREATE INDEX idx_ai_requests_user_created ON public.ai_requests(user_id, created_at DESC);
CREATE INDEX idx_ai_requests_created_at ON public.ai_requests(created_at DESC);

-- Transcript jobs: user + fingerprint lookups
CREATE INDEX idx_transcript_jobs_user_created ON public.transcript_jobs(user_id, created_at DESC);
CREATE INDEX idx_transcript_jobs_fingerprint ON public.transcript_jobs(fingerprint);

-- Transcript job chunks: lookup by job
CREATE INDEX idx_transcript_job_chunks_job ON public.transcript_job_chunks(job_id);

-- Transcript cache: normalized URL lookup
CREATE INDEX idx_transcripts_media_url_norm ON public.transcripts(media_url_normalized);
```

---

## Row Level Security (RLS) - Applied

All tables have RLS policies ensuring users can only access their own data. RLS policies are defined in the same migration that creates each table, ensuring self-contained, atomic migrations.

**Critical**: RLS provides defense-in-depth security. Even if application code has bugs, users cannot access each other's data.

**Tables with RLS enabled**: `chats`, `chat_messages`, `notes`, `note_assets`, `chat_message_assets`, `folders`, `ai_requests`, `feedback`, `transcripts`, `transcript_jobs`, `transcript_job_chunks`, `transcript_upload_windows`, `idempotency_keys`

```sql
-- Enable RLS on all tables
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
-- (Repeat for all tables)

-- Example policies for notes
CREATE POLICY "Users can view own notes"
  ON public.notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
  ON public.notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON public.notes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON public.notes FOR DELETE
  USING (auth.uid() = user_id);
```

**RLS Policy Sources by Table:**

| Table                       | Migration Source                         | Operations                     |
| --------------------------- | ---------------------------------------- | ------------------------------ |
| `chats`                     | `20260101000000_foundation.sql`          | SELECT, INSERT, UPDATE, DELETE |
| `chat_messages`             | `20260101000000_foundation.sql`          | SELECT, INSERT, UPDATE, DELETE |
| `notes`                     | `20260101000000_foundation.sql`          | SELECT, INSERT, UPDATE, DELETE |
| `folders`                   | `20260101000000_foundation.sql`          | SELECT, INSERT, UPDATE, DELETE |
| `ai_requests`               | `20260101000000_foundation.sql`          | SELECT, INSERT (append-only)   |
| `note_assets`               | `20260101000001_note_assets.sql`         | SELECT, INSERT, DELETE         |
| `chat_message_assets`       | `20260101000002_chat_message_assets.sql` | SELECT, INSERT, DELETE         |
| `feedback`                  | `20260101000003_feedback.sql`            | SELECT, INSERT                 |
| `transcripts`               | `20260101000004_transcripts.sql`         | SELECT, INSERT, UPDATE, DELETE |
| `transcript_jobs`           | `20260101000004_transcripts.sql`         | SELECT, INSERT, UPDATE, DELETE |
| `transcript_job_chunks`     | `20260101000004_transcripts.sql`         | SELECT (via parent job)        |
| `transcript_upload_windows` | `20260101000004_transcripts.sql`         | SELECT, INSERT, UPDATE         |
| `idempotency_keys`          | `20260101000005_idempotency.sql`         | SELECT, INSERT, UPDATE         |

---

## Migration Notes

- **No breaking changes**: All fields are nullable or have defaults where appropriate
- **Future additions**: Consider adding `folder_id` to `notes` for explicit folder relationships
- **Embeddings**: `embedding` field uses pgvector extension for semantic search
- **pgvector schema**: The `vector` extension lives in `extensions` schema. The foundation migration sets `search_path = public, extensions` for all roles.

### Migration Architecture

Migrations follow a consolidated, dependency-ordered structure using timestamp prefixes (`YYYYMMDDHHMMSS_name.sql`). Each migration is self-contained with its tables, indexes, RLS policies, and helper functions.

**Key Design Principles:**

1. **Foundation First**: `20260101000000_foundation.sql` creates all core tables that other migrations depend on
2. **Idempotent**: All migrations use `IF NOT EXISTS` and `DROP POLICY IF EXISTS` for safe re-runs
3. **Complete RLS**: Each table's RLS policies are defined in the same migration that creates the table
4. **Cleanup Functions**: Scheduled cleanup functions are defined alongside the tables they clean

### Applied Migrations

| Migration                                | Description                                                                                                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260101000000_foundation.sql`          | Core tables (chats, chat_messages, notes, folders, ai_requests), pgvector extension, semantic search, all performance indexes and RLS for foundation tables |
| `20260101000001_note_assets.sql`         | Note file attachments table with RLS                                                                                                                        |
| `20260101000002_chat_message_assets.sql` | Chat message attachments table with RLS and orphan cleanup                                                                                                  |
| `20260101000003_feedback.sql`            | User feedback table (bug reports, feature requests) with RLS                                                                                                |
| `20260101000004_transcripts.sql`         | Transcript cache, jobs, chunks, upload rate limiting, storage policies                                                                                      |
| `20260101000005_idempotency.sql`         | Request deduplication keys with TTL and cleanup function                                                                                                    |

### Running Migrations

```bash
# Reset local database with all migrations + seed data
npm run db:reset

# Push migrations to remote Supabase
npm run db:push
```

---

## Privacy & Ethics

### AI Transcription Privacy Measures

**Data Minimization:**

- Media URLs are redacted after transcript creation (removes session tokens, auth params)
- Transcripts expire after 90 days (automatic deletion)
- Failed jobs deleted after 7 days
- Only normalized URLs kept for cache lookups (fingerprint-based)
- Raw upload chunks stored in Supabase Storage (`transcript-jobs`) are deleted after a short grace period (default 48h) with a hard TTL (default 7 days)

**User Consent:**

- Explicit confirmation required before AI transcription
- Clear disclosure: "Process using OpenAI Whisper API (external, no training on your data)"
- Respects Panopto/LMS access controls (only uses downloadable videos)

**Scheduled Cleanup:**

- `clean_expired_transcripts()` - Run daily to delete expired content
- `redact_completed_job_urls()` - Run every 6 hours to redact URLs from completed jobs

---

## Questions?

- Check `/core/domain/types.ts` for TypeScript types
- Check backend repositories for query patterns
- Follow RLS policies - never expose user data across users
