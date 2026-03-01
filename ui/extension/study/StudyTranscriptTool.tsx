import type { DetectedVideo } from '@core/transcripts/types';
import { useEffect } from 'react';
import { isAiTranscriptionBusy } from '../transcripts/components';
import { useNoteSaveContext } from '../contexts/NoteSaveContext';
import { TranscriptMessage } from '../transcripts/TranscriptMessage';
import { useTranscripts } from '../transcripts/useTranscripts';
import { useStudySummary } from './StudySummaryContext';
import { useStudyWorkspace } from './StudyWorkspaceContext';

type TranscriptsModel = ReturnType<typeof useTranscripts>;

function useAutoExtractSelectedVideo({
  selectedVideo,
  extractTranscript,
  isExtracting,
  extractingVideoId,
  hasTranscriptForSelectedVideo,
}: {
  selectedVideo: DetectedVideo;
  extractTranscript: TranscriptsModel['extractTranscript'];
  isExtracting: boolean;
  extractingVideoId: string | null;
  hasTranscriptForSelectedVideo: boolean;
}): void {
  useEffect(() => {
    if (hasTranscriptForSelectedVideo) return;
    if (isExtracting && extractingVideoId === selectedVideo.id) return;
    void extractTranscript(selectedVideo);
  }, [
    extractTranscript,
    extractingVideoId,
    hasTranscriptForSelectedVideo,
    isExtracting,
    selectedVideo,
  ]);
}

function resolveTranscriptForVideo({
  model,
  videoId,
}: {
  model: TranscriptsModel;
  videoId: string;
}): NonNullable<TranscriptsModel['state']['lastTranscript']>['transcript'] | null {
  const fromLastTranscript =
    model.state.lastTranscript !== null && model.state.lastTranscript.video.id === videoId
      ? model.state.lastTranscript.transcript
      : null;
  const fromExtraction = model.state.extractionsByVideoId[videoId]?.transcript ?? null;
  return fromLastTranscript ?? fromExtraction;
}

function TranscriptStatusMessages({
  model,
  selectedVideoId,
  isAiBusyForSelectedVideo,
}: {
  model: TranscriptsModel;
  selectedVideoId: string;
  isAiBusyForSelectedVideo: boolean;
}): JSX.Element {
  return (
    <>
      {model.state.isExtracting && model.state.extractingVideoId === selectedVideoId && (
        <p className="lockin-study-transcript-status-copy">Extracting transcript...</p>
      )}
      {model.state.extractionsByVideoId[selectedVideoId]?.error !== undefined &&
        model.state.extractionsByVideoId[selectedVideoId]?.error?.length > 0 && (
          <p className="lockin-study-transcript-status-error">
            {model.state.extractionsByVideoId[selectedVideoId]?.error}
          </p>
        )}
      {isAiBusyForSelectedVideo && (
        <p className="lockin-study-transcript-status-copy">
          {model.state.aiTranscription.progressMessage ?? 'AI transcription in progress...'}
        </p>
      )}
    </>
  );
}

function TranscriptStatusActions({
  model,
  selectedVideo,
  isAiBusyForSelectedVideo,
}: {
  model: TranscriptsModel;
  selectedVideo: DetectedVideo;
  isAiBusyForSelectedVideo: boolean;
}): JSX.Element {
  const selectedResult = model.state.extractionsByVideoId[selectedVideo.id];
  return (
    <div className="lockin-study-transcript-actions">
      <button
        type="button"
        className="lockin-transcript-change-video-btn"
        onClick={() => {
          void model.extractTranscript(selectedVideo);
        }}
        disabled={model.state.isExtracting || isAiBusyForSelectedVideo}
      >
        Extract transcript
      </button>
      {selectedResult?.aiTranscriptionAvailable === true && !isAiBusyForSelectedVideo && (
        <button
          type="button"
          className="lockin-transcript-change-video-btn"
          onClick={() => {
            void model.transcribeWithAI(selectedVideo);
          }}
          disabled={model.state.isExtracting}
        >
          Transcribe with AI
        </button>
      )}
      {isAiBusyForSelectedVideo && (
        <button
          type="button"
          className="lockin-transcript-change-video-btn"
          onClick={() => {
            void model.cancelAiTranscription();
          }}
        >
          Cancel AI
        </button>
      )}
    </div>
  );
}

function renderTranscriptStatus({
  model,
  selectedVideo,
  isAiBusyForSelectedVideo,
}: {
  model: TranscriptsModel;
  selectedVideo: DetectedVideo;
  isAiBusyForSelectedVideo: boolean;
}): JSX.Element {
  return (
    <div className="lockin-study-transcript-status">
      <TranscriptStatusMessages
        model={model}
        selectedVideoId={selectedVideo.id}
        isAiBusyForSelectedVideo={isAiBusyForSelectedVideo}
      />
      <TranscriptStatusActions
        model={model}
        selectedVideo={selectedVideo}
        isAiBusyForSelectedVideo={isAiBusyForSelectedVideo}
      />
    </div>
  );
}

export function StudyTranscriptTool(): JSX.Element {
  const { selectedVideo } = useStudyWorkspace();
  const { registerTranscript } = useStudySummary();
  const { saveNote } = useNoteSaveContext();
  const model = useTranscripts();

  if (selectedVideo === null) {
    return <div className="lockin-study-tool-empty">Select a video to view its transcript.</div>;
  }

  const transcript = resolveTranscriptForVideo({ model, videoId: selectedVideo.id });
  const hasTranscriptForSelectedVideo = transcript !== null;
  const isAiBusyForSelectedVideo =
    isAiTranscriptionBusy(model.state.aiTranscription.status) &&
    model.state.aiTranscription.video?.id === selectedVideo.id;

  useEffect(() => {
    if (transcript === null) return;
    registerTranscript(selectedVideo.id, transcript);
  }, [registerTranscript, selectedVideo.id, transcript]);

  useAutoExtractSelectedVideo({
    selectedVideo,
    extractTranscript: model.extractTranscript,
    isExtracting: model.state.isExtracting,
    extractingVideoId: model.state.extractingVideoId,
    hasTranscriptForSelectedVideo,
  });

  if (hasTranscriptForSelectedVideo) {
    return (
      <div className="lockin-study-transcript-shell">
        <TranscriptMessage
          transcript={transcript}
          video={selectedVideo}
          videoTitle={selectedVideo.title.length > 0 ? selectedVideo.title : 'Video'}
          showHeaderTitle={false}
          saveNote={saveNote}
        />
      </div>
    );
  }

  return renderTranscriptStatus({ model, selectedVideo, isAiBusyForSelectedVideo });
}
