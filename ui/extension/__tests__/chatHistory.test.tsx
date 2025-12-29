import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ApiClient } from "@api/client";
import { LockInSidebar } from "../LockInSidebar";

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

const ACTIVE_CHAT_ID_KEY = "lockin_sidebar_activeChatId";
const SIDEBAR_ACTIVE_TAB_KEY = "lockin_sidebar_activeTab";
const SELECTED_NOTE_ID_KEY = "lockin_sidebar_selectedNoteId";

function createStorageStub(values: Record<string, unknown> = {}): StorageStub {
  return {
    get: vi.fn((key: string) =>
      Promise.resolve(
        Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null
      )
    ),
    set: vi.fn(() => Promise.resolve()),
    getLocal: vi.fn(() => Promise.resolve(null)),
    setLocal: vi.fn(() => Promise.resolve()),
  };
}

function createApiClientStub(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    processText: vi.fn(),
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
    ...overrides,
  } as ApiClient;
}

async function flushPromises(cycles = 1) {
  for (let i = 0; i < cycles; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("LockInSidebar chat history", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("loads chat history entries from the API", async () => {
    const apiClient = createApiClientStub({
      getRecentChats: vi.fn().mockResolvedValue([
        {
          id: "chat-1",
          title: "Arrays and stacks overview",
          updated_at: "2025-01-01T00:00:00.000Z",
        },
      ]),
    });
    const storage = createStorageStub({
      [SIDEBAR_ACTIVE_TAB_KEY]: null,
      [SELECTED_NOTE_ID_KEY]: null,
      [ACTIVE_CHAT_ID_KEY]: null,
    });

    await act(async () => {
      root.render(
        <LockInSidebar
          apiClient={apiClient}
          isOpen={true}
          onToggle={vi.fn()}
          currentMode="explain"
          storage={storage}
        />
      );
    });
    await act(async () => {
      await flushPromises(2);
    });

    expect(apiClient.getRecentChats).toHaveBeenCalledWith({ limit: 8 });
    const title = document.querySelector(".lockin-history-title");
    expect(title?.textContent).toBe("Arrays and stacks overview");
  });

  it("loads messages when a history item is selected", async () => {
    const apiClient = createApiClientStub({
      getRecentChats: vi.fn().mockResolvedValue([
        {
          id: "chat-2",
          title: "Graph theory basics",
          updated_at: "2025-01-02T00:00:00.000Z",
        },
      ]),
      getChatMessages: vi.fn().mockResolvedValue([
        {
          id: "msg-1",
          role: "user",
          input_text: "What is a graph?",
          output_text: null,
          created_at: "2025-01-02T00:00:01.000Z",
        },
        {
          id: "msg-2",
          role: "assistant",
          input_text: null,
          output_text: "A graph models nodes and edges.",
          created_at: "2025-01-02T00:00:02.000Z",
        },
      ]),
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
        />
      );
    });
    await act(async () => {
      await flushPromises(2);
    });

    const historyButton = document.querySelector(
      ".lockin-history-item"
    ) as HTMLButtonElement | null;
    expect(historyButton).not.toBeNull();

    await act(async () => {
      historyButton?.click();
    });
    await act(async () => {
      await flushPromises(2);
    });

    expect(apiClient.getChatMessages).toHaveBeenCalledWith("chat-2");
    const bubbles = Array.from(
      document.querySelectorAll(".lockin-chat-bubble")
    ).map((node) => node.textContent);
    expect(bubbles).toContain("What is a graph?");
    expect(bubbles).toContain("A graph models nodes and edges.");
    expect(historyButton?.classList.contains("active")).toBe(true);
  });

  it("restores the last active chat from storage", async () => {
    const storedChatId = "11111111-1111-1111-8111-111111111111";
    const apiClient = createApiClientStub({
      getRecentChats: vi.fn().mockResolvedValue([]),
      getChatMessages: vi.fn().mockResolvedValue([
        {
          id: "msg-3",
          role: "assistant",
          input_text: null,
          output_text: "Restored message content.",
          created_at: "2025-01-03T00:00:00.000Z",
        },
      ]),
    });
    const storage = createStorageStub({
      [ACTIVE_CHAT_ID_KEY]: storedChatId,
    });

    await act(async () => {
      root.render(
        <LockInSidebar
          apiClient={apiClient}
          isOpen={true}
          onToggle={vi.fn()}
          currentMode="explain"
          storage={storage}
        />
      );
    });
    await act(async () => {
      await flushPromises(3);
    });

    expect(apiClient.getChatMessages).toHaveBeenCalledWith(storedChatId);
    const bubble = document.querySelector(".lockin-chat-bubble");
    expect(bubble?.textContent).toBe("Restored message content.");
  });
});
