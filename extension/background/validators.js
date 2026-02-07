(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});

  function getMessageType(message) {
    if (!message || typeof message !== 'object') return undefined;
    return message.type || message.action;
  }

  function ensureObject(value) {
    if (value && typeof value === 'object') return value;
    return {};
  }

  function createFallbackValidators() {
    return {
      getTabId: () => ({ ok: true }),
      GET_TAB_ID: () => ({ ok: true }),
      getSession: () => ({ ok: true }),
      GET_SESSION: () => ({ ok: true }),
      saveSession: (message) => ({
        ok: true,
        payload: {
          sessionData: message?.sessionData ?? message?.payload?.sessionData,
        },
      }),
      SAVE_SESSION: (message) => ({
        ok: true,
        payload: {
          sessionData: message?.sessionData ?? message?.payload?.sessionData,
        },
      }),
      clearSession: () => ({ ok: true }),
      CLEAR_SESSION: () => ({ ok: true }),
      getSettings: () => ({ ok: true }),
      GET_SETTINGS: () => ({ ok: true }),
      saveSettings: (message) => ({
        ok: true,
        payload: {
          settings: ensureObject(message?.settings ?? message?.payload?.settings),
        },
      }),
      UPDATE_SETTINGS: (message) => ({
        ok: true,
        payload: {
          settings: ensureObject(message?.settings ?? message?.payload?.settings),
        },
      }),
      extractTranscript: (message) => ({
        ok: true,
        payload: {
          video: message?.video ?? message?.payload?.video,
        },
      }),
      EXTRACT_TRANSCRIPT: (message) => ({
        ok: true,
        payload: {
          video: message?.video ?? message?.payload?.video,
        },
      }),
      DETECT_ECHO360_VIDEOS: (message) => ({
        ok: true,
        payload: {
          context: message?.context ?? message?.payload?.context,
        },
      }),
      FETCH_PANOPTO_MEDIA_URL: (message) => ({
        ok: true,
        payload: {
          video: message?.video ?? message?.payload?.video,
        },
      }),
      TRANSCRIBE_MEDIA_AI: (message) => ({
        ok: true,
        payload: ensureObject(message?.payload ?? message),
      }),
      MEDIA_CHUNK: (message) => ({
        ok: true,
        payload: ensureObject(message?.payload),
      }),
      LIST_ACTIVE_TRANSCRIPT_JOBS: (message) => ({
        ok: true,
        payload: {
          token: message?.token ?? message?.payload?.token,
        },
      }),
      CANCEL_ALL_ACTIVE_TRANSCRIPT_JOBS: (message) => ({
        ok: true,
        payload: {
          token: message?.token ?? message?.payload?.token,
        },
      }),
    };
  }

  function createMessageValidators() {
    const schemaRegistry = root.LockInMessageSchemas;
    if (schemaRegistry?.createMessageValidators) {
      return schemaRegistry.createMessageValidators();
    }
    return createFallbackValidators();
  }

  function createRuntimeValidators() {
    const schemaRegistry = root.LockInMessageSchemas;
    if (schemaRegistry?.createRuntimeValidators) {
      return schemaRegistry.createRuntimeValidators();
    }
    return {
      validateSettings: (value) => ({ ok: true, value: value || {} }),
      validateSession: (value) => ({ ok: true, value: value || { chatHistory: [] } }),
      validateAuthSession: (value) => ({
        ok: true,
        value: value || {
          accessToken: '',
          refreshToken: '',
          expiresAt: 0,
          tokenType: 'bearer',
          user: null,
        },
      }),
      validateTranscriptJobResponse: (value) => ({
        ok: true,
        value: value || { success: false },
      }),
      validateTranscriptJob: (value) => ({
        ok: true,
        value: value || {},
      }),
      validateTranscriptJobListResponse: (value) => ({
        ok: true,
        value: value || { success: false, jobs: [] },
      }),
      validateTranscriptCancelAllResponse: (value) => ({
        ok: true,
        value: value || { success: false, canceledIds: [] },
      }),
    };
  }

  registry.validators = {
    getMessageType,
    createMessageValidators,
    createRuntimeValidators,
  };
})();
