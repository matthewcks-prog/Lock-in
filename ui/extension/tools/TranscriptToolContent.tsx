/**
 * TranscriptToolContent Component
 *
 * Wraps existing Transcript UI for use in the Study Tools framework.
 * Reuses useTranscripts hook and TranscriptVideoListPanel - no duplication of logic.
 *
 */

import { useEffect, useCallback } from 'react';
import { useTranscripts } from '../transcripts/useTranscripts';
import { TranscriptVideoListPanel } from '../transcripts/components';
import { TranscriptMessage } from '../transcripts/TranscriptMessage';
import { useNoteSaveContext } from '../contexts/NoteSaveContext';

export function TranscriptToolContent() {
  const { saveNote } = useNoteSaveContext();
  const {
    state: transcriptState,
    detectAndAutoExtract,
    closeVideoList,
    extractTranscript,
    transcribeWithAI,
    cancelAiTranscription,
    clearError,
  } = useTranscripts();

  // Auto-detect videos when tool opens
  useEffect(() => {
    // Only detect if we don't already have videos or a transcript
    if (transcriptState.videos.length === 0 && !transcriptState.lastTranscript) {
      detectAndAutoExtract();
    }
    // Run once on mount - intentionally omitting dependencies
  }, []);

  const handlePanelClose = useCallback(() => {
    closeVideoList();
    clearError();
  }, [closeVideoList, clearError]);

  // Determine if we should show the video list
  // Show list if: it's open, OR we have no transcript yet, OR we have videos but no extraction yet
  const showVideoList =
    transcriptState.isVideoListOpen ||
    (!transcriptState.lastTranscript && transcriptState.videos.length > 0) ||
    transcriptState.isDetecting;

  return (
    <div className="lockin-tool-content lockin-transcript-tool">
      {/* Show last extracted transcript */}
      {transcriptState.lastTranscript && (
        <>
          <TranscriptMessage
            transcript={transcriptState.lastTranscript.transcript}
            video={transcriptState.lastTranscript.video}
            videoTitle={transcriptState.lastTranscript.video.title || 'Video'}
            saveNote={saveNote}
          />
          {/* Button to change video if multiple videos exist */}
          {transcriptState.videos.length > 1 && !showVideoList && (
            <div className="lockin-transcript-change-video">
              <button
                className="lockin-transcript-change-video-btn"
                onClick={() => detectAndAutoExtract()}
                type="button"
              >
                Change video ({transcriptState.videos.length} available)
              </button>
            </div>
          )}
        </>
      )}

      {/* Show video list for selection */}
      {showVideoList && (
        <TranscriptVideoListPanel
          videos={transcriptState.videos}
          isLoading={transcriptState.isDetecting}
          isExtracting={transcriptState.isExtracting}
          extractingVideoId={transcriptState.extractingVideoId}
          onSelectVideo={(video) => {
            void extractTranscript(video);
          }}
          onClose={handlePanelClose}
          {...(transcriptState.error ? { error: transcriptState.error } : {})}
          {...(transcriptState.detectionHint
            ? { detectionHint: transcriptState.detectionHint }
            : {})}
          {...(transcriptState.authRequired ? { authRequired: transcriptState.authRequired } : {})}
          extractionResults={transcriptState.extractionsByVideoId}
          aiTranscription={transcriptState.aiTranscription}
          onTranscribeWithAI={(video) => {
            void transcribeWithAI(video);
          }}
          onCancelAi={() => {
            void cancelAiTranscription();
          }}
        />
      )}

      {/* Empty state when no videos detected */}
      {!showVideoList && !transcriptState.lastTranscript && !transcriptState.isDetecting && (
        <div className="lockin-transcript-empty">
          <p>No videos detected on this page.</p>
          <button
            className="lockin-transcript-retry-btn"
            onClick={() => detectAndAutoExtract()}
            type="button"
          >
            Scan again
          </button>
        </div>
      )}
    </div>
  );
}
