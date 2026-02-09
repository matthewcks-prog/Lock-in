# ADR-002: Truncate-on-Edit for Chat Message Revisions

**Status**: Accepted  
**Date**: 2026-02-08  
**Decision Makers**: Engineering team

## Context

Users need to edit previously sent messages in a chat conversation, similar to ChatGPT and Claude.
When a user edits an earlier message, the assistant responses generated after that message become stale
because they were based on different input. We need a data model that:

1. Preserves the canonical (visible) timeline after an edit.
2. Keeps revision history for auditability without exposing it in the UI (v1).
3. Avoids complex branching/tree structures that add UI and query complexity.
4. Works with the existing `chat_messages` table without a separate revisions table.

## Decision

We adopt **truncate-on-edit** semantics on a single `chat_messages` table with an `is_canonical` flag.

### Schema additions to `chat_messages`

| Column         | Type                             | Default  | Description                                          |
| -------------- | -------------------------------- | -------- | ---------------------------------------------------- |
| `edited_at`    | `timestamptz`                    | `NULL`   | When this message was superseded by a revision       |
| `revision_of`  | `uuid` (FK → `chat_messages.id`) | `NULL`   | Points to the original message this row revises      |
| `is_canonical` | `boolean`                        | `true`   | Whether this message is part of the current timeline |
| `status`       | `text`                           | `'sent'` | Delivery status: `sending`, `sent`, `failed`         |

### Edit flow

When the user edits message **M** in chat **C**:

1. **Mark M as edited**: Set `M.edited_at = now()`, `M.is_canonical = false`.
2. **Insert revision row**: New row with `revision_of = M.id`, `role = 'user'`, `is_canonical = true`, same `chat_id`.
3. **Truncate subsequent messages**: All messages in **C** with `created_at > M.created_at` → set `is_canonical = false`.
4. **Regenerate**: Call the LLM with canonical history up to and including the new revision. Insert the new assistant response as a canonical message.

### Query for canonical timeline

```sql
SELECT * FROM chat_messages
WHERE chat_id = $1 AND user_id = $2 AND is_canonical = true
ORDER BY created_at ASC;
```

Indexed by `idx_chat_messages_canonical_timeline`.

### Regeneration

- Uses the same streaming path (`streamingAssistantService`).
- History sent to LLM = canonical messages only (up to and including edited message).
- New assistant response is inserted as a canonical message.

## Consequences

### Positive

- Simple single-table model, no joins needed for the default view.
- Non-canonical rows are preserved for audit/analytics but invisible to users.
- No UI complexity for branching or version browsing (can be added later).
- Partial index keeps canonical queries fast as non-canonical rows accumulate.

### Negative

- Non-canonical rows accumulate over time (mitigated by partial index; can add TTL cleanup later).
- No way to "undo" an edit and restore the old branch (acceptable for v1).
- Slightly more storage than a destructive delete approach.

## Alternatives Considered

1. **Destructive delete**: Delete all messages after the edit point. Simpler, but loses history permanently.
2. **Separate revisions table**: Cleaner normalization, but adds join complexity and a new table to maintain.
3. **Tree/branch model (Claude-style)**: Full branching with parent pointers. Powerful but significantly more complex for both queries and UI. Deferred to a future iteration if user research demands it.

## Migration

See `supabase/migrations/20260101000006_chat_message_revisions.sql`.

## Client-Side Implementation (2026-02-09)

### Edit-as-Rewrite Flow (Frontend)

The client-side implementation mirrors the backend truncate-on-edit model:

1. **User clicks Edit** → `useMessageEdit.startEdit(messageId, content)` — cancels any active stream, sets editing state.
2. **User submits edit** → `useMessageEdit.submitEdit()` — calls `apiClient.editMessage(chatId, messageId, newContent)`.
3. **Backend returns `canonicalMessages`** — the truncated timeline with the revised user message.
4. **Cache update** — TanStack Query cache is set to `canonicalMessages`, removing all stale assistant/user messages after the edit point.
5. **Auto-regeneration** — `dispatchRegeneration(canonicalMessages, chatId)` sends the canonical timeline directly to the mutation (blocking or streaming), which builds LLM context from the canonical messages. **No duplicate user message is inserted** — the canonical timeline already contains the revised message.

### Key Design Decisions

- **`dispatchRegeneration` shared between edit and regenerate**: Both `onEditComplete` and `onRegenerateReady` use the same helper to avoid code duplication and ensure consistent behavior.
- **Direct mutation call, not `sendMessage`**: The regeneration path calls `sendMessageMutation(payload)` (or `sendMessageStream(payload)` when streaming is enabled) directly, bypassing `createSendMessage`. This prevents the optimistic user-message insertion that `createSendMessage` performs, which would cause a duplicate.
- **`resolveApiChatId` falls back to `activeChatId`**: Ensures follow-up messages after an edit resolve the correct server-side chat UUID even when the `chatId` param is a provisional ID.
- **RequestId guarding**: Each streaming request generates a `requestId` via `crypto.randomUUID()`. All `onMeta`, `onDelta`, `onFinal`, and `onError` callbacks check `activeRequestIdRef.current === requestId` before updating state, preventing stale deltas from a cancelled/superseded request from corrupting the timeline.

### Files Modified

| File                                              | Change                                                                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `ui/extension/chat/hooks/useChat.ts`              | Added `dispatchRegeneration` helper; wired edit/regenerate to use direct mutation instead of `sendMessage` |
| `ui/extension/chat/hooks/useMessageEdit.ts`       | No change (callback interface unchanged)                                                                   |
| `ui/extension/chat/hooks/useSendMessageStream.ts` | Added `activeRequestIdRef` + requestId guards on all SSE callbacks                                         |
| `ui/extension/chat/hooks/sendMessageUtils.ts`     | `resolveApiChatId` now falls back to `activeChatId`                                                        |
| `ui/extension/chat/components/MessageBlock.tsx`   | Action bar moved below bubble for user messages                                                            |
| `extension/contentScript.css`                     | Edit mode preserves bubble geometry; action bar uses `--below --user` classes                              |
