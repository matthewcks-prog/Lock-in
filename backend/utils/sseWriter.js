/**
 * SSE (Server-Sent Events) Writer Utility
 *
 * Provides helpers for writing SSE events to Express responses.
 * Handles proper SSE formatting, keep-alive, and cleanup.
 *
 * @module utils/sseWriter
 */

/**
 * Configure an Express response for SSE streaming
 * @param {import('express').Response} res - Express response object
 * @returns {void}
 */
function configureSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.setHeader('Transfer-Encoding', 'chunked'); // Azure Envoy proxy compat
  res.flushHeaders();
}

/**
 * Write an SSE event to the response
 * @param {import('express').Response} res - Express response object
 * @param {string} event - Event type (e.g., 'meta', 'delta', 'final', 'error', 'done')
 * @param {Object} data - Event data to serialize as JSON
 * @returns {boolean} - Whether write was successful
 */
function writeSSEEvent(res, event, data) {
  if (res.writableEnded || res.destroyed) {
    return false;
  }

  try {
    const payload = JSON.stringify(data);
    const ok = res.write(`event: ${event}\ndata: ${payload}\n\n`);

    // Flush if available (for compression middleware)
    if (typeof res.flush === 'function') {
      res.flush();
    }

    return ok !== false;
  } catch {
    return false;
  }
}

/**
 * Wait for the response stream to drain (backpressure handling)
 * @param {import('express').Response} res - Express response object
 * @returns {Promise<boolean>} - Whether stream is still writable
 */
function waitForDrain(res) {
  if (res.writableEnded || res.destroyed) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const cleanup = () => {
      res.off('drain', onDrain);
      res.off('close', onClose);
      res.off('error', onClose);
    };

    const onDrain = () => {
      cleanup();
      resolve(true);
    };

    const onClose = () => {
      cleanup();
      resolve(false);
    };

    res.once('drain', onDrain);
    res.once('close', onClose);
    res.once('error', onClose);
  });
}

/**
 * Write a keep-alive comment to prevent connection timeout
 * @param {import('express').Response} res - Express response object
 * @returns {boolean} - Whether write was successful
 */
function writeKeepAlive(res) {
  if (res.writableEnded || res.destroyed) {
    return false;
  }

  try {
    res.write(': keep-alive\n\n');
    return true;
  } catch {
    return false;
  }
}

/**
 * End the SSE stream gracefully
 * @param {import('express').Response} res - Express response object
 * @returns {void}
 */
function endSSE(res) {
  if (!res.writableEnded && !res.destroyed) {
    writeSSEEvent(res, 'done', {});
    res.end();
  }
}

/**
 * Create an SSE writer bound to a specific response
 * @param {import('express').Response} res - Express response object
 * @returns {Object} - Writer object with methods
 */
function createSSEWriter(res) {
  configureSSE(res);

  return {
    /**
     * Write a typed event
     * @param {string} event - Event type
     * @param {Object} data - Event data
     * @returns {boolean}
     */
    write: (event, data) => writeSSEEvent(res, event, data),

    /**
     * Write meta event with request context
     * @param {Object} meta - { chatId, messageId, requestId, model, provider }
     * @returns {boolean}
     */
    writeMeta: (meta) => writeSSEEvent(res, 'meta', meta),

    /**
     * Write delta (incremental content) event
     * @param {string} content - Token/text chunk
     * @returns {boolean}
     */
    writeDelta: (content) => writeSSEEvent(res, 'delta', { content }),

    /**
     * Write final event with complete content
     * @param {string} content - Full accumulated content
     * @param {Object} [usage] - Token usage stats
     * @returns {boolean}
     */
    writeFinal: (content, usage = null) =>
      writeSSEEvent(res, 'final', { content, ...(usage && { usage }) }),

    /**
     * Write recovery event (used for mid-stream recoverable errors)
     * @param {string} message - Recovery message
     * @param {string} [fallbackProvider] - Provider name if switched
     * @returns {boolean}
     */
    writeRecovery: (message, fallbackProvider) =>
      writeSSEEvent(res, 'recovery', {
        message,
        ...(fallbackProvider && { fallbackProvider }),
      }),

    /**
     * Write error event
     * @param {string} code - Error code
     * @param {string} message - Error message
     * @param {boolean} [retryable=false] - Whether client should retry
     * @returns {boolean}
     */
    writeError: (code, message, retryable = false) =>
      writeSSEEvent(res, 'error', { code, message, retryable }),

    /**
     * Send keep-alive ping
     * @returns {boolean}
     */
    keepAlive: () => writeKeepAlive(res),

    /**
     * End the stream
     * @returns {void}
     */
    end: () => endSSE(res),

    /**
     * Wait for drain after a write returns false
     * @returns {Promise<boolean>}
     */
    waitForDrain: () => waitForDrain(res),

    /**
     * Check if stream is still writable
     * @returns {boolean}
     */
    isWritable: () => !res.writableEnded && !res.destroyed,
  };
}

module.exports = {
  configureSSE,
  writeSSEEvent,
  writeKeepAlive,
  endSSE,
  createSSEWriter,
  waitForDrain,
};
