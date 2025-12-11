/**
 * API Client for Lock-in
 * 
 * Chrome-agnostic API client for backend communication.
 * Uses auth client interface - no direct Chrome dependencies.
 * 
 * Scalability features:
 * - Exponential backoff retry for transient failures
 * - Request deduplication via AbortController
 * - Optimistic locking support via updatedAt
 */

import type { StudyResponse, ApiResponse, ChatMessage, NoteAsset } from "../core/domain/types";
import type { AuthClient } from "./auth";

export interface ApiClientConfig {
  backendUrl: string;
  authClient: AuthClient;
}

/**
 * Retry configuration for transient failures
 * Industry best practice: exponential backoff with jitter
 */
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  // 429 = rate limit, 502/503/504 = server overload/temporary issues
  retryableStatuses: [429, 502, 503, 504],
};

/**
 * Calculate delay with exponential backoff and jitter
 * Jitter prevents thundering herd problem with thousands of users
 */
function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
  // Add 0-30% jitter to prevent synchronized retries
  const jitter = cappedDelay * (Math.random() * 0.3);
  return Math.floor(cappedDelay + jitter);
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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

export interface UploadNoteAssetParams {
  noteId: string;
  file: File | Blob;
}

export interface ListNoteAssetsParams {
  noteId: string;
}

export interface DeleteNoteAssetParams {
  assetId: string;
}

/**
 * Options for API requests
 */
export interface ApiRequestOptions extends RequestInit {
  signal?: AbortSignal;
  /** Set to false to disable retries for this request */
  retry?: boolean;
  /** Custom retry config */
  retryConfig?: Partial<RetryConfig>;
  /** updatedAt for optimistic locking (conflict detection) */
  ifUnmodifiedSince?: string;
}

/**
 * Conflict error thrown when optimistic locking fails
 */
export class ConflictError extends Error {
  code = "CONFLICT";
  status = 409;
  serverVersion?: string;
  
  constructor(message: string, serverVersion?: string) {
    super(message);
    this.name = "ConflictError";
    this.serverVersion = serverVersion;
  }
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
  const clientConfig = { backendUrl };

  /**
   * Make an authenticated API request with automatic retry for transient failures.
   * 
   * Scalability features:
   * - Exponential backoff with jitter for retries (prevents thundering herd)
   * - Automatic retry for 429, 502, 503, 504 status codes
   * - Support for optimistic locking via If-Unmodified-Since header
   * - AbortController support for request cancellation
   */
  async function apiRequest<T = any>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<T> {
    const {
      retry = true,
      retryConfig: customRetryConfig,
      ifUnmodifiedSince,
      ...fetchOptions
    } = options;
    
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...customRetryConfig };
    const url = endpoint.startsWith("http") ? endpoint : `${backendUrl}${endpoint}`;

    // Check if request was aborted before starting
    if (fetchOptions.signal?.aborted) {
      const error = new Error("Request was aborted");
      (error as any).code = "ABORTED";
      throw error;
    }

    // Get access token
    const accessToken = await authClient.getValidAccessToken();
    if (!accessToken) {
      const error = new Error("Please sign in via the Lock-in popup before using the assistant.");
      (error as any).code = "AUTH_REQUIRED";
      throw error;
    }

    // Check again after async operation
    if (fetchOptions.signal?.aborted) {
      const error = new Error("Request was aborted");
      (error as any).code = "ABORTED";
      throw error;
    }

    // Prepare headers
    const isFormData = typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;
    const headers: HeadersInit = {
      Authorization: `Bearer ${accessToken}`,
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(ifUnmodifiedSince ? { "If-Unmodified-Since": ifUnmodifiedSince } : {}),
      ...(fetchOptions.headers || {}),
    };

    // Prepare request (include signal for cancellation)
    const requestOptions: RequestInit = {
      ...fetchOptions,
      headers,
      signal: fetchOptions.signal,
    };

    // Retry loop with exponential backoff
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= (retry ? retryConfig.maxRetries : 0); attempt++) {
      // Check abort before each attempt
      if (fetchOptions.signal?.aborted) {
        const error = new Error("Request was aborted");
        (error as any).code = "ABORTED";
        throw error;
      }

      // Wait before retry (skip for first attempt)
      if (attempt > 0) {
        const delay = calculateRetryDelay(attempt - 1, retryConfig);
        console.log(`[API] Retry attempt ${attempt}/${retryConfig.maxRetries} after ${delay}ms`);
        await sleep(delay);
        
        // Check abort after sleep
        if (fetchOptions.signal?.aborted) {
          const error = new Error("Request was aborted");
          (error as any).code = "ABORTED";
          throw error;
        }
      }

      // Make request
      let response: Response;
      try {
        response = await fetch(url, requestOptions);
      } catch (networkError: any) {
        // Check if error is due to abort
        if (networkError.name === "AbortError" || fetchOptions.signal?.aborted) {
          const error = new Error("Request was aborted");
          (error as any).code = "ABORTED";
          throw error;
        }
        
        // Network errors are retryable
        lastError = new Error("Unable to reach Lock-in. Please check your connection.");
        (lastError as any).code = "NETWORK_ERROR";
        (lastError as any).cause = networkError;
        
        if (retry && attempt < retryConfig.maxRetries) {
          continue; // Retry on network error
        }
        throw lastError;
      }

      // Handle 409 Conflict for optimistic locking
      if (response.status === 409) {
        let serverVersion: string | undefined;
        try {
          const body = await response.json();
          serverVersion = body?.updatedAt || body?.updated_at;
        } catch {}
        throw new ConflictError(
          "Note was modified by another session. Please refresh and try again.",
          serverVersion
        );
      }

      // Check if response status is retryable
      if (retry && retryConfig.retryableStatuses.includes(response.status) && attempt < retryConfig.maxRetries) {
        lastError = await createApiError(response);
        continue; // Retry on retryable status
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

    // If we've exhausted all retries
    throw lastError || new Error("Request failed after retries");
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

  type NotePayload = {
    title?: string;
    content?: string;
    content_text?: string | null;
    content_json?: unknown;
    contentJson?: unknown;
    editor_version?: string;
    sourceSelection?: string | null;
    source_selection?: string | null;
    sourceUrl?: string | null;
    source_url?: string | null;
    courseCode?: string | null;
    course_code?: string | null;
    noteType?: string | null;
    note_type?: string | null;
    tags?: string[];
  };

  /**
   * Create a new note
   */
  async function createNote(
    note: NotePayload & { title: string },
    options?: { signal?: AbortSignal }
  ): Promise<any> {
    return apiRequest<any>("/api/notes", {
      method: "POST",
      body: JSON.stringify(note),
      signal: options?.signal,
    });
  }

  /**
   * Update an existing note
   */
  async function updateNote(
    noteId: string,
    note: NotePayload,
    options?: { signal?: AbortSignal }
  ): Promise<any> {
    if (!noteId) {
      throw new Error("noteId is required to update a note");
    }
    return apiRequest<any>(
      `/api/notes/${noteId}`,
      {
        method: "PUT",
        body: JSON.stringify(note),
        signal: options?.signal,
      }
    );
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

  /**
   * Map backend note asset response (snake_case) to frontend NoteAsset (camelCase)
   */
  function mapNoteAsset(raw: any): NoteAsset {
    return {
      id: raw.id,
      noteId: raw.note_id,
      userId: raw.user_id,
      type: raw.type,
      mimeType: raw.mime_type,
      storagePath: raw.storage_path,
      createdAt: raw.created_at,
      url: raw.url,
      fileName: raw.file_name || raw.filename || raw.name || null,
    };
  }

  /**
   * Upload an asset for a note
   */
  async function uploadNoteAsset(params: UploadNoteAssetParams): Promise<NoteAsset> {
    const { noteId, file } = params;
    if (!noteId) {
      throw new Error("noteId is required to upload an asset");
    }
    if (!file) {
      throw new Error("file is required to upload an asset");
    }

    const formData = new FormData();
    formData.append("file", file);

    const raw = await apiRequest<any>(`/api/notes/${noteId}/assets`, {
      method: "POST",
      body: formData,
      // Let the browser set Content-Type with boundary
    });

    return mapNoteAsset(raw);
  }

  /**
   * List assets for a note
   */
  async function listNoteAssets(params: ListNoteAssetsParams): Promise<NoteAsset[]> {
    const { noteId } = params;
    if (!noteId) {
      throw new Error("noteId is required to list assets");
    }

    const raw = await apiRequest<any[]>(`/api/notes/${noteId}/assets`, {
      method: "GET",
    });

    return raw.map(mapNoteAsset);
  }

  /**
   * Delete a note asset
   */
  async function deleteNoteAsset(params: DeleteNoteAssetParams): Promise<void> {
    const { assetId } = params;
    if (!assetId) {
      throw new Error("assetId is required to delete an asset");
    }

    return apiRequest<void>(`/api/note-assets/${assetId}`, {
      method: "DELETE",
    });
  }

  /**
   * Get backend URL used by this client
   */
  function getBackendUrl(): string {
    return clientConfig.backendUrl;
  }

  return {
    apiRequest,
    getBackendUrl,
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
    uploadNoteAsset,
    listNoteAssets,
    deleteNoteAsset,
  };
}

/**
 * Type for the API client returned by createApiClient
 */
export type ApiClient = ReturnType<typeof createApiClient>;
