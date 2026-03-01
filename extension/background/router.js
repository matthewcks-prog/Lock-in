(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});

  function resolveMessageType(message, getMessageType) {
    if (getMessageType) return getMessageType(message);
    return message?.type || message?.action;
  }

  function resolveHandler(handlers, messageType) {
    return messageType ? handlers?.[messageType] : null;
  }

  function validatePayload({ message, validators, messageType, respond }) {
    const validator = validators?.[messageType];
    if (!validator) {
      return { ok: true, payload: message?.payload };
    }
    const validation = validator(message);
    if (validation && validation.ok === false) {
      const errorMessage = validation.error || 'Invalid payload';
      const fallback = validation.fallback || { error: errorMessage };
      return {
        ok: false,
        response: respond.errorWithFallback(errorMessage, fallback, validation.meta),
      };
    }
    if (validation && 'payload' in validation) {
      return { ok: true, payload: validation.payload };
    }
    return { ok: true, payload: message?.payload };
  }

  async function executeHandler({ handler, message, sender, payload, respond, log, messageType }) {
    try {
      return await handler({ message, sender, payload, respond, log, messageType });
    } catch (error) {
      log.error('Error handling message:', error);
      const errorMessage = error?.message || String(error);
      return respond.error(errorMessage);
    }
  }

  function createMessageRouter({ handlers, validators, getMessageType, respond, log }) {
    return async function handleMessage(message, sender) {
      const messageType = resolveMessageType(message, getMessageType);
      const handler = resolveHandler(handlers, messageType);

      if (!handler) {
        const errorMessage = `Unknown message type: ${messageType}`;
        return respond.error(errorMessage);
      }

      const payloadValidation = validatePayload({
        message,
        validators,
        messageType,
        respond,
      });
      if (!payloadValidation.ok) {
        return payloadValidation.response;
      }

      return executeHandler({
        handler,
        message,
        sender,
        payload: payloadValidation.payload,
        respond,
        log,
        messageType,
      });
    };
  }

  registry.router = {
    createMessageRouter,
  };
})();
