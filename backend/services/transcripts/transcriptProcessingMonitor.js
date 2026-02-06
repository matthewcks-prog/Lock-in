function createProcessingMonitor({
  getTranscriptJob,
  updateTranscriptJob,
  logger,
  heartbeatIntervalSeconds,
  workerId,
}) {
  return function startProcessingMonitor(state) {
    const intervalMs = Math.max(1, heartbeatIntervalSeconds) * 1000;
    let running = false;

    const tick = async () => {
      if (running) return;
      running = true;
      try {
        const job = await getTranscriptJob({ jobId: state.jobId, userId: state.userId });
        if (!job) return;

        if (job.status === 'canceled') {
          state.cancelRequested = true;
          if (state.currentProcess) {
            try {
              state.currentProcess.kill('SIGKILL');
            } catch (error) {
              logger.warn({ err: error }, '[Transcripts] Failed to kill ffmpeg process');
            }
          }
          return;
        }

        await updateTranscriptJob({
          jobId: state.jobId,
          userId: state.userId,
          updates: {
            processing_heartbeat_at: new Date().toISOString(),
            processing_worker_id: workerId,
          },
        });
      } catch (error) {
        logger.warn({ err: error }, '[Transcripts] Processing heartbeat failed');
      } finally {
        running = false;
      }
    };

    tick().catch((error) => {
      logger.warn({ err: error }, '[Transcripts] Initial processing heartbeat failed');
    });

    const timer = setInterval(() => {
      tick().catch((error) => {
        logger.warn({ err: error }, '[Transcripts] Processing heartbeat failed');
      });
    }, intervalMs);

    return () => clearInterval(timer);
  };
}

module.exports = {
  createProcessingMonitor,
};
