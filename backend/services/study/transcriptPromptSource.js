const HOUR_IN_SECONDS = 3600;
const MINUTE_IN_SECONDS = 60;
const MS_IN_SECOND = 1000;
const LINE_NUMBER_DIGITS = 4;

function toTwoDigits(value) {
  return String(value).padStart(2, '0');
}

function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / MS_IN_SECOND));
  const hours = Math.floor(totalSeconds / HOUR_IN_SECONDS);
  const minutes = Math.floor((totalSeconds % HOUR_IN_SECONDS) / MINUTE_IN_SECONDS);
  const seconds = totalSeconds % MINUTE_IN_SECONDS;
  if (hours > 0) {
    return `${toTwoDigits(hours)}:${toTwoDigits(minutes)}:${toTwoDigits(seconds)}`;
  }
  return `${toTwoDigits(minutes)}:${toTwoDigits(seconds)}`;
}

function sanitizeText(text) {
  if (typeof text !== 'string') {
    return '';
  }
  return text.replace(/\s+/g, ' ').trim();
}

function formatLine({ index, startMs, endMs, speaker, text }) {
  const lineNo = String(index + 1).padStart(LINE_NUMBER_DIGITS, '0');
  const safeText = sanitizeText(text);
  const safeSpeaker = sanitizeText(speaker);
  const start = formatClock(startMs);
  const end = formatClock(typeof endMs === 'number' ? endMs : startMs);
  const speakerPart = safeSpeaker.length > 0 ? `${safeSpeaker} | ` : '';
  return `L${lineNo} | ${start}-${end} | ${speakerPart}${safeText}`;
}

function buildTranscriptLines(segments) {
  return (Array.isArray(segments) ? segments : [])
    .map((segment, index) => {
      const text = sanitizeText(segment?.text);
      if (text.length === 0) {
        return null;
      }
      return formatLine({
        index,
        startMs: Number.isFinite(segment?.startMs) ? segment.startMs : 0,
        endMs: Number.isFinite(segment?.endMs) ? segment.endMs : null,
        speaker: segment?.speaker,
        text,
      });
    })
    .filter((line) => line !== null);
}

function joinTranscriptLines(lines) {
  return lines.join('\n');
}

function splitTranscriptLines(lines, chunkTargetChars) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return [];
  }
  const chunks = [];
  let currentLines = [];
  let currentSize = 0;

  for (const line of lines) {
    const lineSize = line.length + 1;
    const shouldSplit = currentLines.length > 0 && currentSize + lineSize > chunkTargetChars;
    if (shouldSplit) {
      chunks.push(currentLines.join('\n'));
      currentLines = [line];
      currentSize = lineSize;
    } else {
      currentLines.push(line);
      currentSize += lineSize;
    }
  }

  if (currentLines.length > 0) {
    chunks.push(currentLines.join('\n'));
  }

  return chunks;
}

module.exports = {
  buildTranscriptLines,
  joinTranscriptLines,
  splitTranscriptLines,
};
