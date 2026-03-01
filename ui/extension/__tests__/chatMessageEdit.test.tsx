/**
 * Tests for useMessageEdit hook — edit state management, API integration, auto-regenerate.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { useMessageEdit } from '../chat/hooks/useMessageEdit';
import type { ApiClient } from '@api/client';

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function createMockApiClient(overrides: Partial<ApiClient> = {}): Partial<ApiClient> {
  return {
    editMessage: vi.fn().mockResolvedValue({
      revision: {
        id: 'rev-1',
        role: 'user',
        content: 'Edited',
        createdAt: new Date().toISOString(),
      },
      canonicalMessages: [
        { id: 'rev-1', role: 'user', content: 'Edited', created_at: new Date().toISOString() },
      ],
      truncatedCount: 1,
    }),
    ...overrides,
  };
}

describe('useMessageEdit', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it('starts with no message being edited', () => {
    const { result } = renderHook(
      () =>
        useMessageEdit({
          apiClient: createMockApiClient() as ApiClient,
          chatId: 'chat-1',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    expect(result.current.editingMessageId).toBeNull();
    expect(result.current.editDraft).toBe('');
    expect(result.current.isSubmittingEdit).toBe(false);
  });

  it('startEdit sets editingMessageId and draft', () => {
    const { result } = renderHook(
      () =>
        useMessageEdit({
          apiClient: createMockApiClient() as ApiClient,
          chatId: 'chat-1',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    act(() => {
      result.current.startEdit('msg-1', 'Original content');
    });

    expect(result.current.editingMessageId).toBe('msg-1');
    expect(result.current.editDraft).toBe('Original content');
  });

  it('cancelEdit clears edit state', () => {
    const { result } = renderHook(
      () =>
        useMessageEdit({
          apiClient: createMockApiClient() as ApiClient,
          chatId: 'chat-1',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    act(() => {
      result.current.startEdit('msg-1', 'Content');
    });
    act(() => {
      result.current.cancelEdit();
    });

    expect(result.current.editingMessageId).toBeNull();
    expect(result.current.editDraft).toBe('');
  });

  it('cancelEdit does not call API', () => {
    const apiClient = createMockApiClient();
    const { result } = renderHook(
      () =>
        useMessageEdit({
          apiClient: apiClient as ApiClient,
          chatId: 'chat-1',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    act(() => {
      result.current.startEdit('msg-1', 'Content');
    });
    act(() => {
      result.current.cancelEdit();
    });

    expect(apiClient.editMessage).not.toHaveBeenCalled();
  });

  it('startEdit cancels any active stream', () => {
    const cancelStream = vi.fn();
    const { result } = renderHook(
      () =>
        useMessageEdit({
          apiClient: createMockApiClient() as ApiClient,
          chatId: 'chat-1',
          cancelStream,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    act(() => {
      result.current.startEdit('msg-1', 'Content');
    });

    expect(cancelStream).toHaveBeenCalledOnce();
  });

  it('submitEdit calls editMessage with correct args', async () => {
    const apiClient = createMockApiClient();
    const { result } = renderHook(
      () =>
        useMessageEdit({
          apiClient: apiClient as ApiClient,
          chatId: 'chat-1',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    act(() => {
      result.current.startEdit('msg-1', 'Original');
    });
    act(() => {
      result.current.setEditDraft('Updated text');
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.submitEdit();
    });

    expect(success).toBe(true);
    expect(apiClient.editMessage).toHaveBeenCalledWith('chat-1', 'msg-1', 'Updated text');
  });

  it('submitEdit clears edit state on success', async () => {
    const { result } = renderHook(
      () =>
        useMessageEdit({
          apiClient: createMockApiClient() as ApiClient,
          chatId: 'chat-1',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    act(() => {
      result.current.startEdit('msg-1', 'Original');
    });

    await act(async () => {
      await result.current.submitEdit();
    });

    expect(result.current.editingMessageId).toBeNull();
    expect(result.current.editDraft).toBe('');
  });

  it('submitEdit calls onEditComplete callback with edited content', async () => {
    const onEditComplete = vi.fn();
    const { result } = renderHook(
      () =>
        useMessageEdit({
          apiClient: createMockApiClient() as ApiClient,
          chatId: 'chat-1',
          onEditComplete,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    act(() => {
      result.current.startEdit('msg-1', 'Original');
    });
    act(() => {
      result.current.setEditDraft('Edited content');
    });

    await act(async () => {
      await result.current.submitEdit();
    });

    expect(onEditComplete).toHaveBeenCalledOnce();
    expect(onEditComplete).toHaveBeenCalledWith(
      'Edited content',
      expect.arrayContaining([expect.objectContaining({ content: 'Edited' })]),
    );
  });

  it('submitEdit returns false when draft is empty', async () => {
    const apiClient = createMockApiClient();
    const { result } = renderHook(
      () =>
        useMessageEdit({
          apiClient: apiClient as ApiClient,
          chatId: 'chat-1',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    act(() => {
      result.current.startEdit('msg-1', 'Original');
    });
    act(() => {
      result.current.setEditDraft('   ');
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.submitEdit();
    });

    expect(success).toBe(false);
    expect(apiClient.editMessage).not.toHaveBeenCalled();
  });

  it('submitEdit returns false when apiClient is null', async () => {
    const { result } = renderHook(
      () =>
        useMessageEdit({
          apiClient: null,
          chatId: 'chat-1',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    act(() => {
      result.current.startEdit('msg-1', 'Original');
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.submitEdit();
    });

    expect(success).toBe(false);
  });

  it('submitEdit handles API error gracefully', async () => {
    const apiClient = createMockApiClient({
      editMessage: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { result } = renderHook(
      () =>
        useMessageEdit({
          apiClient: apiClient as ApiClient,
          chatId: 'chat-1',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    act(() => {
      result.current.startEdit('msg-1', 'Original');
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.submitEdit();
    });

    expect(success).toBe(false);
    // Edit state should remain so user can retry
    expect(result.current.isSubmittingEdit).toBe(false);
    consoleError.mockRestore();
  });
});
