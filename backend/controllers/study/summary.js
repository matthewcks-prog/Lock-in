const { summaryService } = require('../../services/study/summaryService');

async function generateStudySummary(req, res) {
  const payload = await summaryService.generateStudySummary({
    userId: req.user?.id,
    payload: req.body,
  });
  return res.json(payload);
}

module.exports = {
  generateStudySummary,
};
