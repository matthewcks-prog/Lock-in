import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { createApiClientStub, createStorageStub, renderWithProviders } from '@shared/test';
import { LockInSidebar } from '../LockInSidebar';

function renderSidebar(): ReturnType<typeof renderWithProviders> & {
  storage: ReturnType<typeof createStorageStub>;
} {
  const apiClient = createApiClientStub({
    getRecentChats: vi.fn().mockResolvedValue({
      chats: [],
      pagination: {
        hasMore: false,
        nextCursor: null,
      },
    }),
  });
  const storage = createStorageStub();
  const renderResult = renderWithProviders(
    <LockInSidebar apiClient={apiClient} isOpen={true} onToggle={vi.fn()} storage={storage} />,
  );
  return { ...renderResult, storage };
}

describe('Study workspace visibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not render Study workspace controls while Chat is active', async () => {
    const { storage } = renderSidebar();
    await waitFor(() => expect(storage.get).toHaveBeenCalled());
    await screen.findByRole('tab', { name: 'Chat' });
    expect(screen.getByRole('tab', { name: 'Chat' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: /study tools/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/open a study tool to continue/i)).not.toBeInTheDocument();
  });

  it('renders only on Study tab and unmounts when leaving Study', async () => {
    const { user, storage } = renderSidebar();
    await waitFor(() => expect(storage.get).toHaveBeenCalled());
    await screen.findByRole('tab', { name: 'Study' });

    await user.click(screen.getByRole('tab', { name: 'Study' }));
    expect(await screen.findByRole('button', { name: /study tools/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /scan videos/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Chat' }));
    expect(screen.queryByRole('button', { name: /study tools/i })).not.toBeInTheDocument();
  });
});
