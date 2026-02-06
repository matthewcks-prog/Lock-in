import type { DetectedVideo } from '@core/transcripts/types';
import type { AiTranscriptionUiState, VideoExtractionResult } from './types';
import { isAiTranscriptionBusy, getAiStatusLabel } from './types';

function getAiState(video: DetectedVideo, aiTranscription: AiTranscriptionUiState) {
  const aiForVideo =
    aiTranscription.video && aiTranscription.video.id === video.id ? aiTranscription : null;
  const aiStatus = aiForVideo?.status ?? 'idle';
  const aiIsActive = aiForVideo ? isAiTranscriptionBusy(aiStatus) : false;
  return {
    aiForVideo,
    aiStatus,
    aiIsActive,
    aiIsFailed: aiForVideo?.status === 'failed',
    aiIsCanceled: aiForVideo?.status === 'canceled',
    aiIsCompleted: aiForVideo?.status === 'completed',
    aiErrorMessage: aiForVideo?.error || null,
  };
}

function getExtractionState(extractionResult?: VideoExtractionResult) {
  const noCaptions =
    extractionResult && !extractionResult.success && extractionResult.errorCode === 'NO_CAPTIONS';
  const aiAvailable = Boolean(noCaptions && extractionResult?.aiTranscriptionAvailable);
  const extractionError =
    extractionResult && !extractionResult.success && !aiAvailable
      ? extractionResult.error || 'Failed to extract transcript'
      : null;
  return { noCaptions, aiAvailable, extractionError };
}

function getAiUiState({
  aiForVideo,
  aiStatus,
  aiIsActive,
  aiIsFailed,
  aiIsCanceled,
  aiIsCompleted,
  aiErrorMessage,
  aiAvailable,
  isExtracting,
  isAiBusy,
}: {
  aiForVideo: AiTranscriptionUiState | null;
  aiStatus: AiTranscriptionUiState['status'];
  aiIsActive: boolean;
  aiIsFailed: boolean;
  aiIsCanceled: boolean;
  aiIsCompleted: boolean;
  aiErrorMessage: string | null;
  aiAvailable: boolean;
  isExtracting: boolean;
  isAiBusy: boolean;
}) {
  const showAiProgress = aiIsActive;
  const showAiError = aiAvailable && (aiIsFailed || aiIsCanceled);
  const showAiAction = aiAvailable && !aiIsActive && !aiIsCompleted;
  const disableAiAction = isExtracting || (isAiBusy && !aiIsActive);
  const progressLabel = getAiStatusLabel(aiStatus);
  const progressMessage =
    aiForVideo?.progressMessage || 'Working on your transcript. This can take a few minutes.';
  const progressPercent = aiForVideo?.progressPercent;
  const aiActionSubtitle =
    disableAiAction && isAiBusy && !aiIsActive
      ? 'Another AI transcription is already running.'
      : 'Generates captions when none are available.';

  return {
    showAiProgress,
    showAiError,
    showAiAction,
    disableAiAction,
    progressLabel,
    progressMessage,
    progressPercent,
    aiActionSubtitle,
    aiErrorMessage,
  };
}

export function resolveTranscriptVideoStatusState({
  video,
  extractionResult,
  aiTranscription,
  isExtracting,
  isAiBusy,
}: {
  video: DetectedVideo;
  extractionResult?: VideoExtractionResult;
  aiTranscription: AiTranscriptionUiState;
  isExtracting: boolean;
  isAiBusy: boolean;
}) {
  const aiState = getAiState(video, aiTranscription);
  const { aiAvailable, extractionError } = getExtractionState(extractionResult);
  const uiState = getAiUiState({
    aiForVideo: aiState.aiForVideo,
    aiStatus: aiState.aiStatus,
    aiIsActive: aiState.aiIsActive,
    aiIsFailed: aiState.aiIsFailed,
    aiIsCanceled: aiState.aiIsCanceled,
    aiIsCompleted: aiState.aiIsCompleted,
    aiErrorMessage: aiState.aiErrorMessage,
    aiAvailable,
    isExtracting,
    isAiBusy,
  });

  return {
    aiAvailable,
    extractionError,
    aiIsCanceled: aiState.aiIsCanceled,
    ...uiState,
  };
}
