/**
 * Streaming Assistant Controller
 *
 * Handles SSE streaming endpoint for assistant chat completion.
 * Thin HTTP layer - delegates to streamingAssistantService.
 *
 * @module controllers/assistant/stream
 */

const { randomUUID } = require('crypto');
const { createSSEWriter } = require('../../utils/sseWriter');
const { streamingAssistantService } = require('../../services/assistant/streamingAssistantService');
const HTTP_STATUS = require('../../constants/httpStatus');

/**
 * Create the streaming controller with dependencies
 * @param {Object} [deps] - Injected dependencies (for testing)
 * @param {Object} [deps.streamingAssistantService] - Service for streaming chat
 * @param {Object} [deps.logger=console] - Logger instance
 * @returns {Object} - Controller methods
 */
function createStreamController(deps = {}) {
  const service = deps.streamingAssistantService ?? streamingAssistantService;
  const logger = deps.logger ?? console;
  /**
   * Handle streaming chat request via SSE
   *
   * @param {import('express').Request} req - Express request
   * @param {import('express').Response} res - Express response
   * @returns {Promise<void>}
   */
  async function handleLockinStreamRequest(req, res) {
    const userId = req.user?.id;
    const payload = req.body;
    const idempotencyKey = req.headers['x-idempotency-key'] || null;
    const requestId = req.id || randomUUID();

    // Create SSE writer and configure response
    const sseWriter = createSSEWriter(res);

    // Setup abort handling for client disconnect
    const abortController = new AbortController();
    const cleanup = () => {
      abortController.abort();
    };

    req.on('close', cleanup);
    req.on('aborted', cleanup);

    try {
      // Delegate to streaming service - it yields SSE events
      await service.handleLockinStreamRequest({
        userId,
        payload,
        idempotencyKey,
        requestId,
        signal: abortController.signal,
        sseWriter,
      });
    } catch (error) {
      // If headers already sent, try to write error event
      if (res.headersSent) {
        const errorCode = error.code || 'STREAM_ERROR';
        const retryable = error.statusCode === 503 || error.statusCode === 429;

        sseWriter.writeError(errorCode, error.message, retryable);
        sseWriter.end();
      } else {
        // Headers not sent yet - can send regular HTTP error
        const statusCode = error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
        logger.error('[StreamController] Pre-stream error:', {
          error: error.message,
          requestId,
          userId,
        });

        res.status(statusCode).json({
          success: false,
          error: {
            code: error.code || 'INTERNAL_ERROR',
            message: error.message,
          },
        });
      }
      return;
    } finally {
      req.off('close', cleanup);
      req.off('aborted', cleanup);
    }

    // Stream completed successfully - end the response
    if (!res.writableEnded) {
      sseWriter.end();
    }
  }

  return {
    handleLockinStreamRequest,
  };
}

// Default instance for route integration
const defaultController = createStreamController();

module.exports = {
  createStreamController,
  handleLockinStreamRequest: defaultController.handleLockinStreamRequest,
};
