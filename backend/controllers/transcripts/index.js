const { transcriptJobsService } = require('../../services/transcripts/transcriptJobsService');

async function createJob(req, res) {
  const result = await transcriptJobsService.createJob({
    userId: req.user?.id,
    payload: req.body,
  });
  return res.json(result);
}

async function uploadChunk(req, res) {
  const result = await transcriptJobsService.uploadChunk({
    userId: req.user?.id,
    jobId: req.params.id,
    chunk: req.body,
    headers: req.headers,
  });
  return res.json(result);
}

async function finalizeJob(req, res) {
  const result = await transcriptJobsService.finalizeJob({
    userId: req.user?.id,
    jobId: req.params.id,
    payload: req.body,
  });
  return res.json(result);
}

async function cancelJob(req, res) {
  const result = await transcriptJobsService.cancelJob({
    userId: req.user?.id,
    jobId: req.params.id,
  });
  return res.json(result);
}

async function getJob(req, res) {
  const result = await transcriptJobsService.getJob({
    userId: req.user?.id,
    jobId: req.params.id,
  });
  return res.json(result);
}

async function listActiveJobs(req, res) {
  const result = await transcriptJobsService.listActiveJobs({
    userId: req.user?.id,
  });
  return res.json(result);
}

async function cancelAllActiveJobs(req, res) {
  const result = await transcriptJobsService.cancelAllActiveJobs({
    userId: req.user?.id,
  });
  return res.json(result);
}

async function cacheTranscript(req, res) {
  const result = await transcriptJobsService.cacheTranscript({
    userId: req.user?.id,
    payload: req.body,
  });
  return res.json(result);
}

module.exports = {
  createJob,
  uploadChunk,
  finalizeJob,
  cancelJob,
  getJob,
  listActiveJobs,
  cancelAllActiveJobs,
  cacheTranscript,
};
