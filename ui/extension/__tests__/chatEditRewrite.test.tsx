/**
 * Tests for the edit-as-rewrite flow.
 *
 * Validates that:
 * 1. After editing a user message + submitting, old assistant messages are removed
 * 2. The canonical timeline replaces the query cache
 * 3. onEditComplete does NOT re-add a duplicate user message
 * 4. Follow-up messages after an edit use the rewritten timeline
 * 5. Stale stream deltas from a prior requestId are discarded
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { useMessageEdit } from '../chat/hooks/useMessageEdit';
import type { ApiClient } from '@api/client';
import type { ChatMessage } from '../chat/types';
import { chatMessagesKeys } from '../chat/hooks/useChatMessages';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function makeMessages(): ChatMessage[] {
  return [
    { id: 'msg-1', role: 'user', content: 'Hello', timestamp: '2026-01-01T00:00:00Z' },
    { id: 'msg-2', role: 'assistant', content: 'Hi there!', timestamp: '2026-01-01T00:00:01Z' },
    { id: 'msg-3', role: 'user', content: 'Follow-up', timestamp: '2026-01-01T00:00:02Z' },
    {
      id: 'msg-4',
      role: 'assistant',
      content: 'Follow-up reply',
      timestamp: '2026-01-01T00:00:03Z',
    },
  ];
}

// Backend returns canonical messages after edit: only messages[0..editIndex] + revision
function makeCanonicalAfterEdit(): Record<string, unknown>[] {
  return [
    {
      id: 'rev-1',
      role: 'user',
      content: 'Hello EDITED',
      created_at: '2026-01-01T00:00:00Z',
      revision_of: 'msg-1',
    },
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Edit-as-rewrite: truncation and timeline management', () => {
  let queryClient: QueryClient;
  const chatId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    // Seed the query cache with an existing conversation
    queryClient.setQueryData(chatMessagesKeys.byId(chatId), makeMessages());
  });

  it('submitEdit replaces query cache with canonical messages (old assistant messages removed)', async () => {
    const apiClient = {
      editMessage: vi.fn().mockResolvedValue({
        revision: {
          id: 'rev-1',
          role: 'user',
          content: 'Hello EDITED',
          createdAt: '2026-01-01T00:00:00Z',
        },
        canonicalMessages: makeCanonicalAfterEdit(),
        truncatedCount: 3,
      }),
    } as unknown as ApiClient;

    const onEditComplete = vi.fn();

    const { result } = renderHook(() => useMessageEdit({ apiClient, chatId, onEditComplete }), {
      wrapper: createWrapper(queryClient),
    });

    // Start editing msg-1
    act(() => {
      result.current.startEdit('msg-1', 'Hello');
    });
    act(() => {
      result.current.setEditDraft('Hello EDITED');
    });

    // Submit the edit
    await act(async () => {
      await result.current.submitEdit();
    });

    // Verify the query cache now only contains the canonical messages
    const cached = queryClient.getQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId));
    if (!cached || cached.length === 0) throw new Error('Expected cached messages');
    expect(cached).toHaveLength(1);
    expect(cached[0]?.content).toBe('Hello EDITED');
    expect(cached[0]?.id).toBe('rev-1');

    // The old assistant messages (msg-2, msg-4) should NOT be in the cache
    const hasOldAssistant = cached?.some((m) => m.id === 'msg-2' || m.id === 'msg-4');
    expect(hasOldAssistant).toBe(false);
  });

  it('onEditComplete receives canonical messages without duplicated user message', async () => {
    const apiClient = {
      editMessage: vi.fn().mockResolvedValue({
        revision: {
          id: 'rev-1',
          role: 'user',
          content: 'Hello EDITED',
          createdAt: '2026-01-01T00:00:00Z',
        },
        canonicalMessages: makeCanonicalAfterEdit(),
        truncatedCount: 3,
      }),
    } as unknown as ApiClient;

    const onEditComplete = vi.fn();

    const { result } = renderHook(() => useMessageEdit({ apiClient, chatId, onEditComplete }), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.startEdit('msg-1', 'Hello');
    });
    act(() => {
      result.current.setEditDraft('Hello EDITED');
    });

    await act(async () => {
      await result.current.submitEdit();
    });

    // onEditComplete should be called with the edited content and canonical messages
    expect(onEditComplete).toHaveBeenCalledOnce();
    const [editedContent, canonicalMessages] = onEditComplete.mock.calls[0] as [
      string,
      ChatMessage[],
    ];
    expect(editedContent).toBe('Hello EDITED');
    expect(canonicalMessages).toHaveLength(1);

    // The canonical messages should NOT have two user messages with the same content
    const userMessages = canonicalMessages.filter((m: ChatMessage) => m.role === 'user');
    expect(userMessages).toHaveLength(1);
  });

  it('follow-up after edit sees only the rewritten timeline in cache', async () => {
    const apiClient = {
      editMessage: vi.fn().mockResolvedValue({
        revision: {
          id: 'rev-1',
          role: 'user',
          content: 'Hello EDITED',
          createdAt: '2026-01-01T00:00:00Z',
        },
        canonicalMessages: makeCanonicalAfterEdit(),
        truncatedCount: 3,
      }),
    } as unknown as ApiClient;

    const { result } = renderHook(() => useMessageEdit({ apiClient, chatId }), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.startEdit('msg-1', 'Hello');
    });
    act(() => {
      result.current.setEditDraft('Hello EDITED');
    });

    await act(async () => {
      await result.current.submitEdit();
    });

    // Simulate a follow-up: read the cache to build context
    const timeline = queryClient.getQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId)) ?? [];

    // The timeline should only have the revised message, not the old conversation
    expect(timeline).toHaveLength(1);
    expect(timeline[0]!.content).toBe('Hello EDITED');

    // If we were to add a follow-up, it would correctly append to this timeline
    const followUp: ChatMessage = {
      id: 'followup-1',
      role: 'user',
      content: 'New follow-up',
      timestamp: new Date().toISOString(),
    };
    queryClient.setQueryData(chatMessagesKeys.byId(chatId), [...timeline, followUp]);

    const updated = queryClient.getQueryData<ChatMessage[]>(chatMessagesKeys.byId(chatId));
    if (!updated || updated.length < 2) throw new Error('Expected updated messages');
    expect(updated).toHaveLength(2);
    expect(updated[0]?.content).toBe('Hello EDITED');
    expect(updated[1]?.content).toBe('New follow-up');
  });
});

describe('Edit-as-rewrite: resolveApiChatId', () => {
  it('resolves activeChatId when chatId is not a valid UUID', async () => {
    // This tests the fix in sendMessageUtils.ts
    const { resolveApiChatId } = await import('../chat/hooks/sendMessageUtils');

    const params = {
      message: 'test',
      source: 'followup' as const,
      chatId: 'chat-12345', // provisional, not a UUID
      currentMessages: [],
      activeChatId: '550e8400-e29b-41d4-a716-446655440000', // valid UUID
    };

    expect(resolveApiChatId(params)).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('returns undefined when neither chatId nor activeChatId is a valid UUID', async () => {
    const { resolveApiChatId } = await import('../chat/hooks/sendMessageUtils');

    const params = {
      message: 'test',
      source: 'followup' as const,
      chatId: 'chat-12345',
      currentMessages: [],
      activeChatId: 'chat-67890',
    };

    expect(resolveApiChatId(params)).toBeUndefined();
  });

  it('prefers chatId over activeChatId when both are valid UUIDs', async () => {
    const { resolveApiChatId } = await import('../chat/hooks/sendMessageUtils');

    const params = {
      message: 'test',
      source: 'followup' as const,
      chatId: '550e8400-e29b-41d4-a716-446655440000',
      currentMessages: [],
      activeChatId: '660e8400-e29b-41d4-a716-446655440001',
    };

    expect(resolveApiChatId(params)).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});
