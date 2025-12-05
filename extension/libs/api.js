/**
 * API Client for Lock-in Extension
 * 
 * Provides a clean interface for backend API communication
 * with authentication, error handling, and request/response transformation.
 */

/**
 * Get the backend URL from config
 * @returns {string}
 */
function getBackendUrl() {
  const config = window.LOCKIN_CONFIG || {};
  return config.BACKEND_URL || "http://localhost:3000";
}

/**
 * Get valid access token from auth system
 * @returns {Promise<string|null>}
 */
async function getAccessToken() {
  if (!window.LockInAuth || typeof window.LockInAuth.getValidAccessToken !== "function") {
    return null;
  }
  
  try {
    return await window.LockInAuth.getValidAccessToken();
  } catch (error) {
    console.error("Lock-in API: Failed to get access token:", error);
    return null;
  }
}

/**
 * Create API error from response
 * @param {Response} response - Fetch response
 * @param {Error} [originalError] - Original error if any
 * @returns {Error}
 */
async function createApiError(response, originalError = null) {
  let errorMessage = "API request failed";
  let errorCode = "API_ERROR";
  
  try {
    const errorBody = await response.json();
    errorMessage = errorBody?.message || errorBody?.error || errorMessage;
    
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
  error.code = errorCode;
  error.status = response.status;
  if (originalError) {
    error.cause = originalError;
  }
  return error;
}

/**
 * Make an authenticated API request
 * @param {string} endpoint - API endpoint (e.g., "/api/lockin")
 * @param {Object} [options] - Fetch options
 * @returns {Promise<*>}
 */
async function apiRequest(endpoint, options = {}) {
  const backendUrl = getBackendUrl();
  const url = endpoint.startsWith("http") ? endpoint : `${backendUrl}${endpoint}`;
  
  // Get access token
  const accessToken = await getAccessToken();
  if (!accessToken) {
    const error = new Error("Please sign in via the Lock-in popup before using the assistant.");
    error.code = "AUTH_REQUIRED";
    throw error;
  }
  
  // Prepare headers
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    ...(options.headers || {}),
  };
  
  // Prepare request
  const requestOptions = {
    ...options,
    headers,
  };
  
  // Make request
  let response;
  try {
    response = await fetch(url, requestOptions);
  } catch (networkError) {
    const error = new Error("Unable to reach Lock-in. Please check your connection.");
    error.code = "NETWORK_ERROR";
    error.cause = networkError;
    throw error;
  }
  
  // Handle auth errors
  if (response.status === 401 || response.status === 403) {
    // Try to sign out if auth fails
    if (window.LockInAuth && typeof window.LockInAuth.signOut === "function") {
      await window.LockInAuth.signOut().catch(() => {
        // Ignore sign-out errors
      });
    }
  }
  
  // Handle errors
  if (!response.ok) {
    throw await createApiError(response);
  }
  
  // Parse and return response
  try {
    return await response.json();
  } catch (parseError) {
    const error = new Error("Failed to parse API response");
    error.code = "PARSE_ERROR";
    error.cause = parseError;
    throw error;
  }
}

/**
 * Process text with Lock-in AI
 * @param {Object} params - Request parameters
 * @param {string} params.selection - Selected text
 * @param {string} params.mode - Mode: "explain" | "simplify" | "translate"
 * @param {string} [params.targetLanguage] - Target language code
 * @param {string} [params.difficultyLevel] - Difficulty level
 * @param {Array} [params.chatHistory] - Previous chat messages
 * @param {string} [params.newUserMessage] - New user message
 * @param {string} [params.chatId] - Existing chat ID
 * @returns {Promise<Object>}
 */
async function processText(params) {
  const {
    selection,
    mode,
    targetLanguage = "en",
    difficultyLevel = "highschool",
    chatHistory = [],
    newUserMessage,
    chatId,
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
  
  const body = {
    selection: selection || "",
    mode,
    targetLanguage,
    difficultyLevel,
    chatHistory: normalizedHistory,
  };
  
  if (newUserMessage) {
    body.newUserMessage = newUserMessage;
  }
  
  if (chatId) {
    body.chatId = chatId;
  }
  
  return apiRequest("/api/lockin", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Get recent chats
 * @param {Object} [params] - Query parameters
 * @param {number} [params.limit] - Number of chats to return
 * @returns {Promise<Array>}
 */
async function getRecentChats(params = {}) {
  const { limit = 10 } = params;
  const queryParams = new URLSearchParams();
  if (limit) {
    queryParams.set("limit", String(limit));
  }
  
  const endpoint = `/api/chats${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  return apiRequest(endpoint, {
    method: "GET",
  });
}

/**
 * Get messages for a chat
 * @param {string} chatId - Chat ID
 * @returns {Promise<Array>}
 */
async function getChatMessages(chatId) {
  if (!chatId) {
    throw new Error("Chat ID is required");
  }
  
  return apiRequest(`/api/chats/${chatId}/messages`, {
    method: "GET",
  });
}

/**
 * Delete a chat
 * @param {string} chatId - Chat ID
 * @returns {Promise<void>}
 */
async function deleteChat(chatId) {
  if (!chatId) {
    throw new Error("Chat ID is required");
  }
  
  return apiRequest(`/api/chats/${chatId}`, {
    method: "DELETE",
  });
}

// Export for use in extension
if (typeof window !== "undefined") {
  window.LockInAPI = {
    getBackendUrl,
    getAccessToken,
    apiRequest,
    processText,
    getRecentChats,
    getChatMessages,
    deleteChat,
  };
}

// Export for Node.js/CommonJS if needed
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    getBackendUrl,
    getAccessToken,
    apiRequest,
    processText,
    getRecentChats,
    getChatMessages,
    deleteChat,
  };
}

