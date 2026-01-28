(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});

  function createResponder(messaging) {
    const hasMessaging =
      !!messaging &&
      typeof messaging.createSuccessResponse === 'function' &&
      typeof messaging.createErrorResponse === 'function';

    return {
      hasMessaging,
      success: (data) => (hasMessaging ? messaging.createSuccessResponse(data) : data),
      error: (message, meta) =>
        hasMessaging ? messaging.createErrorResponse(message, meta) : { error: message },
      errorWithFallback: (message, fallback, meta) =>
        hasMessaging ? messaging.createErrorResponse(message, meta) : fallback,
    };
  }

  registry.responder = {
    createResponder,
  };
})();
