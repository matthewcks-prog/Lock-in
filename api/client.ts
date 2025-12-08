/**
 * API Client for Lock-in
 * 
 * Chrome-agnostic API client for backend communication.
 * Uses auth client interface - no direct Chrome dependencies.
 */

import type { StudyResponse, ApiResponse, ChatMessage } from "../core/domain/types";
import type { AuthClient } from "./auth";

export interface ApiClientConfig {
  backendUrl: string;
  authClient: AuthClient;
}

export interface ProcessTextParams {
  selection: string;
  mode: "explain" | "simplify" | "translate" | "general";
  targetLanguage?: string;
  difficultyLevel?: "highschool" | "university";
  chatHistory?: ChatMessage[];
  newUserMessage?: string;
  chatId?: string;
  pageContext?: string;
  pageUrl?: string;
  courseCode?: string;
  language?: string;
}

export interface ListNotesParams {
  sourceUrl?: string;
  courseCode?: string;
  limit?: number;
}

export interface SearchNotesParams {
  query: string;
  courseCode?: string;
  k?: number;
}

export interface ChatWithNotesParams {
  query: string;
  courseCode?: string;
  k?: number;
}

/**
 * Create API error from response
 */
async function createApiError(response: Response, originalError: Error | null = null): Promise<Error> {
  let errorMessage = "API request failed";
  let errorCode = "API_ERROR";

  try {
    const errorBody = await response.json();
    errorMessage =
      errorBody?.error?.message ||
      errorBody?.message ||
      (typeof errorBody?.error === "string" ? errorBody.error : null) ||
      errorMessage;

    // Map status codes to error codes
    if (response.status === 401 || response.status === 403) {
      errorCode = "AUTH_REQUIRED";
    } else if (response.status === 429) {
      errorCode = "RATE_LIMIT";
    } else if (response.status === 400) {
      errorCode = "BAD_REQUEST";
    } else if (response.status >= 500) {
      errorCode = "SERVER_ERROR";
    }
  } catch (_) {
    // If JSON parsing fails, try text
    try {
      const text = await response.text();
      if (text) {
        errorMessage = text;
      }
    } catch (_) {
      // Ignore
    }
  }

  const error = new Error(errorMessage);
  (error as any).code = errorCode;
  (error as any).status = response.status;
  if (originalError) {
    (error as any).cause = originalError;
  }
  return error;
}

/**
 * Create API client
 */
export function createApiClient(config: ApiClientConfig) {
  const { backendUrl, authClient } = config;

  /**
   * Make an authenticated API request
   */
  async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith("http") ? endpoint : `${backendUrl}${endpoint}`;

    // Get access token
    const accessToken = await authClient.getValidAccessToken();
    if (!accessToken) {
      const error = new Error("Please sign in via the Lock-in popup before using the assistant.");
      (error as any).code = "AUTH_REQUIRED";
      throw error;
    }

    // Prepare headers
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    };

    // Prepare request
    const requestOptions: RequestInit = {
      ...options,
      headers,
    };

    // Make request
    let response: Response;
    try {
      response = await fetch(url, requestOptions);
    } catch (networkError) {
      const error = new Error("Unable to reach Lock-in. Please check your connection.");
      (error as any).code = "NETWORK_ERROR";
      (error as any).cause = networkError;
      throw error;
    }

    // Handle auth errors
    if (response.status === 401 || response.status === 403) {
      // Try to sign out if auth fails
      await authClient.signOut().catch(() => {
        // Ignore sign-out errors
      });
    }

    // Handle HTTP errors
    if (!response.ok) {
      throw await createApiError(response);
    }

    // Parse and return response
    try {
      const data = await response.json();
      // Check for success: false in response body (even if HTTP status is 200)
      if (data && data.success === false) {
        const error = new Error(data.error?.message || "Request failed");
        (error as any).code = data.error?.code || "API_ERROR";
        throw error;
      }
      return data;
    } catch (parseError) {
      // If it's already an Error we threw, re-throw it
      if (parseError instanceof Error && (parseError as any).code) {
        throw parseError;
      }
      const error = new Error("Failed to parse API response");
      (error as any).code = "PARSE_ERROR";
      (error as any).cause = parseError;
      throw error;
    }
  }

  /**
   * Process text with Lock-in AI
   */
  async function processText(params: ProcessTextParams): Promise<ApiResponse<StudyResponse>> {
    const {
      selection,
      mode,
      targetLanguage = "en",
      difficultyLevel = "highschool",
      chatHistory = [],
      newUserMessage,
      chatId,
      pageContext,
      pageUrl,
      courseCode,
      language = "en",
    } = params;

    // Normalize chat history
    const normalizedHistory = (Array.isArray(chatHistory) ? chatHistory : [])
      .filter(
        (message) =>
          message &&
          typeof message.role === "string" &&
          typeof message.content === "string"
      )
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    const body: any = {
      selection: selection || "",
      mode,
      targetLanguage,
      difficultyLevel,
      chatHistory: normalizedHistory,
    };

    if (newUserMessage) body.newUserMessage = newUserMessage;
    if (chatId) body.chatId = chatId;
    if (pageContext) body.pageContext = pageContext;
    if (pageUrl) body.pageUrl = pageUrl;
    if (courseCode) body.courseCode = courseCode;
    if (language) body.language = language;

    return apiRequest<ApiResponse<StudyResponse>>("/api/lockin", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /**
   * Get recent chats
   */
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

  /**
   * Get messages for a chat
   */
  async function getChatMessages(chatId: string): Promise<any[]> {
    if (!chatId) {
      throw new Error("Chat ID is required");
    }

    return apiRequest<any[]>(`/api/chats/${chatId}/messages`, {
      method: "GET",
    });
  }

  /**
   * Delete a chat
   */
  async function deleteChat(chatId: string): Promise<void> {
    if (!chatId) {
      throw new Error("Chat ID is required");
    }

    return apiRequest<void>(`/api/chats/${chatId}`, {
      method: "DELETE",
    });
  }

  /**
   * Create a new note
   */
  async function createNote(note: {
    title: string;
    content: string;
    sourceSelection?: string;
    sourceUrl?: string;
    courseCode?: string | null;
    noteType?: string;
    tags?: string[];
  }): Promise<any> {
    return apiRequest<any>("/api/notes", {
      method: "POST",
      body: JSON.stringify(note),
    });
  }

  /**
   * Update an existing note
   */
  async function updateNote(
    noteId: string,
    note: {
      title?: string;
      content?: string;
      sourceSelection?: string;
      sourceUrl?: string;
      courseCode?: string | null;
      noteType?: string;
      tags?: string[];
    }
  ): Promise<any> {
    if (!noteId) {
      throw new Error("noteId is required to update a note");
    }
    return apiRequest<any>(`/api/notes/${noteId}`, {
      method: "PUT",
      body: JSON.stringify(note),
    });
  }

  /**
   * Delete a note
   */
  async function deleteNote(noteId: string): Promise<void> {
    if (!noteId) {
      throw new Error("noteId is required to delete a note");
    }
    return apiRequest<void>(`/api/notes/${noteId}`, {
      method: "DELETE",
    });
  }

  /**
   * List notes with optional filters
   */
  async function listNotes(params: ListNotesParams = {}): Promise<any[]> {
    const { sourceUrl, courseCode, limit = 50 } = params;
    const queryParams = new URLSearchParams();
    if (sourceUrl) queryParams.set("sourceUrl", sourceUrl);
    if (courseCode) queryParams.set("courseCode", courseCode);
    if (limit) queryParams.set("limit", String(limit));

    const endpoint = `/api/notes${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    return apiRequest<any[]>(endpoint, {
      method: "GET",
    });
  }

  /**
   * Search notes by semantic similarity
   */
  async function searchNotes(params: SearchNotesParams): Promise<any[]> {
    const { query, courseCode, k = 10 } = params;
    const queryParams = new URLSearchParams({ q: query, k: String(k) });
    if (courseCode) queryParams.set("courseCode", courseCode);

    return apiRequest<any[]>(`/api/notes/search?${queryParams.toString()}`, {
      method: "GET",
    });
  }

  /**
   * Chat with notes using semantic search
   */
  async function chatWithNotes(params: ChatWithNotesParams): Promise<{ answer: string; usedNotes: any[] }> {
    return apiRequest<{ answer: string; usedNotes: any[] }>("/api/notes/chat", {
      method: "POST",
      body: JSON.stringify({ query: params.query, courseCode: params.courseCode, k: params.k }),
    });
  }

  return {
    processText,
    getRecentChats,
    getChatMessages,
    deleteChat,
    createNote,
    updateNote,
    deleteNote,
    listNotes,
    searchNotes,
    chatWithNotes,
  };
}

/**
 * Type for the API client returned by createApiClient
 */
export type ApiClient = ReturnType<typeof createApiClient>;
