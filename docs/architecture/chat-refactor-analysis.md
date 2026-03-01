# Chat Feature Comprehensive Analysis & Refactor Plan

**Date**: 2026-02-18
**Status**: Critical Issues Identified
**Priority**: HIGH

## Executive Summary

After a comprehensive review of the chat feature (backend, frontend, state management, and UI), I've identified **multiple critical architectural issues** causing:

- Follow-up messages failing
- Chat history clicks causing errors
- Edit/regeneration flows breaking
- State synchronization problems

This document outlines root causes and industry-grade solutions.

---

## Critical Issues Identified

### 1. **Race Conditions in Chat Session Management**

**Location**: `ui/extension/chat/hooks/useChatSessionState.ts`, `createSelectChat.ts`

**Problem**:

- `activeChatId` and `activeHistoryId` can get out of sync
- When switching chats, streaming state isn't cancelled
- TanStack Query cache updates aren't atomic
- No cleanup of previous chat state when selecting a new chat

**Impact**:

- Messages sent to wrong chat
- UI shows wrong messages after switching
- Errors when clicking chat history

**Root Cause**: Multiple sources of truth without proper synchronization.

**Evidence**:

```typescript
// createSelectChat.ts - No cleanup of streaming state
deps.setActiveHistoryId(item.id);
deps.setActiveChatId(item.id);
// ❌ No cancelStream() call
// ❌ No cleanup of pending mutations
// ❌ No error state reset
```

---

### 2. **Provisional Chat ID System is Fragile**

**Location**: `ui/extension/chat/hooks/createSendMessage.ts`

**Problem**:

```typescript
const provisionalChatId = isValidUUID(deps.activeChatId)
  ? (deps.activeChatId as string)
  : hasChatId(deps.activeHistoryId)
    ? deps.activeHistoryId
    : `chat-${Date.now()}`; // ❌ Timestamp-based ID
```

**Issues**:

1. Provisional IDs (`chat-${Date.now()}`) don't match backend UUIDs
2. Cache keyed by provisional ID gets orphaned when real ID arrives
3. Complex fallback logic prone to edge cases
4. Can cause duplicate messages if timing is off

**Impact**:

- Follow-up messages fail because cache keys mismatch
- Messages lost in transition from provisional to real ID
- Duplicate chats created

**Solution**: Use crypto.randomUUID() for provisional IDs OR create chat immediately.

---

### 3. **Message Edit Flow Has Multiple Bugs**

**Location**: `ui/extension/chat/hooks/useMessageEdit.ts`, `backend/services/assistant/chatEditService.js`

**Problems**:

**A. Backend Truncation Not Atomic:**

```javascript
// chatEditService.js
const truncatedCount = await services.chatRepository.truncateAfterMessage({...});
const revision = await services.chatRepository.editMessage({...});
// ❌ Two separate DB operations - not in a transaction
```

**B. Frontend Doesn't Handle Edit Failure:**

```typescript
// useMessageEdit.ts - After edit succeeds
clearEditState(setEditingMessageId, setEditDraft);
onEditComplete?.(trimmed, normalized);
// ❌ If onEditComplete fails (regeneration), edit state is already cleared
```

**C. Cache Update Race:**

- Edit updates cache with canonical messages
- Regeneration starts immediately
- If user switches chats during regeneration, cache can be corrupted

**Impact**:

- Edit succeeds but regeneration fails silently
- Messages appear/disappear in UI randomly
- Inconsistent state between backend and frontend

---

### 4. **Stream Cancellation Doesn't Clean Up Properly**

**Location**: `ui/extension/chat/hooks/useSendMessageStream.ts`

**Problem**:

```typescript
const cancelPending = useCallback(() => {
  abortAndClearPendingRefs({...});
  resetState();
  // ❌ Doesn't clear error state in parent components
  // ❌ Doesn't invalidate queries
  // ❌ Doesn't reset message status in cache
}, [resetState]);
```

**Impact**:

- Error messages persist after cancellation
- "Generating..." indicator stuck
- Next message fails because stream thinks it's still active

---

### 5. **Chat History Pagination Has Edge Cases**

**Location**: `backend/repositories/chatRepository.js`, `ui/extension/chat/hooks/useChatHistory.ts`

**Problems**:

**A. Null Cursor Handling:**

```javascript
// chatRepository.js
if (cursor) {
  query = query.or(`last_message_at.lt.${cursor},last_message_at.is.null`);
}
// ❌ Includes null last_message_at in EVERY page
```

**B. Cache Merging Issues:**

```typescript
// useChatHistory.ts
const filtered = removeReplacedItems(flattened, item.id, previousId);
// ❌ Can remove chat from wrong page during concurrent updates
```

**Impact**:

- Chat history shows duplicates
- Pagination breaks after a few loads
- Recently created chats appear multiple times

---

### 6. **No Proper Error Boundaries**

**Location**: Across all chat components

**Problem**:

- No error boundaries around chat components
- Errors in one message can crash entire chat UI
- No retry mechanisms for transient failures
- No user-friendly error messages

**Impact**:

- Entire chat crashes on any error
- Users lose work when errors occur
- No way to recover without refreshing

---

### 7. **Backend Lacks Transaction Support**

**Location**: `backend/repositories/chatRepository.js`, `backend/services/assistant/chatEditService.js`

**Problem**:

- Edit + truncate not in a transaction
- Message insert + chat touch not atomic
- No rollback on partial failures

**Traditional approach** (current):

```javascript
await truncateAfterMessage({...});
await editMessage({...});
await touchChat(chatId);
// ❌ If editMessage fails, chat is in inconsistent state
```

**Industry standard** (ChatGPT/Claude):

```javascript
await supabase.rpc('edit_message_transaction', {
  p_user_id: userId,
  p_chat_id: chatId,
  p_message_id: messageId,
  p_new_content: content,
});
// ✅ All-or-nothing operation
```

---

### 8. **Message Status Not Tracked Properly**

**Location**: Frontend message rendering

**Problem**:

- `status` column exists in DB but not used in frontend
- No distinction between "sending", "sent", "failed"
- Optimistic updates have no rollback

**Impact**:

- Failed messages appear as sent
- No retry mechanism for failed sends
- User doesn't know if message actually sent

---

### 9. **No Idempotency Verification**

**Location**: `backend/controllers/assistant/ai.js`

**Problem**:

```javascript
// No verification that idempotency key matches request params
// Can send different message with same idempotency key
```

**Impact**:

- Duplicate messages on retry
- Idempotency key offers no protection

---

### 10. **State Cleanup on Unmount Missing**

**Location**: Multiple hooks

**Problem**:

- TanStack Query persists across unmount/remount
- Active queries not cancelled on unmount
- Mutations can complete after component unmounted

**Impact**:

- Memory leaks
- State updates on unmounted components
- Warnings in console

---

## Architecture Gaps vs. Industry Standards

### How ChatGPT/Claude Handle This

| Feature          | Current Lock-in                  | Industry Standard (ChatGPT/Claude)          |
| ---------------- | -------------------------------- | ------------------------------------------- |
| Chat Selection   | Direct state update, no cleanup  | Cancel pending ops → Clear cache → Load new |
| Message Send     | Optimistic update, pray it works | Pending state → Validate → Commit/Rollback  |
| Edit Flow        | Multi-step with race conditions  | Single transaction + invalidation           |
| Stream Cancel    | Abort controller only            | Abort + cleanup + reset + notify            |
| Error Handling   | Throw and hope                   | Error boundaries + retry + fallback         |
| State Management | Multiple sources of truth        | Single reducer with transitions             |
| Pagination       | Cursor with edge cases           | Cursor + deduplication + infinite scroll    |
| Offline Support  | None                             | Queue + sync + conflict resolution          |

---

## Proposed Architecture (Industry-Grade)

### Core Principles

1. **Single Source of Truth**: One Redux/Zustand store for chat session
2. **Atomic Operations**: Database transactions for multi-step operations
3. **Optimistic Updates with Rollback**: Never assume success
4. **Comprehensive Error Boundaries**: Isolate failures
5. **State Machines**: Explicit states (idle → loading → success/error)
6. **Idempotency**: Verify retry safety at application level
7. **Cleanup Lifecycle**: Cancel-all pattern on transitions

### Layer Responsibilities (Aligned with AGENTS.md)

**Backend** (`/backend`):

```
Routes → Controllers → Services → Repositories → Database
  ↓         ↓            ↓           ↓
Validate  Thin        Business    Query      Transactions
          Logic       Rules       Building   & Constraints
```

**Frontend** (`/ui/extension/chat`):

```
Components → Hooks → State → API Client → Backend
    ↓         ↓       ↓         ↓
  View     Logic   Cache    Fetcher     Validation
```

**Core** (`/core`):

```
Pure domain logic only
- Chat title generation
- Message validation
- Content sanitization
NO: network, chrome, react
```

---

## Refactor Plan

### Phase 1: Backend Stability (Critical)

**1.1 Add Database Transactions**

- Create stored procedures for:
  - `edit_message_transaction()`
  - `send_message_transaction()`
  - `delete_chat_transaction()`
- Ensures atomicity

**1.2 Enhance Chat Repository**

- Add `beginTransaction()` / `commit()` / `rollback()`
- Add batch operations method
- Add proper error types (not generic Error)

**1.3 Fix Idempotency**

- Store idempotency keys in DB
- Verify key matches request params
- Return cached response on duplicate

**1.4 Add Message Status Tracking**

- Update messages with proper status transitions
- Add `failed_reason` column
- Expose status in API responses

### Phase 2: Frontend State Management (Critical)

**2.1 Refactor Session State**

- Use Zustand or Jotai for chat session state
- Single reducer with state machine
- Explicit transitions (selecting → loading → active)

**2.2 Cleanup Chat Switching**

```typescript
async function selectChat(item: ChatHistoryItem) {
  // 1. Cancel all pending operations
  cancelStream();
  mutation.reset();

  // 2. Set transitional state
  setState({ type: 'switching', target: item.id });

  // 3. Clear old data
  queryClient.cancelQueries(chatMessagesKeys.byId(currentChatId));

  // 4. Load new data
  const messages = await loadMessages(item.id);

  // 5. Commit new state
  setState({ type: 'active', chatId: item.id, messages });
}
```

**2.3 Fix Provisional IDs**

- Use `crypto.randomUUID()` for provisional IDs
- Store mapping: provisional → real
- Migrate cache keys when real ID arrives

**2.4 Add Error Boundaries**

```tsx
<ChatErrorBoundary>
  <ChatSection />
</ChatErrorBoundary>
```

### Phase 3: Edit/Regeneration Flow (Critical)

**3.1 Backend Transaction**

```sql
CREATE OR REPLACE FUNCTION edit_message_transaction(
  p_user_id uuid,
  p_chat_id uuid,
  p_message_id uuid,
  p_new_content text
) RETURNS TABLE(...) AS $$
BEGIN
  -- Mark original non-canonical
  UPDATE chat_messages SET is_canonical = false WHERE id = p_message_id;

  -- Insert revision
  INSERT INTO chat_messages (...) VALUES (...) RETURNING * INTO new_message;

  -- Truncate after
  UPDATE chat_messages SET is_canonical = false
  WHERE chat_id = p_chat_id AND created_at > (SELECT created_at FROM chat_messages WHERE id = p_message_id);

  -- Touch chat
  UPDATE chats SET updated_at = now() WHERE id = p_chat_id;

  -- Return canonical timeline
  RETURN QUERY SELECT * FROM chat_messages WHERE chat_id = p_chat_id AND is_canonical = true ORDER BY created_at;
END;
$$ LANGUAGE plpgsql;
```

**3.2 Frontend Edit Flow**

```typescript
async function submitEdit() {
  try {
    setState({ type: 'submitting-edit' });

    // 1. Submit edit (gets canonical timeline back)
    const { canonicalMessages } = await apiClient.editMessage(...);

    // 2. Update cache atomically
    queryClient.setQueryData(chatMessagesKeys.byId(chatId), canonicalMessages);

    // 3. Trigger regeneration
    setState({ type: 'regenerating' });
    await regenerate();

    // 4. Success
    setState({ type: 'active' });
    clearEditState();
  } catch (error) {
    // Rollback UI state but keep edit draft
    setState({ type: 'edit-failed', error });
    // User can retry
  }
}
```

### Phase 4: History & Pagination (Medium Priority)

**4.1 Fix Pagination Query**

```javascript
// Only use non-null cursors
let query = supabase
  .from('chats')
  .select('*')
  .eq('user_id', userId)
  .is('last_message_at', 'not.null') // ✅ Exclude nulls
  .order('last_message_at', { ascending: false });

if (cursor) {
  query = query.lt('last_message_at', cursor);
}
```

**4.2 Add Deduplication**

```typescript
function upsertHistoryData(...) {
  // Deduplicate by ID before building pages
  const unique = new Map();
  for (const item of flattened) {
    unique.set(item.id, item);
  }
  // ... build pages from unique items
}
```

### Phase 5: Testing & Monitoring

**5.1 Add Integration Tests**

- Test chat switching flow
- Test edit → regenerate flow
- Test concurrent message sending
- Test offline → online recovery

**5.2 Add Error Monitoring**

- Sentry for frontend errors
- Backend error telemetry
- Performance monitoring

---

## Migration Strategy

### Step 1: Feature Flags

Add feature flag for new chat implementation:

```typescript
const USE_NEW_CHAT_FLOW = localStorage.getItem('ff_new_chat') === 'true';
```

### Step 2: Parallel Implementation

- Keep old code paths
- Implement new code alongside
- A/B test with small user group

### Step 3: Gradual Rollout

- Week 1: Internal testing
- Week 2: 10% of users
- Week 3: 50% of users
- Week 4: 100% rollout

### Step 4: Cleanup

- Remove old code
- Remove feature flags
- Update documentation

---

## Success Criteria

✅ **Reliability**:

- Chat history loads without errors 100% of time
- Message sending has <0.1% failure rate
- No race conditions in normal usage

✅ **User Experience**:

- Chat switching is instant (<100ms perceived)
- Edit → regenerate flows smoothly
- Clear error messages, not crashes

✅ **Code Quality**:

- All critical flows have tests
- Code passes `npm run validate`
- No circular dependencies
- Follows AGENTS.md architecture rules

✅ **Performance**:

- Chat list loads in <500ms
- Message send feels instant (optimistic UI)
- No UI jank/freezing

---

## Timeline

- **Phase 1 (Backend)**: 2 days
- **Phase 2 (State Management)**: 3 days
- **Phase 3 (Edit Flow)**: 2 days
- **Phase 4 (Pagination)**: 1 day
- **Phase 5 (Testing)**: 2 days

**Total**: 10 days

---

## Next Steps

1. ✅ Get stakeholder/user approval for this plan
2. Create feature branch: `refactor/chat-reliability`
3. Implement Phase 1 (backend transactions)
4. Implement Phase 2 (state management)
5. Incremental testing at each phase
6. Code review before merging each phase

---

**Questions? Concerns? Let's discuss before proceeding with implementation.**
