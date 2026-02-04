const feedbackRepo = require('../repositories/feedbackRepository');

const MAX_MESSAGE_LENGTH = 5000;
const VALID_TYPES = ['bug', 'feature', 'question', 'other'];

function createRequestError(status, payload) {
  const error = new Error(payload?.error?.message || 'Request error');
  error.status = status;
  error.payload = payload;
  return error;
}

function ensureValidType(type) {
  if (type && VALID_TYPES.includes(type)) {
    return;
  }
  throw createRequestError(400, {
    success: false,
    error: {
      code: 'INVALID_TYPE',
      message: `type must be one of: ${VALID_TYPES.join(', ')}`,
    },
  });
}

function ensureValidMessage(message) {
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw createRequestError(400, {
      success: false,
      error: {
        code: 'MISSING_MESSAGE',
        message: 'message is required',
      },
    });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw createRequestError(400, {
      success: false,
      error: {
        code: 'MESSAGE_TOO_LONG',
        message: `message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
      },
    });
  }
}

function sanitizeContext(context, userAgent) {
  const sanitizedContext = context
    ? {
        url: context.url?.slice(0, 2000) || null,
        courseCode: context.courseCode?.slice(0, 50) || null,
        extensionVersion: context.extensionVersion?.slice(0, 20) || null,
        browser: context.browser?.slice(0, 200) || null,
        page: context.page?.slice(0, 200) || null,
      }
    : null;

  return {
    ...sanitizedContext,
    serverUserAgent: userAgent?.slice(0, 500) || null,
    submittedAt: new Date().toISOString(),
  };
}

function normalizeLimit(limit) {
  return limit ? Math.min(Math.max(parseInt(limit, 10), 1), 100) : 50;
}

function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function ensureValidFeedbackId(feedbackId) {
  if (!feedbackId || !isValidUUID(feedbackId)) {
    throw createRequestError(400, {
      success: false,
      error: {
        code: 'INVALID_FEEDBACK_ID',
        message: 'feedbackId must be a valid UUID',
      },
    });
  }
}

function createFeedbackService(deps = {}) {
  const repo = deps.feedbackRepo ?? feedbackRepo;

  async function createFeedback({ userId, payload, userAgent } = {}) {
    const { type, message, context } = payload || {};

    ensureValidType(type);
    ensureValidMessage(message);
    const finalContext = sanitizeContext(context, userAgent);

    const feedback = await repo.createFeedback({
      userId,
      type,
      message: message.trim(),
      context: finalContext,
    });

    return feedback;
  }

  async function listUserFeedback({ userId, limit } = {}) {
    return repo.getFeedbackByUser(userId, { limit: normalizeLimit(limit) });
  }

  async function getFeedback({ userId, feedbackId } = {}) {
    ensureValidFeedbackId(feedbackId);

    const feedback = await repo.getFeedbackById(feedbackId, userId);
    if (!feedback) {
      throw createRequestError(404, {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Feedback not found',
        },
      });
    }

    return feedback;
  }

  return {
    createFeedback,
    listUserFeedback,
    getFeedback,
  };
}

const feedbackService = createFeedbackService();

module.exports = {
  createFeedbackService,
  feedbackService,
};
