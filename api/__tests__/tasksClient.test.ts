import { describe, expect, it, vi } from 'vitest';
import { createTasksClient, type TaskOrderItem } from '../resources/tasksClient';

type ApiRequestMock = ReturnType<typeof vi.fn>;

function createClient(apiRequest: ApiRequestMock): ReturnType<typeof createTasksClient> {
  return createTasksClient(apiRequest as unknown as Parameters<typeof createTasksClient>[0]);
}

describe('tasksClient', () => {
  it('clamps list limit and encodes includeCompleted filter', async () => {
    const apiRequest = vi.fn().mockResolvedValue([]);
    const client = createClient(apiRequest);

    await client.listTasks({ includeCompleted: false, limit: 9999 });

    const call = apiRequest.mock.calls[0];
    expect(call?.[0]).toBe('/api/tasks?includeCompleted=false&limit=500');
    expect(call?.[1]).toMatchObject({ method: 'GET' });
  });

  it('defaults list limit when invalid value is provided', async () => {
    const apiRequest = vi.fn().mockResolvedValue([]);
    const client = createClient(apiRequest);

    await client.listTasks({ limit: Number.NaN });

    expect(apiRequest).toHaveBeenCalledWith('/api/tasks?limit=100', { method: 'GET' });
  });

  it('rejects reorder payloads with invalid task order items', async () => {
    const apiRequest = vi.fn().mockResolvedValue(undefined);
    const client = createClient(apiRequest);

    const invalidOrders = [{ taskId: '', sortOrder: 0 }] as TaskOrderItem[];

    await expect(client.reorderTasks(invalidOrders)).rejects.toThrow(
      'Each task order must include taskId and numeric sortOrder',
    );
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
