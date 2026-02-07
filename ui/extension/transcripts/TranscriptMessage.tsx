/**
 * TranscriptMessage Component
 *
 * Displays a transcript in the chat with download options.
 */

import { useCallback } from 'react';
import type { DetectedVideo, TranscriptResult } from '@core/transcripts/types';
import type { SaveNoteOptions } from '../hooks/useNoteSave';
import type { Note } from '@core/domain/Note';
import { useTranscriptCacheContext } from '../contexts/TranscriptCacheContext';
import { downloadFile, formatAsPlainText, formatAsVtt, formatTime } from './transcriptFormatting';

interface TranscriptMessageProps {
  /** The transcript data */
  transcript: TranscriptResult;
  /** Video metadata for caching */
  video: DetectedVideo;
  /** Video title for display */
  videoTitle: string;
  /** Save note function from context */
  saveNote: (options: SaveNoteOptions) => Promise<Note | null>;
}

export function TranscriptMessage({
  transcript,
  video,
  videoTitle,
  saveNote,
}: TranscriptMessageProps) {
  const { cacheTranscript } = useTranscriptCacheContext();

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

  const handleSaveNote = useCallback(async () => {
    cacheTranscript({ transcript, video }).catch((error) => {
      console.error('Failed to cache transcript:', error);
    });
    const noteContent = `# Transcript: ${videoTitle}\n\n${transcript.plainText}`;
    try {
      await saveNote({
        content: noteContent,
        noteType: 'transcript',
        onSuccess: (note) => {
          console.log('Transcript saved as note:', note.id);
        },
        onError: (error) => {
          console.error('Failed to save transcript:', error);
        },
      });
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  }, [cacheTranscript, transcript, video, videoTitle, saveNote]);

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
