import type { TranscriptResult, TranscriptSegment } from '@core/transcripts/types';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const TWO_DIGITS = 2;
const THREE_DIGITS = 3;

function formatVttTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  const millis = ms % 1000;
  return `${String(hours).padStart(TWO_DIGITS, '0')}:${String(minutes).padStart(TWO_DIGITS, '0')}:${String(seconds).padStart(TWO_DIGITS, '0')}.${String(millis).padStart(THREE_DIGITS, '0')}`;
}

/**
 * Format milliseconds as MM:SS
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${String(minutes).padStart(TWO_DIGITS, '0')}:${String(seconds).padStart(TWO_DIGITS, '0')}`;
}

/**
 * Format transcript for plain text download
 */
export function formatAsPlainText(transcript: TranscriptResult, title: string): string {
  const lines: string[] = [];
  const durationMs = typeof transcript.durationMs === 'number' ? transcript.durationMs : 0;
  lines.push(`Transcript: ${title}`);
  lines.push(`Duration: ${formatTime(durationMs)}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(transcript.plainText);
  return lines.join('\n');
}

/**
 * Format transcript as VTT
 */
export function formatAsVtt(segments: TranscriptSegment[]): string {
  const lines: string[] = ['WEBVTT', ''];

  segments.forEach((segment, index) => {
    lines.push(String(index + 1));
    const endMs = typeof segment.endMs === 'number' ? segment.endMs : segment.startMs;
    lines.push(`${formatVttTime(segment.startMs)} --> ${formatVttTime(endMs)}`);
    lines.push(segment.text);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Download a file with given content
 */
export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
