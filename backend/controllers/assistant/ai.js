/**
 * Route handlers for the Lock-in assistant AI endpoints.
 *
 * Thin HTTP layer delegating to assistantService.
 */

const { assistantService } = require('../../services/assistant/assistantService');
const { extractIdempotencyKey } = require('../../utils/idempotencyKey');
const HTTP_STATUS = require('../../constants/httpStatus');

async function handleLockinRequest(req, res) {
  try {
    const idempotencyKey = extractIdempotencyKey(req);
    const payload = await assistantService.handleLockinRequest({
      userId: req.user?.id,
      payload: req.body,
      idempotencyKey,
    });

    return res.json(payload);
  } catch (error) {
    console.error('Error processing /api/lockin request:', error);

    if (error?.status && error?.payload) {
      return res.status(error.status).json(error.payload);
    }

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: { message: 'Failed to process your request. Please try again.' },
    });
  }
}

module.exports = {
  handleLockinRequest,
};
