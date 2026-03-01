function killCurrentProcess(state, logger) {
  if (!state.currentProcess) return;
  try {
    state.currentProcess.kill('SIGKILL');
  } catch (error) {
    logger.warn({ err: error }, '[Transcripts] Failed to kill ffmpeg process');
  }
}

async function updateHeartbeat({ updateTranscriptJob, state, workerId }) {
  await updateTranscriptJob({
    jobId: state.jobId,
    userId: state.userId,
    updates: {
      processing_heartbeat_at: new Date().toISOString(),
      processing_worker_id: workerId,
    },
  });
}

function createMonitorTick({ getTranscriptJob, updateTranscriptJob, logger, workerId }, state) {
  let running = false;
  return async function tick() {
    if (running) return;
    running = true;
    try {
      const job = await getTranscriptJob({ jobId: state.jobId, userId: state.userId });
      if (!job) return;

      if (job.status === 'canceled') {
        state.cancelRequested = true;
        killCurrentProcess(state, logger);
        return;
      }

      await updateHeartbeat({ updateTranscriptJob, state, workerId });
    } catch (error) {
      logger.warn({ err: error }, '[Transcripts] Processing heartbeat failed');
    } finally {
      running = false;
    }
  };
}

function scheduleMonitorTick(tick, intervalMs, logger) {
  tick().catch((error) => {
    logger.warn({ err: error }, '[Transcripts] Initial processing heartbeat failed');
  });

  return setInterval(() => {
    tick().catch((error) => {
      logger.warn({ err: error }, '[Transcripts] Processing heartbeat failed');
    });
  }, intervalMs);
}

function createProcessingMonitor(dependencies) {
  return function startProcessingMonitor(state) {
    const intervalMs = Math.max(1, dependencies.heartbeatIntervalSeconds) * 1000;
    const tick = createMonitorTick(dependencies, state);
    const timer = scheduleMonitorTick(tick, intervalMs, dependencies.logger);
    return () => clearInterval(timer);
  };
}

module.exports = {
  createProcessingMonitor,
};
