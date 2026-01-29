(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});

  class BackgroundError extends Error {
    constructor(message, options = {}) {
      super(message);
      this.name = 'BackgroundError';
      this.code = options.code || null;
      this.status = options.status || null;
      this.details = options.details || null;
      this.cause = options.cause;
    }
  }

  class ValidationError extends BackgroundError {
    constructor(message, options = {}) {
      super(message, { ...options, code: options.code || 'VALIDATION_ERROR' });
      this.name = 'ValidationError';
    }
  }

  function createErrorWithCode(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function getErrorCode(error) {
    if (!error || typeof error !== 'object') return null;
    if ('code' in error && typeof error.code === 'string') {
      return error.code;
    }
    return null;
  }

  function toErrorMessage(error) {
    if (error instanceof Error) return error.message;
    return typeof error === 'string' ? error : String(error);
  }

  registry.errors = {
    BackgroundError,
    ValidationError,
    createErrorWithCode,
    getErrorCode,
    toErrorMessage,
  };
})();
