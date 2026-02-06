import type { TranscriptResult, TranscriptSegment } from '@core/transcripts/types';

/**
 * Format milliseconds as MM:SS
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Format transcript for plain text download
 */
export function formatAsPlainText(transcript: TranscriptResult, title: string): string {
  const lines: string[] = [];
  lines.push(`Transcript: ${title}`);
  lines.push(`Duration: ${formatTime(transcript.durationMs || 0)}`);
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
    const formatVttTime = (ms: number) => {
      const totalSeconds = Math.floor(ms / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const millis = ms % 1000;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
    };

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
export function downloadFile(filename: string, content: string, mimeType: string) {
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
