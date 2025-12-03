(function () {
  const config = window.LOCKIN_CONFIG || {};
  const SUPABASE_URL = config.SUPABASE_URL || "";
  const SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY || "";
  const SESSION_STORAGE_KEY =
    config.SESSION_STORAGE_KEY || "lockinSupabaseSession";
  const EXPIRY_BUFFER = Number(config.TOKEN_EXPIRY_BUFFER_MS) || 60000;

  const listeners = new Set();

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
      } catch (_) {
        // ignore
      }
    }

    const message =
      payload?.error_description ||
      payload?.error ||
      payload?.message ||
      fallbackMessage;
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

  function readStorage() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.get([SESSION_STORAGE_KEY], (data) => {
          resolve(data[SESSION_STORAGE_KEY] || null);
        });
      } catch (error) {
        console.error("Lock-in auth storage read error:", error);
        resolve(null);
      }
    });
  }

  function writeStorage(session) {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.set({ [SESSION_STORAGE_KEY]: session }, () => {
          resolve(session);
        });
      } catch (error) {
        console.error("Lock-in auth storage write error:", error);
        resolve(null);
      }
    });
  }

  function clearStorage() {
    return new Promise((resolve) => {
      try {
        chrome.storage.sync.remove([SESSION_STORAGE_KEY], () => resolve());
      } catch (error) {
        console.error("Lock-in auth storage clear error:", error);
        resolve();
      }
    });
  }

  function assertConfig() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Supabase URL or anon key is not configured");
    }
  }

  function normalizeSession(data, fallbackUser = null) {
    if (!data?.access_token || !data?.refresh_token) {
      throw new Error("Supabase session payload missing tokens");
    }

    const expiresIn = Number(data.expires_in) || 3600;
    const expiresAt = Date.now() + expiresIn * 1000;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      tokenType: data.token_type || "bearer",
      user: data.user || fallbackUser || null,
    };
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

    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      }
    );

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

    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const parsed = await parseErrorResponse(
        response,
        "Failed to create account"
      );
      throw createAuthError(parsed.message, parsed.code, parsed.details);
    }

    const data = await response.json();

    if (!data?.access_token || !data?.refresh_token) {
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

    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }
    );

    if (!response.ok) {
      await clearStorage();
      let errorMessage = "Failed to refresh session";
      try {
        const errorBody = await response.json();
        errorMessage =
          errorBody?.error_description || errorBody?.message || errorMessage;
      } catch (_) {
        // ignore parse errors
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
    const buffer = EXPIRY_BUFFER;
    if (expiresAt - buffer > Date.now()) {
      return session.accessToken;
    }

    try {
      const refreshed = await refreshSession(
        session.refreshToken,
        session.user
      );
      return refreshed.accessToken;
    } catch (error) {
      console.error("Lock-in token refresh failed:", error.message);
      return null;
    }
  }

  async function getAccessToken() {
    return getValidAccessToken();
  }

  async function getCurrentUser() {
    const session = await getSession();
    return session?.user || null;
  }

  async function signOut() {
    await clearStorage();
    notify(null);
  }

  function onSessionChanged(callback) {
    if (typeof callback !== "function") {
      return () => {};
    }
    listeners.add(callback);
    return () => listeners.delete(callback);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes[SESSION_STORAGE_KEY]) {
      return;
    }
    notify(changes[SESSION_STORAGE_KEY].newValue || null);
  });

  window.LockInAuth = {
    signUpWithEmail,
    signInWithEmail,
    signOut,
    getSession,
    getCurrentUser,
    getValidAccessToken,
    getAccessToken,
    onSessionChanged,
  };
})();
