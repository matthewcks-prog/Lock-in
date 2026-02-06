const { transcribeAudioFile } = require('./transcriptionService');
const { ensureNotCanceled } = require('./transcriptProcessingUtils');

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

    if (responseSegments.length === 0 && typeof response?.text === 'string') {
      const fallbackText = response.text.trim();
      if (fallbackText) {
        mergedSegments.push({
          startMs: segment.startMs,
          endMs: segment.startMs,
          text: fallbackText,
        });
        textParts.push(fallbackText);
      }
      continue;
    }

    for (const cue of responseSegments) {
      const text = typeof cue.text === 'string' ? cue.text.trim() : '';
      if (!text) continue;

      const startMs = segment.startMs + Math.round((cue.start || 0) * 1000);
      const endMs = segment.startMs + Math.round((cue.end || 0) * 1000);
      mergedSegments.push({ startMs, endMs, text });
      textParts.push(text);
    }
  }

  const plainText = textParts.join('\n');
  const durationMs =
    mergedSegments.length > 0 ? mergedSegments[mergedSegments.length - 1].endMs : undefined;

  return {
    plainText,
    segments: mergedSegments,
    durationMs,
  };
}

module.exports = {
  transcribeSegments,
};
