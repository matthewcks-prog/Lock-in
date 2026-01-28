(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const handlers = registry.handlers || (registry.handlers = {});

  function createAiTranscriptionHandlers({ aiTranscription, contentScriptMedia }) {
    async function transcribeMediaHandler({ message, payload, sender }) {
      const action = message?.action ?? payload?.action ?? 'start';
      if (action === 'cancel') {
        return aiTranscription.handleAiTranscriptionCancel(payload || message);
      }
      return aiTranscription.handleAiTranscriptionStart(payload || message, sender);
    }

    async function mediaChunkHandler({ message }) {
      return contentScriptMedia.handleMediaChunkMessage(message);
    }

    async function listActiveJobsHandler({ payload, respond }) {
      const token = payload?.token;
      if (!token) {
        return respond.errorWithFallback('No auth token provided', {
          success: false,
          error: 'No auth token provided',
        });
      }
      try {
        const result = await aiTranscription.listActiveTranscriptJobs({ token });
        return respond.hasMessaging ? respond.success(result) : { success: true, ...result };
      } catch (error) {
        const message = error.message || String(error);
        return respond.errorWithFallback(message, { success: false, error: message });
      }
    }

    async function cancelAllJobsHandler({ payload, respond }) {
      const token = payload?.token;
      if (!token) {
        return respond.errorWithFallback('No auth token provided', {
          success: false,
          error: 'No auth token provided',
        });
      }
      try {
        const result = await aiTranscription.cancelAllActiveTranscriptJobs({ token });
        return respond.hasMessaging ? respond.success(result) : { success: true, ...result };
      } catch (error) {
        const message = error.message || String(error);
        return respond.errorWithFallback(message, { success: false, error: message });
      }
    }

    return {
      TRANSCRIBE_MEDIA_AI: transcribeMediaHandler,
      MEDIA_CHUNK: mediaChunkHandler,
      LIST_ACTIVE_TRANSCRIPT_JOBS: listActiveJobsHandler,
      CANCEL_ALL_ACTIVE_TRANSCRIPT_JOBS: cancelAllJobsHandler,
    };
  }

  handlers.createAiTranscriptionHandlers = createAiTranscriptionHandlers;
})();
