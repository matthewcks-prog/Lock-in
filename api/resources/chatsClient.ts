import type { ApiRequest } from "../fetcher";

export function createChatsClient(apiRequest: ApiRequest) {
  async function getRecentChats(params: { limit?: number } = {}): Promise<any[]> {
    const { limit = 10 } = params;
    const queryParams = new URLSearchParams();
    if (limit) {
      queryParams.set("limit", String(limit));
    }

    const endpoint = `/api/chats${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    return apiRequest<any[]>(endpoint, {
      method: "GET",
    });
  }

  async function getChatMessages(chatId: string): Promise<any[]> {
    if (!chatId) {
      throw new Error("Chat ID is required");
    }

    return apiRequest<any[]>(`/api/chats/${chatId}/messages`, {
      method: "GET",
    });
  }

  async function deleteChat(chatId: string): Promise<void> {
    if (!chatId) {
      throw new Error("Chat ID is required");
    }

    return apiRequest<void>(`/api/chats/${chatId}`, {
      method: "DELETE",
    });
  }

  return {
    getRecentChats,
    getChatMessages,
    deleteChat,
  };
}
