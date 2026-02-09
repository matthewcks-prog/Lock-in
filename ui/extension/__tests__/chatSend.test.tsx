import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { RateLimitError } from '@core/errors';
import { createApiClientStub, createStorageStub, renderWithProviders } from '@shared/test';
import { LockInSidebar } from '../LockInSidebar';

describe('LockInSidebar chat send reliability', () => {
  it('deduplicates rapid send actions', async () => {
    const processText = vi.fn().mockResolvedValue({
      data: { content: 'Reply' },
      chatId: '11111111-1111-4111-8111-111111111111',
      chatTitle: 'Title',
    });
    const apiClient = createApiClientStub({
      processText,
      getRecentChats: vi.fn().mockResolvedValue({
        chats: [],
        pagination: { hasMore: false, nextCursor: null },
      }),
    });
    const storage = createStorageStub();

    const { user } = renderWithProviders(
      <LockInSidebar apiClient={apiClient} isOpen={true} onToggle={vi.fn()} storage={storage} />,
    );

    const sendButton = await screen.findByRole('button', { name: /^send$/i });
    expect(sendButton).toBeDisabled();

    await user.click(sendButton);

    expect(processText).not.toHaveBeenCalled();
  });

  it('shows rate limit feedback when requests are throttled', async () => {
    const apiClient = createApiClientStub({
      processText: vi.fn().mockRejectedValue(new RateLimitError('Rate limit', 3000)),
      getRecentChats: vi.fn().mockResolvedValue({
        chats: [],
        pagination: { hasMore: false, nextCursor: null },
      }),
    });
    const storage = createStorageStub();

    const { user } = renderWithProviders(
      <LockInSidebar apiClient={apiClient} isOpen={true} onToggle={vi.fn()} storage={storage} />,
    );

    const input = await screen.findByRole('textbox', { name: /chat message/i });
    await user.type(input, 'Hello');

    const sendButton = screen.getByRole('button', { name: /^send$/i });
    await user.click(sendButton);

    expect(
      await screen.findByText(/you're sending too fast - try again in 3s\./i),
    ).toBeInTheDocument();
  });

  it('does not show save note button on error messages', async () => {
    const apiClient = createApiClientStub({
      processText: vi.fn().mockRejectedValue(new Error('Please sign in to continue')),
      getRecentChats: vi.fn().mockResolvedValue({
        chats: [],
        pagination: { hasMore: false, nextCursor: null },
      }),
    });
    const storage = createStorageStub();

    const { user } = renderWithProviders(
      <LockInSidebar apiClient={apiClient} isOpen={true} onToggle={vi.fn()} storage={storage} />,
    );

    const input = await screen.findByRole('textbox', { name: /chat message/i });
    await user.type(input, 'Hello');

    const sendButton = screen.getByRole('button', { name: /^send$/i });
    await user.click(sendButton);

    await screen.findByText(/please sign in to continue/i);
    expect(screen.queryByRole('button', { name: /save note/i })).toBeNull();
  });
});
