import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import chatLimits from '@core/config/chatLimits.json';
import { ACTIVE_CHAT_ID_KEY } from '../chat/types';
import { createApiClientStub, createStorageStub, renderWithProviders } from '@shared/test';
import { LockInSidebar } from '../LockInSidebar';

describe('LockInSidebar chat history', () => {
  it('loads chat history entries from the API', async () => {
    const apiClient = createApiClientStub({
      getRecentChats: vi.fn().mockResolvedValue({
        chats: [
          {
            id: 'chat-1',
            title: 'Arrays and stacks overview',
            updated_at: '2025-01-01T00:00:00.000Z',
          },
        ],
        pagination: {
          hasMore: false,
          nextCursor: null,
        },
      }),
    });
    const storage = createStorageStub();

    renderWithProviders(
      <LockInSidebar apiClient={apiClient} isOpen={true} onToggle={vi.fn()} storage={storage} />,
    );

    await waitFor(() => {
      expect(apiClient.getRecentChats).toHaveBeenCalledWith(
        expect.objectContaining({ limit: chatLimits.DEFAULT_CHAT_LIST_LIMIT }),
      );
    });

    expect(
      await screen.findByRole('button', { name: /arrays and stacks overview/i }),
    ).toBeInTheDocument();
  });

  it('loads more chat history entries on demand', async () => {
    const apiClient = createApiClientStub({
      getRecentChats: vi
        .fn()
        .mockResolvedValueOnce({
          chats: [
            {
              id: 'chat-1',
              title: 'First page chat',
              updated_at: '2025-01-02T00:00:00.000Z',
            },
          ],
          pagination: {
            hasMore: true,
            nextCursor: '2025-01-01T00:00:00.000Z',
          },
        })
        .mockResolvedValueOnce({
          chats: [
            {
              id: 'chat-2',
              title: 'Second page chat',
              updated_at: '2024-12-31T00:00:00.000Z',
            },
          ],
          pagination: {
            hasMore: false,
            nextCursor: null,
          },
        }),
    });
    const storage = createStorageStub();

    const { user } = renderWithProviders(
      <LockInSidebar apiClient={apiClient} isOpen={true} onToggle={vi.fn()} storage={storage} />,
    );

    await screen.findByRole('button', { name: /first page chat/i });

    const loadMoreButton = await screen.findByRole('button', { name: /load more/i });
    await user.click(loadMoreButton);

    await waitFor(() => {
      expect(apiClient.getRecentChats).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ cursor: '2025-01-01T00:00:00.000Z' }),
      );
    });

    expect(await screen.findByRole('button', { name: /second page chat/i })).toBeInTheDocument();
  });

  it('loads messages when a history item is selected', async () => {
    const apiClient = createApiClientStub({
      getRecentChats: vi.fn().mockResolvedValue({
        chats: [
          {
            id: 'chat-2',
            title: 'Graph theory basics',
            updated_at: '2025-01-02T00:00:00.000Z',
          },
        ],
        pagination: {
          hasMore: false,
          nextCursor: null,
        },
      }),
      getChatMessages: vi.fn().mockResolvedValue([
        {
          id: 'msg-1',
          role: 'user',
          input_text: 'What is a graph?',
          output_text: null,
          created_at: '2025-01-02T00:00:01.000Z',
        },
        {
          id: 'msg-2',
          role: 'assistant',
          input_text: null,
          output_text: 'A graph models nodes and edges.',
          created_at: '2025-01-02T00:00:02.000Z',
        },
      ]),
    });
    const storage = createStorageStub();

    const { user } = renderWithProviders(
      <LockInSidebar apiClient={apiClient} isOpen={true} onToggle={vi.fn()} storage={storage} />,
    );

    const historyButton = await screen.findByRole('button', { name: /graph theory basics/i });
    await user.click(historyButton);

    await waitFor(() => {
      expect(apiClient.getChatMessages).toHaveBeenCalledWith('chat-2');
    });

    expect(await screen.findByText(/what is a graph\?/i)).toBeInTheDocument();
    expect(screen.getByText(/a graph models nodes and edges\./i)).toBeInTheDocument();
  });

  it('restores the last active chat from storage', async () => {
    const storedChatId = '11111111-1111-1111-8111-111111111111';
    const apiClient = createApiClientStub({
      getRecentChats: vi.fn().mockResolvedValue({
        chats: [],
        pagination: {
          hasMore: false,
          nextCursor: null,
        },
      }),
      getChatMessages: vi.fn().mockResolvedValue([
        {
          id: 'msg-3',
          role: 'assistant',
          input_text: null,
          output_text: 'Restored message content.',
          created_at: '2025-01-03T00:00:00.000Z',
        },
      ]),
    });
    const storage = createStorageStub({
      [ACTIVE_CHAT_ID_KEY]: storedChatId,
    });

    renderWithProviders(
      <LockInSidebar apiClient={apiClient} isOpen={true} onToggle={vi.fn()} storage={storage} />,
    );

    await waitFor(() => {
      expect(apiClient.getChatMessages).toHaveBeenCalledWith(storedChatId);
    });

    expect(await screen.findByText(/restored message content\./i)).toBeInTheDocument();
  });
});
