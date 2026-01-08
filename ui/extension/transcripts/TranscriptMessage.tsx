/**
 * TranscriptMessage Component
 *
 * Displays a transcript in the chat with download options.
 */

import { useCallback } from 'react';
import type { TranscriptResult, TranscriptSegment } from '../../../core/transcripts/types';

interface TranscriptMessageProps {
  /** The transcript data */
  transcript: TranscriptResult;
  /** Video title for display */
  videoTitle: string;
  /** Callback to save as note */
  onSaveAsNote: (content: string) => void;
}

/**
 * Format milliseconds as MM:SS
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Format transcript for plain text download
 */
function formatAsPlainText(transcript: TranscriptResult, title: string): string {
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
function formatAsVtt(segments: TranscriptSegment[]): string {
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
function downloadFile(filename: string, content: string, mimeType: string) {
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

export function TranscriptMessage({
  transcript,
  videoTitle,
  onSaveAsNote,
}: TranscriptMessageProps) {
  const handleDownloadTxt = useCallback(() => {
    const content = formatAsPlainText(transcript, videoTitle);
    const safeTitle = videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    downloadFile(`transcript_${safeTitle}.txt`, content, 'text/plain');
  }, [transcript, videoTitle]);

  const handleDownloadVtt = useCallback(() => {
    const content = formatAsVtt(transcript.segments);
    const safeTitle = videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    downloadFile(`transcript_${safeTitle}.vtt`, content, 'text/vtt');
  }, [transcript.segments, videoTitle]);

  const handleSaveNote = useCallback(() => {
    const noteContent = `# Transcript: ${videoTitle}\n\n${transcript.plainText}`;
    onSaveAsNote(noteContent);
  }, [transcript.plainText, videoTitle, onSaveAsNote]);

  return (
    <div className="lockin-transcript-message">
      <div className="lockin-transcript-header">
        <div className="lockin-transcript-title-row">
          <span className="lockin-transcript-icon">📝</span>
          <span className="lockin-transcript-title">Transcript: {videoTitle}</span>
        </div>
        <div className="lockin-transcript-meta">
          Transcript found | {transcript.segments.length} segments |{' '}
          {formatTime(transcript.durationMs || 0)}
        </div>
      </div>

      <div className="lockin-transcript-content">{transcript.plainText}</div>

      <div className="lockin-transcript-actions">
        <button
          className="lockin-transcript-action-btn"
          onClick={handleDownloadTxt}
          title="Download as plain text"
          type="button"
        >
          📥 Download .txt
        </button>
        <button
          className="lockin-transcript-action-btn"
          onClick={handleDownloadVtt}
          title="Download as VTT with timestamps"
          type="button"
        >
          📥 Download .vtt
        </button>
        <button
          className="lockin-transcript-action-btn lockin-transcript-action-primary"
          onClick={handleSaveNote}
          title="Save transcript as note"
          type="button"
        >
          💾 Save note
        </button>
      </div>
    </div>
  );
}
