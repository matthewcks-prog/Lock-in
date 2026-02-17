/**
 * TranscriptToolContent Component
 *
 * Wraps existing Transcript UI for use in the Study Tools framework.
 * Reuses useTranscripts hook and TranscriptVideoListPanel - no duplication of logic.
 */

import { useEffect, useCallback } from 'react';
import { useTranscripts } from '../transcripts/useTranscripts';
import { TranscriptVideoListPanel } from '../transcripts/components';
import { TranscriptMessage } from '../transcripts/TranscriptMessage';
import { useNoteSaveContext } from '../contexts/NoteSaveContext';

type TranscriptToolState = ReturnType<typeof useTranscripts>['state'];
type LastTranscript = TranscriptToolState['lastTranscript'];

interface PanelOptionalProps {
  error?: string;
  detectionHint?: string;
  authRequired?: { provider: string; signInUrl: string };
}

function buildPanelOptionalProps(state: TranscriptToolState): PanelOptionalProps {
  const props: PanelOptionalProps = {};
  if (state.error !== null && state.error.length > 0) {
    props.error = state.error;
  }
  if (state.detectionHint !== null && state.detectionHint.length > 0) {
    props.detectionHint = state.detectionHint;
  }
  if (state.authRequired !== undefined) {
    props.authRequired = state.authRequired;
  }
  return props;
}

function hasTranscript(
  lastTranscript: LastTranscript,
): lastTranscript is NonNullable<LastTranscript> {
  return lastTranscript !== null && lastTranscript !== undefined;
}

function useAutoDetectOnMount({
  videoCount,
  hasLastTranscript,
  detectAndAutoExtract,
}: {
  videoCount: number;
  hasLastTranscript: boolean;
  detectAndAutoExtract: () => void;
}): void {
  useEffect(() => {
    if (videoCount === 0 && !hasLastTranscript) {
      void detectAndAutoExtract();
    }
  }, []);
}

function usePanelCloseAction({
  closeVideoList,
  clearError,
}: {
  closeVideoList: ReturnType<typeof useTranscripts>['closeVideoList'];
  clearError: ReturnType<typeof useTranscripts>['clearError'];
}): () => void {
  return useCallback(() => {
    closeVideoList();
    clearError();
  }, [clearError, closeVideoList]);
}

function shouldShowVideoList(state: TranscriptToolState, hasLastTranscript: boolean): boolean {
  return (
    state.isVideoListOpen || (!hasLastTranscript && state.videos.length > 0) || state.isDetecting
  );
}

function LastTranscriptSection({
  lastTranscript,
  videoCount,
  showVideoList,
  saveNote,
  detectAndAutoExtract,
}: {
  lastTranscript: LastTranscript;
  videoCount: number;
  showVideoList: boolean;
  saveNote: ReturnType<typeof useNoteSaveContext>['saveNote'];
  detectAndAutoExtract: () => void;
}): JSX.Element | null {
  if (!hasTranscript(lastTranscript)) {
    return null;
  }

  return (
    <>
      <TranscriptMessage
        transcript={lastTranscript.transcript}
        video={lastTranscript.video}
        videoTitle={lastTranscript.video.title.length > 0 ? lastTranscript.video.title : 'Video'}
        saveNote={saveNote}
      />
      {videoCount > 1 && !showVideoList && (
        <div className="lockin-transcript-change-video">
          <button
            className="lockin-transcript-change-video-btn"
            onClick={() => {
              void detectAndAutoExtract();
            }}
            type="button"
          >
            Change video ({videoCount} available)
          </button>
        </div>
      )}
    </>
  );
}

function VideoListSection({
  showVideoList,
  state,
  panelOptionalProps,
  handlePanelClose,
  extractTranscript,
  transcribeWithAI,
  cancelAiTranscription,
}: {
  showVideoList: boolean;
  state: TranscriptToolState;
  panelOptionalProps: PanelOptionalProps;
  handlePanelClose: () => void;
  extractTranscript: ReturnType<typeof useTranscripts>['extractTranscript'];
  transcribeWithAI: ReturnType<typeof useTranscripts>['transcribeWithAI'];
  cancelAiTranscription: ReturnType<typeof useTranscripts>['cancelAiTranscription'];
}): JSX.Element | null {
  if (!showVideoList) {
    return null;
  }

  return (
    <TranscriptVideoListPanel
      videos={state.videos}
      isLoading={state.isDetecting}
      isExtracting={state.isExtracting}
      extractingVideoId={state.extractingVideoId}
      onSelectVideo={(video) => {
        void extractTranscript(video);
      }}
      onClose={handlePanelClose}
      {...panelOptionalProps}
      extractionResults={state.extractionsByVideoId}
      aiTranscription={state.aiTranscription}
      onTranscribeWithAI={(video) => {
        void transcribeWithAI(video);
      }}
      onCancelAi={() => {
        void cancelAiTranscription();
      }}
    />
  );
}

function EmptyStateSection({
  showVideoList,
  hasLastTranscript,
  isDetecting,
  detectAndAutoExtract,
}: {
  showVideoList: boolean;
  hasLastTranscript: boolean;
  isDetecting: boolean;
  detectAndAutoExtract: () => void;
}): JSX.Element | null {
  if (showVideoList || hasLastTranscript || isDetecting) {
    return null;
  }

  return (
    <div className="lockin-transcript-empty">
      <p>No videos detected on this page.</p>
      <button
        className="lockin-transcript-retry-btn"
        onClick={() => {
          void detectAndAutoExtract();
        }}
        type="button"
      >
        Scan again
      </button>
    </div>
  );
}

export function TranscriptToolContent(): JSX.Element {
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
  const lastTranscript = transcriptState.lastTranscript;
  const hasLastTranscript = hasTranscript(lastTranscript);
  const showVideoList = shouldShowVideoList(transcriptState, hasLastTranscript);
  const panelOptionalProps = buildPanelOptionalProps(transcriptState);

  useAutoDetectOnMount({
    videoCount: transcriptState.videos.length,
    hasLastTranscript,
    detectAndAutoExtract,
  });
  const handlePanelClose = usePanelCloseAction({ closeVideoList, clearError });

  return (
    <div className="lockin-tool-content lockin-transcript-tool">
      <LastTranscriptSection
        lastTranscript={lastTranscript}
        videoCount={transcriptState.videos.length}
        showVideoList={showVideoList}
        saveNote={saveNote}
        detectAndAutoExtract={detectAndAutoExtract}
      />
      <VideoListSection
        showVideoList={showVideoList}
        state={transcriptState}
        panelOptionalProps={panelOptionalProps}
        handlePanelClose={handlePanelClose}
        extractTranscript={extractTranscript}
        transcribeWithAI={transcribeWithAI}
        cancelAiTranscription={cancelAiTranscription}
      />
      <EmptyStateSection
        showVideoList={showVideoList}
        hasLastTranscript={hasLastTranscript}
        isDetecting={transcriptState.isDetecting}
        detectAndAutoExtract={detectAndAutoExtract}
      />
    </div>
  );
}
