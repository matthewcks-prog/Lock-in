const express = require('express');
const { requireSupabaseUser } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');
const transcriptsController = require('../controllers/transcripts');
const { TRANSCRIPT_CHUNK_MAX_BYTES } = require('../config');
const { validate, validateParams } = require('../validators/middleware');
const {
  jobIdParamSchema,
  createJobSchema,
  finalizeJobSchema,
  cacheTranscriptSchema,
} = require('../validators/transcriptValidators');

const router = express.Router();

router.use(requireSupabaseUser);

router.post(
  '/transcripts/cache',
  validate(cacheTranscriptSchema),
  asyncHandler(transcriptsController.cacheTranscript),
);
router.post(
  '/transcripts/jobs',
  validate(createJobSchema),
  asyncHandler(transcriptsController.createJob),
);
router.get('/transcripts/jobs/active', asyncHandler(transcriptsController.listActiveJobs));
router.post(
  '/transcripts/jobs/cancel-all',
  asyncHandler(transcriptsController.cancelAllActiveJobs),
);
router.put(
  '/transcripts/jobs/:id/chunks',
  validateParams(jobIdParamSchema),
  express.raw({
    type: 'application/octet-stream',
    limit: TRANSCRIPT_CHUNK_MAX_BYTES,
  }),
  asyncHandler(transcriptsController.uploadChunk),
);
router.post(
  '/transcripts/jobs/:id/finalize',
  validateParams(jobIdParamSchema),
  validate(finalizeJobSchema),
  asyncHandler(transcriptsController.finalizeJob),
);
router.post(
  '/transcripts/jobs/:id/cancel',
  validateParams(jobIdParamSchema),
  asyncHandler(transcriptsController.cancelJob),
);
router.get(
  '/transcripts/jobs/:id',
  validateParams(jobIdParamSchema),
  asyncHandler(transcriptsController.getJob),
);

module.exports = router;
