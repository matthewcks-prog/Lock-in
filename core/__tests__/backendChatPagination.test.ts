// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

const require = createRequire(import.meta.url);
type ChatRow = {
  id: string;
  last_message_at: string | null;
};

type GetRecentChats = (
  userId: string,
  options?: { limit?: number; cursor?: string | null },
) => Promise<{ chats: ChatRow[]; pagination: { hasMore: boolean; nextCursor: string | null } }>;

let supabase: { from: ReturnType<typeof vi.fn> };
let getRecentChats: GetRecentChats;

function resetModule(modulePath: string) {
  delete require.cache[require.resolve(modulePath)];
}

function createChain(data: ChatRow[]) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

describe('chatRepository pagination', () => {
  beforeEach(() => {
    resetModule('../../backend/chatRepository.js');
    resetModule('../../backend/chatRepository');
    resetModule('../../backend/supabaseClient.js');
    resetModule('../../backend/supabaseClient');
    ({ supabase } = require('../../backend/supabaseClient.js'));
    supabase.from = vi.fn();
    ({ getRecentChats } = require('../../backend/chatRepository.js'));
  });

  it('returns nextCursor when more chats exist', async () => {
    const chain = createChain([
      { id: 'chat-1', last_message_at: '2026-01-03T00:00:00.000Z' },
      { id: 'chat-2', last_message_at: '2026-01-02T00:00:00.000Z' },
      { id: 'chat-3', last_message_at: '2026-01-01T00:00:00.000Z' },
    ]);
    supabase.from.mockReturnValue(chain);

    const result = await getRecentChats('user-1', { limit: 2 });

    expect(result.chats).toHaveLength(2);
    expect(result.pagination.hasMore).toBe(true);
    expect(result.pagination.nextCursor).toBe('2026-01-02T00:00:00.000Z');
  });

  it('uses cursor filtering for older chats without overlap', async () => {
    const firstPage = createChain([
      { id: 'chat-1', last_message_at: '2026-01-03T00:00:00.000Z' },
      { id: 'chat-2', last_message_at: '2026-01-02T00:00:00.000Z' },
      { id: 'chat-3', last_message_at: '2026-01-01T00:00:00.000Z' },
    ]);
    const secondPage = createChain([
      { id: 'chat-4', last_message_at: '2025-12-31T00:00:00.000Z' },
      { id: 'chat-5', last_message_at: '2025-12-30T00:00:00.000Z' },
    ]);

    supabase.from.mockReturnValueOnce(firstPage).mockReturnValueOnce(secondPage);

    const firstResult = await getRecentChats('user-1', { limit: 2 });
    const secondResult = await getRecentChats('user-1', {
      limit: 2,
      cursor: firstResult.pagination.nextCursor,
    });

    const firstIds = firstResult.chats.map((chat) => chat.id);
    const secondIds = secondResult.chats.map((chat) => chat.id);

    expect(firstIds).not.toEqual(expect.arrayContaining(secondIds));
    expect(secondPage.or).toHaveBeenCalledWith(
      `last_message_at.lt.${firstResult.pagination.nextCursor},last_message_at.is.null`,
    );
  });
});
