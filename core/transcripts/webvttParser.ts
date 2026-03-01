/**
 * WebVTT Parser
 *
 * Parses WebVTT format captions into structured segments.
 * Handles HTML entity decoding and common VTT variations.
 */

import type { TranscriptResult, TranscriptSegment } from './types';

const DECIMAL_RADIX = 10;
const HEX_RADIX = 16;
const MIN_TIMESTAMP_PARTS = 2;
const MAX_TIMESTAMP_PARTS = 3;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const MILLISECONDS_PER_SECOND = 1000;
const MILLIS_PAD_LENGTH = 3;
const TIMESTAMP_LINE_REGEX =
  /^(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?)\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?)/;

/**
 * Common HTML entities that appear in VTT captions
 */
const HTML_ENTITIES: Record<string, string> = {
  '&#39;': "'",
  '&#x27;': "'",
  '&apos;': "'",
  '&#34;': '"',
  '&#x22;': '"',
  '&quot;': '"',
  '&amp;': '&',
  '&#38;': '&',
  '&lt;': '<',
  '&#60;': '<',
  '&gt;': '>',
  '&#62;': '>',
  '&nbsp;': ' ',
  '&#160;': ' ',
  '&#8217;': '\u2019', // Right single quote
  '&#8216;': '\u2018', // Left single quote
  '&#8220;': '\u201C', // Left double quote
  '&#8221;': '\u201D', // Right double quote
  '&#8211;': '\u2013', // En dash
  '&#8212;': '\u2014', // Em dash
  '&#8230;': '\u2026', // Ellipsis
};

const parseIntOrZero = (value: string): number => {
  const parsed = Number.parseInt(value, DECIMAL_RADIX);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const parseFloatOrZero = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Decode HTML entities in text
 */
export function decodeHtmlEntities(text: string): string {
  let result = text;

  // Replace named and numeric entities
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    result = result.split(entity).join(char);
  }

  // Handle arbitrary numeric entities (&#NNN; or &#xHHH;)
  result = result.replace(/&#(\d+);/g, (_match: string, code: string) => {
    return String.fromCharCode(Number.parseInt(code, DECIMAL_RADIX));
  });

  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_match: string, code: string) => {
    return String.fromCharCode(Number.parseInt(code, HEX_RADIX));
  });

  return result;
}

/**
 * Parse a VTT timestamp into milliseconds
 * Formats: HH:MM:SS.mmm or MM:SS.mmm
 */
export function parseVttTimestamp(timestamp: string): number {
  const parts = timestamp.trim().split(':');

  if (parts.length < MIN_TIMESTAMP_PARTS || parts.length > MAX_TIMESTAMP_PARTS) {
    return 0;
  }

  let hours = 0;
  let minutes: number;
  let seconds: number;

  const [part0, part1, part2] = parts;
  if (parts.length === MAX_TIMESTAMP_PARTS) {
    hours = parseIntOrZero(part0 ?? '0');
    minutes = parseIntOrZero(part1 ?? '0');
    seconds = parseFloatOrZero(part2 ?? '0');
  } else {
    minutes = parseIntOrZero(part0 ?? '0');
    seconds = parseFloatOrZero(part1 ?? '0');
  }

  return Math.round(
    (hours * SECONDS_PER_HOUR + minutes * SECONDS_PER_MINUTE + seconds) * MILLISECONDS_PER_SECOND,
  );
}

/**
 * Strip VTT formatting tags like <v>, <c>, <b>, etc.
 */
function stripVttTags(text: string): string {
  // Remove voice tags: <v Name>text</v>
  let result = text.replace(/<v[^>]*>/gi, '').replace(/<\/v>/gi, '');

  // Remove class tags: <c.classname>text</c>
  result = result.replace(/<c[^>]*>/gi, '').replace(/<\/c>/gi, '');

  // Remove other inline tags: <b>, <i>, <u>, <ruby>, <rt>, <lang>
  result = result.replace(/<\/?(?:b|i|u|ruby|rt|lang)[^>]*>/gi, '');

  return result.trim();
}

function skipHeaderLines(lines: string[]): number {
  let index = 0;
  while (index < lines.length) {
    const line = (lines[index] ?? '').trim();
    if (
      line === '' ||
      line.startsWith('WEBVTT') ||
      line.startsWith('NOTE') ||
      line.startsWith('STYLE')
    ) {
      index += 1;
      if (line.startsWith('NOTE') || line.startsWith('STYLE')) {
        while (index < lines.length && (lines[index] ?? '').trim() !== '') {
          index += 1;
        }
      }
      continue;
    }
    break;
  }
  return index;
}

function parseTimestampLine(line: string): { startMs: number; endMs: number } | null {
  const timestampMatch = line.match(TIMESTAMP_LINE_REGEX);
  if (timestampMatch === null) return null;
  const startTimestamp = timestampMatch[1];
  const endTimestamp = timestampMatch[2];
  if (startTimestamp === undefined || endTimestamp === undefined) return null;
  if (startTimestamp.length === 0 || endTimestamp.length === 0) return null;
  return {
    startMs: parseVttTimestamp(startTimestamp),
    endMs: parseVttTimestamp(endTimestamp),
  };
}

function collectCueText(lines: string[], startIndex: number): { text: string; nextIndex: number } {
  const textLines: string[] = [];
  let index = startIndex;
  while (index < lines.length && (lines[index] ?? '').trim() !== '') {
    textLines.push(lines[index] ?? '');
    index += 1;
  }
  return { text: textLines.join(' '), nextIndex: index };
}

function normalizeCueText(rawText: string): string {
  if (rawText.length === 0) return '';
  let text = stripVttTags(rawText);
  text = decodeHtmlEntities(text);
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function buildDurationMs(segments: TranscriptSegment[]): number {
  const lastSegment = segments[segments.length - 1];
  if (lastSegment === undefined) return 0;
  if (typeof lastSegment.endMs === 'number') return lastSegment.endMs;
  return lastSegment.startMs;
}

function parseSegments(lines: string[]): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let i = skipHeaderLines(lines);

  while (i < lines.length) {
    const line = (lines[i] ?? '').trim();

    if (line === '') {
      i += 1;
      continue;
    }

    const timestamps = parseTimestampLine(line);
    if (timestamps === null) {
      i += 1;
      continue;
    }

    const { startMs, endMs } = timestamps;
    i += 1;

    const { text: rawText, nextIndex } = collectCueText(lines, i);
    i = nextIndex;

    const text = normalizeCueText(rawText);
    if (text.length > 0) {
      segments.push({ startMs, endMs, text });
    }
  }

  return segments;
}

/**
 * Parse WebVTT content into structured segments
 *
 * @param vttContent - Raw VTT file content
 * @returns Parsed transcript with segments and plain text
 */
export function parseWebVtt(vttContent: string): TranscriptResult {
  const lines = vttContent.split(/\r?\n/);
  const segments = parseSegments(lines);

  // Build plain text version
  const plainText = segments.map((segment) => segment.text).join(' ');

  // Calculate duration from last segment
  const durationMs = buildDurationMs(segments);

  return {
    plainText,
    segments,
    durationMs,
  };
}

/**
 * Format segments back to VTT format
 */
export function formatAsVtt(segments: TranscriptSegment[]): string {
  const lines: string[] = ['WEBVTT', ''];

  segments.forEach((segment, index) => {
    lines.push(String(index + 1));
    const endMs = typeof segment.endMs === 'number' ? segment.endMs : segment.startMs;
    lines.push(`${formatVttTimestamp(segment.startMs)} --> ${formatVttTimestamp(endMs)}`);
    lines.push(segment.text);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Format milliseconds as VTT timestamp (HH:MM:SS.mmm)
 */
function formatVttTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / MILLISECONDS_PER_SECOND);
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  const millis = ms % MILLISECONDS_PER_SECOND;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(MILLIS_PAD_LENGTH, '0')}`;
}
