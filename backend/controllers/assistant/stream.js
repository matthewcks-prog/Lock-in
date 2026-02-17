/**
 * Streaming Assistant Controller
 *
 * Handles SSE streaming endpoint for assistant chat completion.
 * Thin HTTP layer that delegates to streamingAssistantService.
 *
 * @module controllers/assistant/stream
 */

const { randomUUID } = require('crypto');
const { createSSEWriter } = require('../../utils/sseWriter');
const { streamingAssistantService } = require('../../services/assistant/streamingAssistantService');
const HTTP_STATUS = require('../../constants/httpStatus');

const RETRYABLE_STREAM_STATUSES = new Set([
  HTTP_STATUS.SERVICE_UNAVAILABLE,
  HTTP_STATUS.TOO_MANY_REQUESTS,
]);

function buildStreamRequestContext(req) {
  return {
    userId: req.user?.id,
    payload: req.body,
    idempotencyKey: req.headers['x-idempotency-key'] || null,
    requestId: req.id || randomUUID(),
  };
}

function createAbortState(req) {
  const abortController = new AbortController();
  const cleanup = () => {
    abortController.abort();
  };

  req.on('close', cleanup);
  req.on('aborted', cleanup);

  return {
    signal: abortController.signal,
    teardown() {
      req.off('close', cleanup);
      req.off('aborted', cleanup);
    },
  };
}

function writePreStreamErrorResponse({ error, res, logger, requestId, userId }) {
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

function writeStreamError({ error, res, sseWriter, logger, requestId, userId }) {
  if (res.headersSent) {
    const errorCode = error.code || 'STREAM_ERROR';
    const retryable = RETRYABLE_STREAM_STATUSES.has(error.statusCode);
    sseWriter.writeError(errorCode, error.message, retryable);
    sseWriter.end();
    return;
  }

  writePreStreamErrorResponse({
    error,
    res,
    logger,
    requestId,
    userId,
  });
}

function createStreamController(deps = {}) {
  const service = deps.streamingAssistantService ?? streamingAssistantService;
  const logger = deps.logger ?? console;

  async function handleLockinStreamRequest(req, res) {
    const context = buildStreamRequestContext(req);
    const sseWriter = createSSEWriter(res);
    const abortState = createAbortState(req);

    try {
      await service.handleLockinStreamRequest({
        userId: context.userId,
        payload: context.payload,
        idempotencyKey: context.idempotencyKey,
        requestId: context.requestId,
        signal: abortState.signal,
        sseWriter,
      });
    } catch (error) {
      writeStreamError({
        error,
        res,
        sseWriter,
        logger,
        requestId: context.requestId,
        userId: context.userId,
      });
      return;
    } finally {
      abortState.teardown();
    }

    if (!res.writableEnded) {
      sseWriter.end();
    }
  }

  return {
    handleLockinStreamRequest,
  };
}

const defaultController = createStreamController();

module.exports = {
  createStreamController,
  handleLockinStreamRequest: defaultController.handleLockinStreamRequest,
};
