const { transcribeAudioFile } = require('./transcriptionService');
const { ensureNotCanceled } = require('./transcriptProcessingUtils');

function appendFallbackSegment(response, segment, mergedSegments, textParts) {
  if (Array.isArray(response?.segments) && response.segments.length > 0) {
    return false;
  }
  if (typeof response?.text !== 'string') {
    return false;
  }

  const fallbackText = response.text.trim();
  if (!fallbackText) {
    return true;
  }

  mergedSegments.push({
    startMs: segment.startMs,
    endMs: segment.startMs,
    text: fallbackText,
  });
  textParts.push(fallbackText);
  return true;
}

function appendResponseSegments(responseSegments, segment, mergedSegments, textParts) {
  for (const cue of responseSegments) {
    const text = typeof cue.text === 'string' ? cue.text.trim() : '';
    if (!text) continue;

    const startMs = segment.startMs + Math.round((cue.start || 0) * 1000);
    const endMs = segment.startMs + Math.round((cue.end || 0) * 1000);
    mergedSegments.push({ startMs, endMs, text });
    textParts.push(text);
  }
}

function getDurationMs(segments) {
  if (segments.length === 0) {
    return undefined;
  }
  return segments[segments.length - 1].endMs;
}

async function transcribeSegments(segments, options, state) {
  const mergedSegments = [];
  const textParts = [];

  for (const segment of segments) {
    ensureNotCanceled(state);
    const response = await transcribeAudioFile({
      filePath: segment.path,
      language: options?.languageHint,
    });

    const responseSegments = Array.isArray(response?.segments) ? response.segments : [];
    if (appendFallbackSegment(response, segment, mergedSegments, textParts)) {
      continue;
    }
    appendResponseSegments(responseSegments, segment, mergedSegments, textParts);
  }

  return {
    plainText: textParts.join('\n'),
    segments: mergedSegments,
    durationMs: getDurationMs(mergedSegments),
  };
}

module.exports = {
  transcribeSegments,
};
