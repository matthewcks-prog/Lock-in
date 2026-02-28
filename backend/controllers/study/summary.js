const HTTP_STATUS = require('../../constants/httpStatus');
const { summaryService } = require('../../services/study/summaryService');

async function generateStudySummary(req, res) {
  try {
    const payload = await summaryService.generateStudySummary({
      userId: req.user?.id,
      payload: req.body,
    });
    return res.json(payload);
  } catch (error) {
    console.error('Error processing /api/study/summary request:', error);

    if (error?.status && error?.payload) {
      return res.status(error.status).json(error.payload);
    }

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: { message: 'Failed to generate study summary. Please try again.' },
    });
  }
}

module.exports = {
  generateStudySummary,
};
