var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
(function(exports) {
  "use strict";
  function createAuthError(message, code = "AUTH_ERROR", details) {
    const error = new Error(message || "Authentication failed");
    error.code = code;
    if (details) {
      error.details = details;
    }
    return error;
  }
  function parseErrorResponse(response, fallbackMessage) {
    return __async(this, null, function* () {
      let payload = null;
      try {
        payload = yield response.json();
      } catch (_) {
        try {
          const text = yield response.text();
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
    });
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
    function readStorage() {
      return __async(this, null, function* () {
        try {
          const data = yield storage.get(sessionStorageKey);
          return data[sessionStorageKey] || null;
        } catch (error) {
          console.error("Lock-in auth storage read error:", error);
          return null;
        }
      });
    }
    function writeStorage(session) {
      return __async(this, null, function* () {
        try {
          yield storage.set({ [sessionStorageKey]: session });
        } catch (error) {
          console.error("Lock-in auth storage write error:", error);
        }
      });
    }
    function clearStorage() {
      return __async(this, null, function* () {
        try {
          yield storage.remove(sessionStorageKey);
        } catch (error) {
          console.error("Lock-in auth storage clear error:", error);
        }
      });
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
    function signInWithEmail(email, password) {
      return __async(this, null, function* () {
        assertConfig();
        const response = yield fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: {
            apikey: supabaseAnonKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email, password })
        });
        if (!response.ok) {
          const parsed = yield parseErrorResponse(response, "Failed to sign in");
          throw createAuthError(parsed.message, parsed.code, parsed.details);
        }
        const data = yield response.json();
        const session = normalizeSession(data);
        yield writeStorage(session);
        notify(session);
        return session;
      });
    }
    function signUpWithEmail(email, password) {
      return __async(this, null, function* () {
        assertConfig();
        const response = yield fetch(`${supabaseUrl}/auth/v1/signup`, {
          method: "POST",
          headers: {
            apikey: supabaseAnonKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email, password })
        });
        if (!response.ok) {
          const parsed = yield parseErrorResponse(response, "Failed to create account");
          throw createAuthError(parsed.message, parsed.code, parsed.details);
        }
        const data = yield response.json();
        if (!(data == null ? void 0 : data.access_token) || !(data == null ? void 0 : data.refresh_token)) {
          throw createAuthError(
            "Check your email to confirm your account, then sign in.",
            "EMAIL_CONFIRMATION_REQUIRED",
            data
          );
        }
        const session = normalizeSession(data);
        yield writeStorage(session);
        notify(session);
        return session;
      });
    }
    function refreshSession(refreshToken, existingUser = null) {
      return __async(this, null, function* () {
        assertConfig();
        if (!refreshToken) {
          throw new Error("Missing refresh token");
        }
        const response = yield fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
          method: "POST",
          headers: {
            apikey: supabaseAnonKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ refresh_token: refreshToken })
        });
        if (!response.ok) {
          yield clearStorage();
          let errorMessage = "Failed to refresh session";
          try {
            const errorBody = yield response.json();
            errorMessage = (errorBody == null ? void 0 : errorBody.error_description) || (errorBody == null ? void 0 : errorBody.message) || errorMessage;
          } catch (_) {
          }
          throw new Error(errorMessage);
        }
        const data = yield response.json();
        const session = normalizeSession(
          __spreadProps(__spreadValues({}, data), { refresh_token: data.refresh_token || refreshToken }),
          existingUser
        );
        yield writeStorage(session);
        notify(session);
        return session;
      });
    }
    function getSession() {
      return __async(this, null, function* () {
        return readStorage();
      });
    }
    function getValidAccessToken() {
      return __async(this, null, function* () {
        const session = yield readStorage();
        if (!session) {
          return null;
        }
        const expiresAt = Number(session.expiresAt) || 0;
        const buffer = tokenExpiryBufferMs;
        if (expiresAt - buffer > Date.now()) {
          return session.accessToken;
        }
        try {
          const refreshed = yield refreshSession(session.refreshToken, session.user);
          return refreshed.accessToken;
        } catch (error) {
          console.error("Lock-in token refresh failed:", error.message);
          return null;
        }
      });
    }
    function getCurrentUser() {
      return __async(this, null, function* () {
        const session = yield getSession();
        return (session == null ? void 0 : session.user) || null;
      });
    }
    function signOut() {
      return __async(this, null, function* () {
        yield clearStorage();
        notify(null);
      });
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
  const DEFAULT_RETRY_CONFIG = {
    maxRetries: 3,
    baseDelayMs: 500,
    maxDelayMs: 5e3,
    // 429 = rate limit, 502/503/504 = server overload/temporary issues
    retryableStatuses: [429, 502, 503, 504]
  };
  function calculateRetryDelay(attempt, config) {
    const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt);
    const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);
    const jitter = cappedDelay * (Math.random() * 0.3);
    return Math.floor(cappedDelay + jitter);
  }
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  class ConflictError extends Error {
    constructor(message, serverVersion) {
      super(message);
      __publicField(this, "code", "CONFLICT");
      __publicField(this, "status", 409);
      __publicField(this, "serverVersion");
      this.name = "ConflictError";
      this.serverVersion = serverVersion;
    }
  }
  function createApiError(response, originalError = null) {
    return __async(this, null, function* () {
      var _a;
      let errorMessage = "API request failed";
      let errorCode = "API_ERROR";
      try {
        const errorBody = yield response.json();
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
          const text = yield response.text();
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
    });
  }
  function createApiClient(config) {
    const { backendUrl, authClient } = config;
    const clientConfig = { backendUrl };
    function apiRequest(_0) {
      return __async(this, arguments, function* (endpoint, options = {}) {
        var _b, _c, _d, _e, _f, _g, _h;
        const _a = options, {
          retry = true,
          retryConfig: customRetryConfig,
          ifUnmodifiedSince
        } = _a, fetchOptions = __objRest(_a, [
          "retry",
          "retryConfig",
          "ifUnmodifiedSince"
        ]);
        const retryConfig = __spreadValues(__spreadValues({}, DEFAULT_RETRY_CONFIG), customRetryConfig);
        const url = endpoint.startsWith("http") ? endpoint : `${backendUrl}${endpoint}`;
        if ((_b = fetchOptions.signal) == null ? void 0 : _b.aborted) {
          const error = new Error("Request was aborted");
          error.code = "ABORTED";
          throw error;
        }
        const accessToken = yield authClient.getValidAccessToken();
        if (!accessToken) {
          const error = new Error("Please sign in via the Lock-in popup before using the assistant.");
          error.code = "AUTH_REQUIRED";
          throw error;
        }
        if ((_c = fetchOptions.signal) == null ? void 0 : _c.aborted) {
          const error = new Error("Request was aborted");
          error.code = "ABORTED";
          throw error;
        }
        const isFormData = typeof FormData !== "undefined" && fetchOptions.body instanceof FormData;
        const headers = __spreadValues(__spreadValues(__spreadValues({
          Authorization: `Bearer ${accessToken}`
        }, isFormData ? {} : { "Content-Type": "application/json" }), ifUnmodifiedSince ? { "If-Unmodified-Since": ifUnmodifiedSince } : {}), fetchOptions.headers || {});
        const requestOptions = __spreadProps(__spreadValues({}, fetchOptions), {
          headers,
          signal: fetchOptions.signal
        });
        let lastError = null;
        for (let attempt = 0; attempt <= (retry ? retryConfig.maxRetries : 0); attempt++) {
          if ((_d = fetchOptions.signal) == null ? void 0 : _d.aborted) {
            const error = new Error("Request was aborted");
            error.code = "ABORTED";
            throw error;
          }
          if (attempt > 0) {
            const delay = calculateRetryDelay(attempt - 1, retryConfig);
            console.log(`[API] Retry attempt ${attempt}/${retryConfig.maxRetries} after ${delay}ms`);
            yield sleep(delay);
            if ((_e = fetchOptions.signal) == null ? void 0 : _e.aborted) {
              const error = new Error("Request was aborted");
              error.code = "ABORTED";
              throw error;
            }
          }
          let response;
          try {
            response = yield fetch(url, requestOptions);
          } catch (networkError) {
            if (networkError.name === "AbortError" || ((_f = fetchOptions.signal) == null ? void 0 : _f.aborted)) {
              const error = new Error("Request was aborted");
              error.code = "ABORTED";
              throw error;
            }
            lastError = new Error("Unable to reach Lock-in. Please check your connection.");
            lastError.code = "NETWORK_ERROR";
            lastError.cause = networkError;
            if (retry && attempt < retryConfig.maxRetries) {
              continue;
            }
            throw lastError;
          }
          if (response.status === 409) {
            let serverVersion;
            try {
              const body = yield response.json();
              serverVersion = (body == null ? void 0 : body.updatedAt) || (body == null ? void 0 : body.updated_at);
            } catch (e) {
            }
            throw new ConflictError(
              "Note was modified by another session. Please refresh and try again.",
              serverVersion
            );
          }
          if (retry && retryConfig.retryableStatuses.includes(response.status) && attempt < retryConfig.maxRetries) {
            lastError = yield createApiError(response);
            continue;
          }
          if (response.status === 401 || response.status === 403) {
            yield authClient.signOut().catch(() => {
            });
          }
          if (!response.ok) {
            throw yield createApiError(response);
          }
          if (response.status === 204) {
            return void 0;
          }
          try {
            const contentLength = response.headers.get("content-length");
            const contentType = response.headers.get("content-type");
            if (contentLength === "0" || !(contentType == null ? void 0 : contentType.includes("application/json"))) {
              return void 0;
            }
            const data = yield response.json();
            if (data && data.success === false) {
              const error = new Error(((_g = data.error) == null ? void 0 : _g.message) || "Request failed");
              error.code = ((_h = data.error) == null ? void 0 : _h.code) || "API_ERROR";
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
        throw lastError || new Error("Request failed after retries");
      });
    }
    function processText(params) {
      return __async(this, null, function* () {
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
      });
    }
    function getRecentChats() {
      return __async(this, arguments, function* (params = {}) {
        const { limit = 10 } = params;
        const queryParams = new URLSearchParams();
        if (limit) {
          queryParams.set("limit", String(limit));
        }
        const endpoint = `/api/chats${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
        return apiRequest(endpoint, {
          method: "GET"
        });
      });
    }
    function getChatMessages(chatId) {
      return __async(this, null, function* () {
        if (!chatId) {
          throw new Error("Chat ID is required");
        }
        return apiRequest(`/api/chats/${chatId}/messages`, {
          method: "GET"
        });
      });
    }
    function deleteChat(chatId) {
      return __async(this, null, function* () {
        if (!chatId) {
          throw new Error("Chat ID is required");
        }
        return apiRequest(`/api/chats/${chatId}`, {
          method: "DELETE"
        });
      });
    }
    function createNote(note, options) {
      return __async(this, null, function* () {
        return apiRequest("/api/notes", {
          method: "POST",
          body: JSON.stringify(note),
          signal: options == null ? void 0 : options.signal
        });
      });
    }
    function updateNote(noteId, note, options) {
      return __async(this, null, function* () {
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
      });
    }
    function deleteNote(noteId) {
      return __async(this, null, function* () {
        if (!noteId) {
          throw new Error("noteId is required to delete a note");
        }
        return apiRequest(`/api/notes/${noteId}`, {
          method: "DELETE"
        });
      });
    }
    function toggleNoteStar(noteId) {
      return __async(this, null, function* () {
        if (!noteId) {
          throw new Error("noteId is required to toggle star");
        }
        return apiRequest(`/api/notes/${noteId}/star`, {
          method: "PATCH"
        });
      });
    }
    function setNoteStar(noteId, isStarred) {
      return __async(this, null, function* () {
        if (!noteId) {
          throw new Error("noteId is required to set star");
        }
        return apiRequest(`/api/notes/${noteId}/star`, {
          method: "PUT",
          body: JSON.stringify({ isStarred })
        });
      });
    }
    function listNotes() {
      return __async(this, arguments, function* (params = {}) {
        const { sourceUrl, courseCode, limit = 50 } = params;
        const queryParams = new URLSearchParams();
        if (sourceUrl) queryParams.set("sourceUrl", sourceUrl);
        if (courseCode) queryParams.set("courseCode", courseCode);
        if (limit) queryParams.set("limit", String(limit));
        const endpoint = `/api/notes${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
        return apiRequest(endpoint, {
          method: "GET"
        });
      });
    }
    function searchNotes(params) {
      return __async(this, null, function* () {
        const { query, courseCode, k = 10 } = params;
        const queryParams = new URLSearchParams({ q: query, k: String(k) });
        if (courseCode) queryParams.set("courseCode", courseCode);
        return apiRequest(`/api/notes/search?${queryParams.toString()}`, {
          method: "GET"
        });
      });
    }
    function chatWithNotes(params) {
      return __async(this, null, function* () {
        return apiRequest("/api/notes/chat", {
          method: "POST",
          body: JSON.stringify({ query: params.query, courseCode: params.courseCode, k: params.k })
        });
      });
    }
    function mapNoteAsset(raw) {
      return {
        id: raw.id,
        noteId: raw.note_id,
        userId: raw.user_id,
        type: raw.type,
        mimeType: raw.mime_type,
        storagePath: raw.storage_path,
        createdAt: raw.created_at,
        url: raw.url,
        fileName: raw.file_name || raw.filename || raw.name || null
      };
    }
    function uploadNoteAsset(params) {
      return __async(this, null, function* () {
        const { noteId, file } = params;
        if (!noteId) {
          throw new Error("noteId is required to upload an asset");
        }
        if (!file) {
          throw new Error("file is required to upload an asset");
        }
        const formData = new FormData();
        formData.append("file", file);
        const raw = yield apiRequest(`/api/notes/${noteId}/assets`, {
          method: "POST",
          body: formData
          // Let the browser set Content-Type with boundary
        });
        return mapNoteAsset(raw);
      });
    }
    function listNoteAssets(params) {
      return __async(this, null, function* () {
        const { noteId } = params;
        if (!noteId) {
          throw new Error("noteId is required to list assets");
        }
        const raw = yield apiRequest(`/api/notes/${noteId}/assets`, {
          method: "GET"
        });
        return raw.map(mapNoteAsset);
      });
    }
    function deleteNoteAsset(params) {
      return __async(this, null, function* () {
        const { assetId } = params;
        if (!assetId) {
          throw new Error("assetId is required to delete an asset");
        }
        return apiRequest(`/api/note-assets/${assetId}`, {
          method: "DELETE"
        });
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
      toggleNoteStar,
      setNoteStar,
      listNotes,
      searchNotes,
      chatWithNotes,
      uploadNoteAsset,
      listNoteAssets,
      deleteNoteAsset
    };
  }
  class ChromeStorage {
    get(key) {
      return __async(this, null, function* () {
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
      });
    }
    set(data) {
      return __async(this, null, function* () {
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
      });
    }
    remove(keys) {
      return __async(this, null, function* () {
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
  }
  const chromeStorage = new ChromeStorage();
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
  let cachedClients = null;
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
  exports.getConfig = getConfig;
  exports.initApiClient = initApiClient;
  exports.initAuthClient = initAuthClient;
  exports.initClients = initClients;
})(this.LockInInit = this.LockInInit || {});
//# sourceMappingURL=initApi.js.map
