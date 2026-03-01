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
import { TranscriptParagraphView } from './TranscriptParagraphView';
import { TranscriptActions } from './TranscriptActions';

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

const TRANSCRIPT_ICON = '\uD83D\uDCDD';

function toSafeTitle(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

function buildTranscriptNoteContent(videoTitle: string, plainText: string): string {
  return `# Transcript: ${videoTitle}\n\n${plainText}`;
}

function useTranscriptActions({
  transcript,
  video,
  videoTitle,
  saveNote,
}: TranscriptMessageProps): {
  handleDownloadTxt: () => void;
  handleDownloadVtt: () => void;
  handleSaveNote: () => Promise<void>;
} {
  const { cacheTranscript } = useTranscriptCacheContext();

  const handleDownloadTxt = useCallback(() => {
    const content = formatAsPlainText(transcript, videoTitle);
    downloadFile(`transcript_${toSafeTitle(videoTitle)}.txt`, content, 'text/plain');
  }, [transcript, videoTitle]);

  const handleDownloadVtt = useCallback(() => {
    const content = formatAsVtt(transcript.segments);
    downloadFile(`transcript_${toSafeTitle(videoTitle)}.vtt`, content, 'text/vtt');
  }, [transcript.segments, videoTitle]);

  const handleSaveNote = useCallback(async () => {
    cacheTranscript({ transcript, video }).catch((error) => {
      console.error('Failed to cache transcript:', error);
    });

    try {
      await saveNote({
        content: buildTranscriptNoteContent(videoTitle, transcript.plainText),
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
  }, [cacheTranscript, saveNote, transcript, video, videoTitle]);

  return { handleDownloadTxt, handleDownloadVtt, handleSaveNote };
}

export function TranscriptMessage(props: TranscriptMessageProps): JSX.Element {
  const { transcript, videoTitle } = props;
  const transcriptDurationMs = transcript.durationMs ?? 0;
  const { handleDownloadTxt, handleDownloadVtt, handleSaveNote } = useTranscriptActions(props);

  return (
    <div className="lockin-transcript-message">
      <div className="lockin-transcript-header">
        <div className="lockin-transcript-title-row">
          <span className="lockin-transcript-icon">{TRANSCRIPT_ICON}</span>
          <span className="lockin-transcript-title">Transcript: {videoTitle}</span>
        </div>
        <div className="lockin-transcript-meta">
          Transcript found | {transcript.segments.length} segments |{' '}
          {formatTime(transcriptDurationMs)}
        </div>
      </div>

      <TranscriptParagraphView segments={transcript.segments} />

      <TranscriptActions
        onDownloadTxt={handleDownloadTxt}
        onDownloadVtt={handleDownloadVtt}
        onSave={() => {
          void handleSaveNote();
        }}
      />
    </div>
  );
}
