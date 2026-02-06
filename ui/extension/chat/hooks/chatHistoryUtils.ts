import type { ChatHistoryItem } from '../types';
import { coerceChatTitle, FALLBACK_CHAT_TITLE } from '../types';

export type ChatHistoryPage = {
  chats: ChatHistoryItem[];
  pagination: {
    hasMore: boolean;
    nextCursor?: string | null;
  };
};

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function normalizeHistory(response: unknown): ChatHistoryItem[] {
  if (!Array.isArray(response)) return [];

  return response.map((item) => {
    const record = isRecord(item) ? item : {};
    return {
      id: getString(record['id']) || `chat-${Math.random().toString(16).slice(2)}`,
      title: coerceChatTitle(getString(record['title']), FALLBACK_CHAT_TITLE),
      updatedAt:
        getString(record['updated_at']) ||
        getString(record['updatedAt']) ||
        new Date().toISOString(),
      lastMessage: getString(record['lastMessage']) || '',
    };
  });
}

export function normalizeHistoryPage(response: unknown): ChatHistoryPage {
  if (Array.isArray(response)) {
    return {
      chats: normalizeHistory(response),
      pagination: { hasMore: false, nextCursor: null },
    };
  }

  const record = isRecord(response) ? response : {};
  const pagination = isRecord(record['pagination']) ? record['pagination'] : {};
  return {
    chats: normalizeHistory(record['chats']),
    pagination: {
      hasMore: Boolean(pagination?.['hasMore']),
      nextCursor: typeof pagination?.['nextCursor'] === 'string' ? pagination['nextCursor'] : null,
    },
  };
}

export function buildPages(
  items: ChatHistoryItem[],
  pageSize: number,
  existingPages: ChatHistoryPage[] = [],
): ChatHistoryPage[] {
  const pageCount = Math.max(existingPages.length, 1);
  const pages: ChatHistoryPage[] = [];

  for (let index = 0; index < pageCount; index += 1) {
    const start = index * pageSize;
    const chats = items.slice(start, start + pageSize);
    const existingPagination = existingPages[index]?.pagination || {
      hasMore: false,
      nextCursor: null,
    };
    pages.push({ chats, pagination: existingPagination });
  }

  return pages;
}
