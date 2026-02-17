import type { DetectedVideo } from '@core/transcripts/types';
import type { AiTranscriptionUiState, VideoExtractionResult } from './types';
import { isAiTranscriptionBusy, getAiStatusLabel } from './types';

function getAiState(
  video: DetectedVideo,
  aiTranscription: AiTranscriptionUiState,
): {
  aiForVideo: AiTranscriptionUiState | null;
  aiStatus: AiTranscriptionUiState['status'];
  aiIsActive: boolean;
  aiIsFailed: boolean;
  aiIsCanceled: boolean;
  aiIsCompleted: boolean;
  aiErrorMessage: string | null;
} {
  const aiForVideo =
    aiTranscription.video !== null && aiTranscription.video.id === video.id
      ? aiTranscription
      : null;
  const aiStatus = aiForVideo?.status ?? 'idle';
  const aiIsActive = aiForVideo !== null ? isAiTranscriptionBusy(aiStatus) : false;
  const aiErrorMessage =
    aiForVideo?.error !== null && aiForVideo?.error !== undefined && aiForVideo.error.length > 0
      ? aiForVideo.error
      : null;
  return {
    aiForVideo,
    aiStatus,
    aiIsActive,
    aiIsFailed: aiForVideo?.status === 'failed',
    aiIsCanceled: aiForVideo?.status === 'canceled',
    aiIsCompleted: aiForVideo?.status === 'completed',
    aiErrorMessage,
  };
}

function getExtractionState(extractionResult?: VideoExtractionResult): {
  noCaptions: boolean;
  aiAvailable: boolean;
  extractionError: string | null;
} {
  const noCaptions =
    extractionResult !== undefined &&
    extractionResult.success === false &&
    extractionResult.errorCode === 'NO_CAPTIONS';
  const aiAvailable = noCaptions && extractionResult?.aiTranscriptionAvailable === true;
  const extractionError =
    extractionResult !== undefined && extractionResult.success === false && !aiAvailable
      ? extractionResult.error !== undefined &&
        extractionResult.error !== null &&
        extractionResult.error.length > 0
        ? extractionResult.error
        : 'Failed to extract transcript'
      : null;
  return { noCaptions, aiAvailable, extractionError };
}

function resolveProgressMessage(aiForVideo: AiTranscriptionUiState | null): string {
  if (
    aiForVideo?.progressMessage !== undefined &&
    aiForVideo.progressMessage !== null &&
    aiForVideo.progressMessage.length > 0
  ) {
    return aiForVideo.progressMessage;
  }
  return 'Working on your transcript. This can take a few minutes.';
}

function resolveAiActionSubtitle({
  disableAiAction,
  isAiBusy,
  aiIsActive,
}: {
  disableAiAction: boolean;
  isAiBusy: boolean;
  aiIsActive: boolean;
}): string {
  if (disableAiAction && isAiBusy && !aiIsActive) {
    return 'Another AI transcription is already running.';
  }
  return 'Generates captions when none are available.';
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
}): {
  showAiProgress: boolean;
  showAiError: boolean;
  showAiAction: boolean;
  disableAiAction: boolean;
  progressLabel: string;
  progressMessage: string;
  progressPercent: number | null | undefined;
  aiActionSubtitle: string;
  aiErrorMessage: string | null;
} {
  const showAiProgress = aiIsActive;
  const showAiError = aiAvailable && (aiIsFailed || aiIsCanceled);
  const showAiAction = aiAvailable && !aiIsActive && !aiIsCompleted;
  const disableAiAction = isExtracting || (isAiBusy && !aiIsActive);
  return {
    showAiProgress,
    showAiError,
    showAiAction,
    disableAiAction,
    progressLabel: getAiStatusLabel(aiStatus),
    progressMessage: resolveProgressMessage(aiForVideo),
    progressPercent: aiForVideo?.progressPercent,
    aiActionSubtitle: resolveAiActionSubtitle({ disableAiAction, isAiBusy, aiIsActive }),
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
}): {
  aiAvailable: boolean;
  extractionError: string | null;
  aiIsCanceled: boolean;
  showAiProgress: boolean;
  showAiError: boolean;
  showAiAction: boolean;
  disableAiAction: boolean;
  progressLabel: string;
  progressMessage: string;
  progressPercent: number | null | undefined;
  aiActionSubtitle: string;
  aiErrorMessage: string | null;
} {
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
