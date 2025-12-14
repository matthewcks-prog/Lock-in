# Lock-in Database Overview

This document describes the current Supabase/Postgres schema used by **Lock-in**.  
It exists so future humans and AI agents can understand how data is stored and avoid accidental breaking changes.

> **Key idea:** All tables are scoped by `user_id` (via Supabase `auth.users`) and support the core product loop:
> Capture → Understand → Distil → Organise → Act.

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

See `backend/migrations/004_vector_extension_schema.sql` for full migration details.

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

## Access Patterns

- Extension/web app clients call the backend through the shared TypeScript client (`/api`, bundled to `extension/libs/initApi.js`) and attach the Supabase JWT from `window.LockInAuth`.

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
- `mode` - Study mode used: `"explain"`, `"simplify"`, `"translate"`, `"general"`
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
- `mode` - Study mode used: `"explain"`, `"simplify"`, `"translate"`, `"general"`
- `tokens_in` - Input tokens consumed
- `tokens_out` - Output tokens generated
- `created_at` - Request timestamp

**Usage:** Tracks AI usage for rate limiting, analytics, and billing. Can be aggregated to show daily/weekly usage per user.

---

## TypeScript Types

See `/core/domain/types.ts` for TypeScript interfaces matching these tables:

- `ChatRecord` - Matches `chats` table
- `ChatMessageRecord` - Matches `chat_messages` table
- `NoteRecord` - Matches `notes` table
- `NoteAsset` - Frontend domain model for `note_assets` (camelCase: noteId, userId, mimeType, storagePath, createdAt)
- `NoteAssetType` - Union type: `'image' | 'document' | 'audio' | 'video' | 'other'`
- `FolderRecord` - Matches `folders` table
- `AIRequestRecord` - Matches `ai_requests` table

---

## Relationships

```
auth.users (Supabase)
  -> chats (1:N)
     -> chat_messages (1:N)
  -> notes (1:N)
     -> note_assets (1:N)
  -> folders (1:N)
  -> ai_requests (1:N)
```

**Note:** Currently no explicit relationship between `notes` and `folders`. Organization is done via `course_code` and `tags`.

## Indexes (Applied)

These indexes are in place for performance at scale (thousands of users). Migration applied December 2024 via `backend/migrations/002_performance_indexes.sql`.

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

-- AI requests: Rate limiting + analytics
CREATE INDEX idx_ai_requests_user_created ON public.ai_requests(user_id, created_at DESC);
CREATE INDEX idx_ai_requests_created_at ON public.ai_requests(created_at DESC);
```

---

## Row Level Security (RLS) - Applied

All tables have RLS policies ensuring users can only access their own data. Migration applied December 2024 via `backend/migrations/003_row_level_security.sql`.

**Critical**: RLS provides defense-in-depth security. Even if application code has bugs, users cannot access each other's data.

**Tables with RLS enabled**: `chats`, `chat_messages`, `notes`, `note_assets`, `folders`, `ai_requests`

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

Apply similar policies to `chat_messages`, `chats`, `note_assets`, `folders`, and `ai_requests`.

---

## Migration Notes

- **No breaking changes**: All fields are nullable or have defaults where appropriate
- **Future additions**: Consider adding `folder_id` to `notes` for explicit folder relationships
- **Embeddings**: `embedding` field uses pgvector extension for semantic search
- **pgvector schema** (Dec 2024): The `vector` extension was moved to `extensions` schema. See `backend/migrations/004_vector_extension_schema.sql` for required `search_path` configuration.

### Applied Migrations

| Migration                         | Date     | Description                                    |
| --------------------------------- | -------- | ---------------------------------------------- |
| `001_note_assets.sql`             | Dec 2024 | Note assets table for file attachments         |
| `002_performance_indexes.sql`     | Dec 2024 | Performance indexes for all tables             |
| `003_row_level_security.sql`      | Dec 2024 | RLS policies for data isolation                |
| `004_vector_extension_schema.sql` | Dec 2024 | Fix pgvector after moving to extensions schema |
| `005_starred_notes.sql`           | Dec 2024 | Add is_starred column for favoriting notes     |

---

## Questions?

- Check `/core/domain/types.ts` for TypeScript types
- Check backend repositories for query patterns
- Follow RLS policies - never expose user data across users
