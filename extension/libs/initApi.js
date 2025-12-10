"use strict";
var LockInInit = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // extension/libs/initApi.ts
  var initApi_exports = {};
  __export(initApi_exports, {
    getConfig: () => getConfig,
    initApiClient: () => initApiClient,
    initAuthClient: () => initAuthClient,
    initClients: () => initClients
  });

  // api/auth.ts
  function createAuthError(message, code = "AUTH_ERROR", details) {
    const error = new Error(message || "Authentication failed");
    error.code = code;
    if (details) {
      error.details = details;
    }
    return error;
  }
  async function parseErrorResponse(response, fallbackMessage) {
    let payload = null;
    try {
      payload = await response.json();
    } catch (_) {
      try {
        const text = await response.text();
        if (text) {
          payload = { message: text };
        }
      } catch (_2) {
      }
    }
    const message = (payload == null ? void 0 : payload.error_description) || (payload == null ? void 0 : payload.error) || (payload == null ? void 0 : payload.message) || fallbackMessage;
    const normalized = (message || "").toLowerCase();
    let code = "AUTH_ERROR";
    if (normalized.includes("already registered")) {
      code = "USER_ALREADY_REGISTERED";
    } else if (normalized.includes("invalid login")) {
      code = "INVALID_LOGIN";
    } else if (normalized.includes("email not confirmed")) {
      code = "EMAIL_NOT_CONFIRMED";
    } else if (normalized.includes("invalid email")) {
      code = "INVALID_EMAIL";
    }
    return { message, code, details: payload };
  }
  function normalizeSession(data, fallbackUser = null) {
    if (!(data == null ? void 0 : data.access_token) || !(data == null ? void 0 : data.refresh_token)) {
      throw new Error("Supabase session payload missing tokens");
    }
    const expiresIn = Number(data.expires_in) || 3600;
    const expiresAt = Date.now() + expiresIn * 1e3;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      tokenType: data.token_type || "bearer",
      user: data.user || fallbackUser || null
    };
  }
  function createAuthClient(config, storage) {
    const {
      supabaseUrl,
      supabaseAnonKey,
      sessionStorageKey = "lockinSupabaseSession",
      tokenExpiryBufferMs = 6e4
    } = config;
    const listeners = /* @__PURE__ */ new Set();
    function assertConfig() {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Supabase URL or anon key is not configured");
      }
    }
    async function readStorage() {
      try {
        const data = await storage.get(sessionStorageKey);
        return data[sessionStorageKey] || null;
      } catch (error) {
        console.error("Lock-in auth storage read error:", error);
        return null;
      }
    }
    async function writeStorage(session) {
      try {
        await storage.set({ [sessionStorageKey]: session });
      } catch (error) {
        console.error("Lock-in auth storage write error:", error);
      }
    }
    async function clearStorage() {
      try {
        await storage.remove(sessionStorageKey);
      } catch (error) {
        console.error("Lock-in auth storage clear error:", error);
      }
    }
    function notify(session) {
      listeners.forEach((cb) => {
        try {
          cb(session);
        } catch (error) {
          console.error("Lock-in auth listener error:", error);
        }
      });
    }
    async function signInWithEmail(email, password) {
      assertConfig();
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        const parsed = await parseErrorResponse(response, "Failed to sign in");
        throw createAuthError(parsed.message, parsed.code, parsed.details);
      }
      const data = await response.json();
      const session = normalizeSession(data);
      await writeStorage(session);
      notify(session);
      return session;
    }
    async function signUpWithEmail(email, password) {
      assertConfig();
      const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        const parsed = await parseErrorResponse(response, "Failed to create account");
        throw createAuthError(parsed.message, parsed.code, parsed.details);
      }
      const data = await response.json();
      if (!(data == null ? void 0 : data.access_token) || !(data == null ? void 0 : data.refresh_token)) {
        throw createAuthError(
          "Check your email to confirm your account, then sign in.",
          "EMAIL_CONFIRMATION_REQUIRED",
          data
        );
      }
      const session = normalizeSession(data);
      await writeStorage(session);
      notify(session);
      return session;
    }
    async function refreshSession(refreshToken, existingUser = null) {
      assertConfig();
      if (!refreshToken) {
        throw new Error("Missing refresh token");
      }
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      if (!response.ok) {
        await clearStorage();
        let errorMessage = "Failed to refresh session";
        try {
          const errorBody = await response.json();
          errorMessage = (errorBody == null ? void 0 : errorBody.error_description) || (errorBody == null ? void 0 : errorBody.message) || errorMessage;
        } catch (_) {
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      const session = normalizeSession(
        { ...data, refresh_token: data.refresh_token || refreshToken },
        existingUser
      );
      await writeStorage(session);
      notify(session);
      return session;
    }
    async function getSession() {
      return readStorage();
    }
    async function getValidAccessToken() {
      const session = await readStorage();
      if (!session) {
        return null;
      }
      const expiresAt = Number(session.expiresAt) || 0;
      const buffer = tokenExpiryBufferMs;
      if (expiresAt - buffer > Date.now()) {
        return session.accessToken;
      }
      try {
        const refreshed = await refreshSession(session.refreshToken, session.user);
        return refreshed.accessToken;
      } catch (error) {
        console.error("Lock-in token refresh failed:", error.message);
        return null;
      }
    }
    async function getCurrentUser() {
      const session = await getSession();
      return (session == null ? void 0 : session.user) || null;
    }
    async function signOut() {
      await clearStorage();
      notify(null);
    }
    function onSessionChanged(callback) {
      if (typeof callback !== "function") {
        return () => {
        };
      }
      listeners.add(callback);
      return () => listeners.delete(callback);
    }
    storage.onChanged((changes, areaName) => {
      if (areaName === "sync" && changes[sessionStorageKey]) {
        notify(changes[sessionStorageKey].newValue || null);
      }
    });
    return {
      signUpWithEmail,
      signInWithEmail,
      signOut,
      getSession,
      getCurrentUser,
      getValidAccessToken,
      getAccessToken: getValidAccessToken,
      onSessionChanged
    };
  }

  // api/client.ts
  async function createApiError(response, originalError = null) {
    var _a;
    let errorMessage = "API request failed";
    let errorCode = "API_ERROR";
    try {
      const errorBody = await response.json();
      errorMessage = ((_a = errorBody == null ? void 0 : errorBody.error) == null ? void 0 : _a.message) || (errorBody == null ? void 0 : errorBody.message) || (typeof (errorBody == null ? void 0 : errorBody.error) === "string" ? errorBody.error : null) || errorMessage;
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
      try {
        const text = await response.text();
        if (text) {
          errorMessage = text;
        }
      } catch (_2) {
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
  function createApiClient(config) {
    const { backendUrl, authClient } = config;
    const clientConfig = { backendUrl };
    async function apiRequest(endpoint, options = {}) {
      var _a, _b, _c, _d, _e;
      const url = endpoint.startsWith("http") ? endpoint : `${backendUrl}${endpoint}`;
      if ((_a = options.signal) == null ? void 0 : _a.aborted) {
        const error = new Error("Request was aborted");
        error.code = "ABORTED";
        throw error;
      }
      const accessToken = await authClient.getValidAccessToken();
      if (!accessToken) {
        const error = new Error("Please sign in via the Lock-in popup before using the assistant.");
        error.code = "AUTH_REQUIRED";
        throw error;
      }
      if ((_b = options.signal) == null ? void 0 : _b.aborted) {
        const error = new Error("Request was aborted");
        error.code = "ABORTED";
        throw error;
      }
      const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        ...isFormData ? {} : { "Content-Type": "application/json" },
        ...options.headers || {}
      };
      const requestOptions = {
        ...options,
        headers,
        signal: options.signal
      };
      let response;
      try {
        response = await fetch(url, requestOptions);
      } catch (networkError) {
        if (networkError.name === "AbortError" || ((_c = options.signal) == null ? void 0 : _c.aborted)) {
          const error2 = new Error("Request was aborted");
          error2.code = "ABORTED";
          throw error2;
        }
        const error = new Error("Unable to reach Lock-in. Please check your connection.");
        error.code = "NETWORK_ERROR";
        error.cause = networkError;
        throw error;
      }
      if (response.status === 401 || response.status === 403) {
        await authClient.signOut().catch(() => {
        });
      }
      if (!response.ok) {
        throw await createApiError(response);
      }
      try {
        const data = await response.json();
        if (data && data.success === false) {
          const error = new Error(((_d = data.error) == null ? void 0 : _d.message) || "Request failed");
          error.code = ((_e = data.error) == null ? void 0 : _e.code) || "API_ERROR";
          throw error;
        }
        return data;
      } catch (parseError) {
        if (parseError instanceof Error && parseError.code) {
          throw parseError;
        }
        const error = new Error("Failed to parse API response");
        error.code = "PARSE_ERROR";
        error.cause = parseError;
        throw error;
      }
    }
    async function processText(params) {
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
        language = "en"
      } = params;
      const normalizedHistory = (Array.isArray(chatHistory) ? chatHistory : []).filter(
        (message) => message && typeof message.role === "string" && typeof message.content === "string"
      ).map((message) => ({
        role: message.role,
        content: message.content
      }));
      const body = {
        selection: selection || "",
        mode,
        targetLanguage,
        difficultyLevel,
        chatHistory: normalizedHistory
      };
      if (newUserMessage) body.newUserMessage = newUserMessage;
      if (chatId) body.chatId = chatId;
      if (pageContext) body.pageContext = pageContext;
      if (pageUrl) body.pageUrl = pageUrl;
      if (courseCode) body.courseCode = courseCode;
      if (language) body.language = language;
      return apiRequest("/api/lockin", {
        method: "POST",
        body: JSON.stringify(body)
      });
    }
    async function getRecentChats(params = {}) {
      const { limit = 10 } = params;
      const queryParams = new URLSearchParams();
      if (limit) {
        queryParams.set("limit", String(limit));
      }
      const endpoint = `/api/chats${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      return apiRequest(endpoint, {
        method: "GET"
      });
    }
    async function getChatMessages(chatId) {
      if (!chatId) {
        throw new Error("Chat ID is required");
      }
      return apiRequest(`/api/chats/${chatId}/messages`, {
        method: "GET"
      });
    }
    async function deleteChat(chatId) {
      if (!chatId) {
        throw new Error("Chat ID is required");
      }
      return apiRequest(`/api/chats/${chatId}`, {
        method: "DELETE"
      });
    }
    async function createNote(note, options) {
      return apiRequest("/api/notes", {
        method: "POST",
        body: JSON.stringify(note),
        signal: options == null ? void 0 : options.signal
      });
    }
    async function updateNote(noteId, note, options) {
      if (!noteId) {
        throw new Error("noteId is required to update a note");
      }
      return apiRequest(
        `/api/notes/${noteId}`,
        {
          method: "PUT",
          body: JSON.stringify(note),
          signal: options == null ? void 0 : options.signal
        }
      );
    }
    async function deleteNote(noteId) {
      if (!noteId) {
        throw new Error("noteId is required to delete a note");
      }
      return apiRequest(`/api/notes/${noteId}`, {
        method: "DELETE"
      });
    }
    async function listNotes(params = {}) {
      const { sourceUrl, courseCode, limit = 50 } = params;
      const queryParams = new URLSearchParams();
      if (sourceUrl) queryParams.set("sourceUrl", sourceUrl);
      if (courseCode) queryParams.set("courseCode", courseCode);
      if (limit) queryParams.set("limit", String(limit));
      const endpoint = `/api/notes${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      return apiRequest(endpoint, {
        method: "GET"
      });
    }
    async function searchNotes(params) {
      const { query, courseCode, k = 10 } = params;
      const queryParams = new URLSearchParams({ q: query, k: String(k) });
      if (courseCode) queryParams.set("courseCode", courseCode);
      return apiRequest(`/api/notes/search?${queryParams.toString()}`, {
        method: "GET"
      });
    }
    async function chatWithNotes(params) {
      return apiRequest("/api/notes/chat", {
        method: "POST",
        body: JSON.stringify({ query: params.query, courseCode: params.courseCode, k: params.k })
      });
    }
    async function uploadNoteAsset(params) {
      const { noteId, file } = params;
      if (!noteId) {
        throw new Error("noteId is required to upload an asset");
      }
      if (!file) {
        throw new Error("file is required to upload an asset");
      }
      const formData = new FormData();
      formData.append("file", file);
      return apiRequest(`/api/notes/${noteId}/assets`, {
        method: "POST",
        body: formData
        // Let the browser set Content-Type with boundary
      });
    }
    async function listNoteAssets(params) {
      const { noteId } = params;
      if (!noteId) {
        throw new Error("noteId is required to list assets");
      }
      return apiRequest(`/api/notes/${noteId}/assets`, {
        method: "GET"
      });
    }
    async function deleteNoteAsset(params) {
      const { assetId } = params;
      if (!assetId) {
        throw new Error("assetId is required to delete an asset");
      }
      return apiRequest(`/api/note-assets/${assetId}`, {
        method: "DELETE"
      });
    }
    function getBackendUrl() {
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
      deleteNoteAsset
    };
  }

  // extension/libs/chromeStorage.ts
  var ChromeStorage = class {
    async get(key) {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.sync.get(key, (data) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve(data);
          });
        } catch (error) {
          reject(error);
        }
      });
    }
    async set(data) {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.sync.set(data, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve();
          });
        } catch (error) {
          reject(error);
        }
      });
    }
    async remove(keys) {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.sync.remove(keys, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve();
          });
        } catch (error) {
          reject(error);
        }
      });
    }
    onChanged(callback) {
      const listener = (changes, areaName) => {
        const normalizedChanges = {};
        for (const [key, change] of Object.entries(changes)) {
          normalizedChanges[key] = {
            oldValue: change.oldValue,
            newValue: change.newValue
          };
        }
        callback(normalizedChanges, areaName);
      };
      chrome.storage.onChanged.addListener(listener);
      return () => {
        chrome.storage.onChanged.removeListener(listener);
      };
    }
  };
  var ChromeLocalStorage = class {
    async get(key) {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.local.get(key, (data) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve(data);
          });
        } catch (error) {
          reject(error);
        }
      });
    }
    async set(data) {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.local.set(data, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve();
          });
        } catch (error) {
          reject(error);
        }
      });
    }
    async remove(keys) {
      return new Promise((resolve, reject) => {
        try {
          chrome.storage.local.remove(keys, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve();
          });
        } catch (error) {
          reject(error);
        }
      });
    }
  };
  var chromeStorage = new ChromeStorage();
  var chromeLocalStorage = new ChromeLocalStorage();

  // extension/libs/initApi.ts
  function getConfig() {
    const config = typeof window !== "undefined" && window.LOCKIN_CONFIG || {};
    return {
      backendUrl: config.BACKEND_URL || "http://localhost:3000",
      supabaseUrl: config.SUPABASE_URL || "",
      supabaseAnonKey: config.SUPABASE_ANON_KEY || "",
      sessionStorageKey: config.SESSION_STORAGE_KEY || "lockinSupabaseSession",
      tokenExpiryBufferMs: Number(config.TOKEN_EXPIRY_BUFFER_MS) || 6e4
    };
  }
  function initAuthClient() {
    const config = getConfig();
    return createAuthClient(
      {
        supabaseUrl: config.supabaseUrl,
        supabaseAnonKey: config.supabaseAnonKey,
        sessionStorageKey: config.sessionStorageKey,
        tokenExpiryBufferMs: config.tokenExpiryBufferMs
      },
      chromeStorage
    );
  }
  function initApiClient(authClient) {
    const config = getConfig();
    return createApiClient({
      backendUrl: config.backendUrl,
      authClient
    });
  }
  var cachedClients = null;
  function initClients() {
    if (cachedClients) {
      return cachedClients;
    }
    const authClient = initAuthClient();
    const apiClient = initApiClient(authClient);
    cachedClients = { authClient, apiClient };
    if (typeof window !== "undefined") {
      window.LockInAuth = authClient;
      window.LockInAPI = apiClient;
    }
    return cachedClients;
  }
  if (typeof window !== "undefined") {
    initClients();
    window.LockInInit = {
      getConfig,
      initAuthClient,
      initApiClient,
      initClients
    };
  }
  return __toCommonJS(initApi_exports);
})();
//# sourceMappingURL=initApi.js.map
