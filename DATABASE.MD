# Lock-in Database Overview

This document describes the current Supabase/Postgres schema used by **Lock-in**.  
It exists so future humans and AI agents can understand how data is stored and avoid accidental breaking changes.

> **Key idea:** All tables are scoped by `user_id` (via Supabase `auth.users`) and support the core product loop:
> Capture → Understand → Distil → Organise → Act.

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

## Indexes (Recommended)

For performance, consider adding indexes:

```sql
-- Chat queries
CREATE INDEX idx_chats_user_id ON public.chats(user_id);
CREATE INDEX idx_chats_last_message_at ON public.chats(last_message_at DESC);

-- Chat messages
CREATE INDEX idx_chat_messages_chat_id ON public.chat_messages(chat_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);

-- Notes queries
CREATE INDEX idx_notes_user_id ON public.notes(user_id);
CREATE INDEX idx_notes_course_code ON public.notes(course_code);
CREATE INDEX idx_notes_source_url ON public.notes(source_url);
CREATE INDEX idx_notes_updated_at ON public.notes(updated_at DESC);

-- Note assets
CREATE INDEX idx_note_assets_user_id ON public.note_assets(user_id);
CREATE INDEX idx_note_assets_note_id ON public.note_assets(note_id);

-- Semantic search (if using pgvector)
CREATE INDEX idx_notes_embedding ON public.notes USING ivfflat (embedding vector_cosine_ops);

-- AI requests (for analytics)
CREATE INDEX idx_ai_requests_user_id ON public.ai_requests(user_id);
CREATE INDEX idx_ai_requests_created_at ON public.ai_requests(created_at);
```

---

## Row Level Security (RLS)

All tables should have RLS policies ensuring users can only access their own data:

```sql
-- Example for chats
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chats"
  ON public.chats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chats"
  ON public.chats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chats"
  ON public.chats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chats"
  ON public.chats FOR DELETE
  USING (auth.uid() = user_id);
```

Apply similar policies to `chat_messages`, `notes`, `note_assets`, `folders`, and `ai_requests`.

---

## Migration Notes

- **No breaking changes**: All fields are nullable or have defaults where appropriate
- **Future additions**: Consider adding `folder_id` to `notes` for explicit folder relationships
- **Embeddings**: `embedding` field uses pgvector extension for semantic search

---

## Questions?

- Check `/core/domain/types.ts` for TypeScript types
- Check backend repositories for query patterns
- Follow RLS policies - never expose user data across users

