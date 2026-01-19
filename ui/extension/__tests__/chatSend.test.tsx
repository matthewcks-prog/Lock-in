import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ApiClient } from '@api/client';
import { RateLimitError } from '@core/errors';
import { LockInSidebar } from '../LockInSidebar';

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

type StorageStub = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
  getLocal: (key: string) => Promise<unknown>;
  setLocal: (key: string, value: unknown) => Promise<void>;
};

function createStorageStub(values: Record<string, unknown> = {}): StorageStub {
  return {
    get: vi.fn((key: string) =>
      Promise.resolve(Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null),
    ),
    set: vi.fn(() => Promise.resolve()),
    getLocal: vi.fn(() => Promise.resolve(null)),
    setLocal: vi.fn(() => Promise.resolve()),
  };
}

function createApiClientStub(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    processText: vi.fn(),
    createChat: vi.fn(),
    getRecentChats: vi.fn(),
    getChatMessages: vi.fn(),
    deleteChat: vi.fn(),
    generateChatTitle: vi.fn(),
    createNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
    toggleNoteStar: vi.fn(),
    setNoteStar: vi.fn(),
    listNotes: vi.fn(),
    searchNotes: vi.fn(),
    chatWithNotes: vi.fn(),
    uploadNoteAsset: vi.fn(),
    listNoteAssets: vi.fn(),
    deleteNoteAsset: vi.fn(),
    uploadChatAsset: vi.fn(),
    listChatAssets: vi.fn(),
    deleteChatAsset: vi.fn(),
    submitFeedback: vi.fn(),
    listFeedback: vi.fn(),
    getFeedback: vi.fn(),
    ...overrides,
  } as ApiClient;
}

async function flushPromises(cycles = 1) {
  for (let i = 0; i < cycles; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function setTextareaValue(element: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('LockInSidebar chat send reliability', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('deduplicates rapid send actions', async () => {
    const processText = vi.fn().mockResolvedValue({
      data: { explanation: 'Reply' },
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

    await act(async () => {
      root.render(
        <LockInSidebar
          apiClient={apiClient}
          isOpen={true}
          onToggle={vi.fn()}
          currentMode="explain"
          storage={storage}
        />,
      );
    });
    await act(async () => {
      await flushPromises(2);
    });

    const textarea = document.querySelector(
      '.lockin-chat-input-field',
    ) as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();

    await act(async () => {
      if (textarea) {
        setTextareaValue(textarea, 'Hello');
      }
    });
    await act(async () => {
      await flushPromises(2);
    });

    const sendButton = document.querySelector('.lockin-send-btn') as HTMLButtonElement | null;
    expect(sendButton).not.toBeNull();
    expect(sendButton?.disabled).toBe(false);

    await act(async () => {
      sendButton?.click();
      sendButton?.click();
    });
    await act(async () => {
      await flushPromises(3);
    });

    expect(processText).toHaveBeenCalledTimes(1);
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

    await act(async () => {
      root.render(
        <LockInSidebar
          apiClient={apiClient}
          isOpen={true}
          onToggle={vi.fn()}
          currentMode="explain"
          storage={storage}
        />,
      );
    });
    await act(async () => {
      await flushPromises(2);
    });

    const textarea = document.querySelector(
      '.lockin-chat-input-field',
    ) as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();

    await act(async () => {
      if (textarea) {
        setTextareaValue(textarea, 'Hello');
      }
    });
    await act(async () => {
      await flushPromises(2);
    });

    const sendButton = document.querySelector('.lockin-send-btn') as HTMLButtonElement | null;
    expect(sendButton).not.toBeNull();
    expect(sendButton?.disabled).toBe(false);

    await act(async () => {
      sendButton?.click();
    });
    await act(async () => {
      await flushPromises(4);
    });

    const errorBanner = document.querySelector('.lockin-chat-error');
    const bubbleTexts = Array.from(document.querySelectorAll('.lockin-chat-bubble')).map(
      (node) => node.textContent || '',
    );
    const combinedText = [errorBanner?.textContent || '', ...bubbleTexts].join(' ');
    expect(combinedText).toContain("You're sending too fast - try again in 3s.");
  });
});
