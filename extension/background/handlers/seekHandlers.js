/**
 * Seek Video Handler
 *
 * Handles `SEEK_VIDEO` messages from content scripts.  Uses
 * `chrome.scripting.executeScript` to run a self-contained function inside
 * every frame of the sender's tab (including cross-origin Panopto/Echo360
 * iframes) in the MAIN world.  The injected function directly manipulates
 * `video.currentTime` WITHOUT pausing first.
 *
 * ⚠️  Why no pause() before seeking?
 *   Calling pause() before setting currentTime triggers the player framework's
 *   own pause event handler:
 *   - Echo360 (React SPA): its onPause handler can reset internal state and
 *     override the subsequent currentTime change.
 *   - Panopto (HLS.js): its error-recovery logic repositions the stream to a
 *     "safe" buffered position after detecting a seek-while-paused scenario.
 *   Direct currentTime assignment matches the browser's scrubber behaviour;
 *   the player's HLS layer handles buffering via seeking/seeked events.
 *
 * A 500 ms position guard (setInterval) re-applies the seek if the player
 * framework overrides currentTime within 500 ms of seeked firing.  This
 * covers both Echo360 React state-machine resets and Panopto HLS recovery.
 *
 * For Echo360 this is the PRIMARY (not belt-and-suspenders) seek path because
 * Echo360's player state machine runs in MAIN world and can override
 * `currentTime` mutations made from the content script's isolated context.
 * Running in MAIN world with the position guard ensures the player picks up
 * the new position correctly.
 *
 * For Panopto, this supplements the postMessage seek dispatched by
 * `useTranscriptSeek.ts` and handles cases where Panopto's own postMessage
 * listener is slow or absent (most LMS-embedded deployments).
 */
(() => {
  const root = typeof globalThis !== 'undefined' ? globalThis : self;
  const registry = root.LockInBackground || (root.LockInBackground = {});
  const handlers = registry.handlers || (registry.handlers = {});

  // seekInFrame – Injected into every frame's MAIN world via executeScript.
  // MUST be fully self-contained: executeScript serialises only the function
  // body, so outer-scope references would be undefined in the target page.
  // eslint-disable-next-line max-lines-per-function, max-statements
  function seekInFrame(videoId, seconds) {
    const LOG = '[Lock-in seek-bg]';
    const LOG_URL_LEN = 80;
    const url = window.location.href;
    const urlWithoutQuery = (url.split('?')[0] || url).split('#')[0] || url;
    const urlShort = urlWithoutQuery.slice(0, LOG_URL_LEN);

    if (!/panopto/i.test(url) && !/echo360/i.test(url)) {
      return { sought: false, reason: 'not-media-frame' };
    }

    // For Panopto frames: confirm this is the frame hosting the requested video.
    if (/panopto/i.test(url) && videoId) {
      try {
        const fid = new URL(url).searchParams.get('id');
        if (fid && fid !== videoId) {
          console.info(LOG, 'id-mismatch – skipping frame', {
            frameId: fid,
            videoId,
            url: urlShort,
          });
          return { sought: false, reason: 'id-mismatch', frameId: fid, videoId };
        }
      } catch {} // malformed URL – fall through
    }

    // Find the largest visible <video> element in this frame.
    const vids = Array.from(document.querySelectorAll('video'));
    if (vids.length === 0) {
      console.info(LOG, 'no <video> element in frame', { url: urlShort });
      return { sought: false, reason: 'no-video-element' };
    }
    const sized = vids.filter((v) => {
      const r = v.getBoundingClientRect();
      return r.width > 0 || r.height > 0;
    });
    const target = (sized.length > 0 ? sized : vids).reduce((best, v) => {
      const vr = v.getBoundingClientRect(),
        br = best.getBoundingClientRect();
      return vr.width * vr.height > br.width * br.height ? v : best;
    });

    // Readiness gate – currentTime= on readyState < 1 is a silent no-op.
    if (target.readyState < 1) {
      console.info(LOG, 'video not ready', { readyState: target.readyState, seconds });
      return { sought: false, reason: 'not-ready' };
    }

    // Track whether the video was playing so we can restore playback after seek.
    const wasPlaying = !target.paused;

    // Seeked-then-play with timeout guard to prevent listener leaks.
    const SEEKED_TIMEOUT = 5000;
    // Re-apply the seek position for this many ms after seeked fires.  Both
    // Echo360 (React SPA) and Panopto (HLS.js recovery) can override
    // currentTime via their own event handlers shortly after seeking.
    const GUARD_MS = 500;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      target.removeEventListener('seeked', onSeeked);
      console.info(LOG, 'seeked event timed out', { seconds, url: urlShort });
    }, SEEKED_TIMEOUT);

    function onSeeked() {
      if (timedOut) return;
      clearTimeout(timer);

      // Restore playback only if the video was playing before we seeked.
      // Never force-play a video the user had intentionally paused.
      if (wasPlaying) {
        target.play().catch(() => {});
      }

      // Position guard: re-apply the seek position for GUARD_MS.
      // Both Echo360 (React SPA) and Panopto (HLS.js) can reset currentTime
      // via their own event handlers shortly after seeked fires.
      const expectedTime = seconds;
      const guardEnd = Date.now() + GUARD_MS;
      const guardId = setInterval(() => {
        if (Date.now() > guardEnd || target.paused) {
          clearInterval(guardId);
          return;
        }
        if (Math.abs(target.currentTime - expectedTime) > 2) {
          console.info(LOG, 'position guard re-applying seek', {
            current: target.currentTime,
            expected: expectedTime,
          });
          target.currentTime = expectedTime;
        }
      }, 100);
    }

    // Set currentTime directly WITHOUT pausing first.
    //
    // ⚠️  Do NOT call target.pause() before setting currentTime.
    //
    // Calling pause() triggers the player's own pause event handler, which
    // can reset seek state in both Echo360 (React SPA replays from its
    // internal state) and Panopto (HLS.js recovery logic repositions the
    // stream to a "safe" buffered position after detecting a seek-while-paused
    // scenario).  Direct currentTime assignment matches exactly the behaviour
    // of a user dragging the native scrubber – the browser fires 'seeking',
    // the HLS layer loads the correct segment, then fires 'seeked'.
    target.addEventListener('seeked', onSeeked, { once: true });
    target.currentTime = seconds;

    console.info(LOG, 'seek initiated', {
      seconds,
      readyState: target.readyState,
      wasPlaying,
      url: urlShort,
    });

    return { sought: true };
  }

  // ---------------------------------------------------------------------------
  // Handler
  // ---------------------------------------------------------------------------

  function buildScriptingError(message) {
    return {
      success: false,
      error: message,
      errorCode: 'SCRIPTING_UNAVAILABLE',
      sought: false,
      soughtFrames: 0,
      notReady: false,
      noPlayer: true,
    };
  }

  function isScriptingAvailable() {
    return (
      typeof chrome !== 'undefined' &&
      chrome.scripting &&
      typeof chrome.scripting.executeScript === 'function'
    );
  }

  async function runSeekScript({ tabId, videoId, seconds }) {
    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript(
        {
          target: { tabId, allFrames: true },
          world: 'MAIN',
          func: seekInFrame,
          args: [videoId ?? null, seconds],
        },
        (results) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(results ?? []);
        },
      );
    });
  }

  function summariseSeekResults(results, log, meta) {
    const soughtFrames = results.filter((r) => r?.result?.sought === true);
    const notReadyFrames = results.filter((r) => r?.result?.reason === 'not-ready');
    const noVideoFrames = results.filter((r) => r?.result?.reason === 'no-video-element');
    const idMismatchFrames = results.filter((r) => r?.result?.reason === 'id-mismatch');
    const notMediaFrames = results.filter((r) => r?.result?.reason === 'not-media-frame');

    const sought = soughtFrames.length > 0;
    const notReady = notReadyFrames.length > 0 && !sought;
    // noPlayer: background found no frame with a seekable video for this request.
    const noPlayer = !sought && !notReady;

    log.info('SEEK_VIDEO executeScript complete', {
      ...meta,
      totalFrames: results.length,
      soughtFrames: soughtFrames.length,
      notReadyFrames: notReadyFrames.length,
      noVideoFrames: noVideoFrames.length,
      idMismatchFrames: idMismatchFrames.length,
      notMediaFrames: notMediaFrames.length,
      detail: results.map((r) => r?.result),
    });

    if (!sought) {
      log.warn('SEEK_VIDEO: no frame was seeked', {
        ...meta,
        notReady,
        noPlayer,
        detail: results.map((r) => r?.result),
      });
    }

    return { sought, soughtFrames: soughtFrames.length, notReady, noPlayer };
  }

  /** @returns {object} A seek error fallback payload with the given errorCode. */
  function seekError(errorCode) {
    return {
      success: false,
      errorCode,
      sought: false,
      soughtFrames: 0,
      notReady: false,
      noPlayer: true,
    };
  }

  function createSeekVideoHandler({ log }) {
    return async function seekVideoHandler({ payload, sender, respond: responder }) {
      const { videoId = null, seconds, provider = 'unknown' } = payload ?? {};

      log.info('SEEK_VIDEO received', { provider, videoId, seconds });

      if (typeof seconds !== 'number' || !Number.isFinite(seconds)) {
        log.warn('SEEK_VIDEO: invalid seconds in payload', payload);
        return responder.errorWithFallback('Invalid seconds', seekError('INVALID_PAYLOAD'));
      }

      const tabId = sender?.tab?.id;
      if (!tabId) {
        log.warn('SEEK_VIDEO: no tabId in sender', sender);
        return responder.errorWithFallback('No tab ID', seekError('NO_TAB_ID'));
      }

      if (!isScriptingAvailable()) {
        return responder.errorWithFallback(
          'chrome.scripting.executeScript unavailable',
          buildScriptingError('chrome.scripting.executeScript unavailable'),
        );
      }

      try {
        const results = await runSeekScript({ tabId, videoId, seconds });
        const summary = summariseSeekResults(results, log, { provider, videoId, seconds });
        log.info('SEEK_VIDEO response', { provider, videoId, seconds, ...summary });
        return responder.success({ success: true, ...summary });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.warn('SEEK_VIDEO executeScript error:', message, { provider, videoId, seconds });
        return responder.errorWithFallback(message, seekError('EXECUTE_SCRIPT_ERROR'));
      }
    };
  }

  function createSeekHandlers({ log }) {
    const seekVideoHandler = createSeekVideoHandler({ log });
    return {
      SEEK_VIDEO: seekVideoHandler,
    };
  }

  handlers.createSeekHandlers = createSeekHandlers;
})();
