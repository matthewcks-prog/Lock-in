const express = require('express');
const { requireSupabaseUser } = require('../authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');
const transcriptsController = require('../controllers/transcriptsController');
const { TRANSCRIPT_CHUNK_MAX_BYTES } = require('../config');

const router = express.Router();

router.use(requireSupabaseUser);

router.post('/transcripts/cache', asyncHandler(transcriptsController.cacheTranscript));
router.post('/transcripts/jobs', asyncHandler(transcriptsController.createJob));
router.get('/transcripts/jobs/active', asyncHandler(transcriptsController.listActiveJobs));
router.post(
  '/transcripts/jobs/cancel-all',
  asyncHandler(transcriptsController.cancelAllActiveJobs),
);
router.put(
  '/transcripts/jobs/:id/chunks',
  express.raw({
    type: 'application/octet-stream',
    limit: TRANSCRIPT_CHUNK_MAX_BYTES,
  }),
  asyncHandler(transcriptsController.uploadChunk),
);
router.post('/transcripts/jobs/:id/finalize', asyncHandler(transcriptsController.finalizeJob));
router.post('/transcripts/jobs/:id/cancel', asyncHandler(transcriptsController.cancelJob));
router.get('/transcripts/jobs/:id', asyncHandler(transcriptsController.getJob));

module.exports = router;
