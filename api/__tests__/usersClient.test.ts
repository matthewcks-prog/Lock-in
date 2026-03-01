import { describe, expect, it, vi } from 'vitest';
import { createUsersClient } from '../resources/usersClient';

describe('usersClient', () => {
  it('deletes the authenticated account via /api/users/me', async () => {
    const apiRequest = vi.fn().mockResolvedValue(undefined);
    const client = createUsersClient(
      apiRequest as unknown as Parameters<typeof createUsersClient>[0],
    );

    await client.deleteMyAccount();

    expect(apiRequest).toHaveBeenCalledWith('/api/users/me', { method: 'DELETE' });
  });
});
