(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});

  function createMessageRouter({ handlers, validators, getMessageType, respond, log }) {
    return async function handleMessage(message, sender) {
      const messageType = getMessageType
        ? getMessageType(message)
        : message?.type || message?.action;
      const handler = messageType ? handlers?.[messageType] : null;

      if (!handler) {
        const errorMessage = `Unknown message type: ${messageType}`;
        return respond.error(errorMessage);
      }

      const validator = validators?.[messageType];
      let payload = message?.payload;
      if (validator) {
        const validation = validator(message);
        if (validation && validation.ok === false) {
          const errorMessage = validation.error || 'Invalid payload';
          const fallback = validation.fallback || { error: errorMessage };
          return respond.errorWithFallback(errorMessage, fallback, validation.meta);
        }
        if (validation && 'payload' in validation) {
          payload = validation.payload;
        }
      }

      try {
        return await handler({ message, sender, payload, respond, log, messageType });
      } catch (error) {
        log.error('Error handling message:', error);
        const errorMessage = error?.message || String(error);
        return respond.error(errorMessage);
      }
    };
  }

  registry.router = {
    createMessageRouter,
  };
})();
