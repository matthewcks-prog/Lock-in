/**
 * TranscriptVideoListPanel Component
 *
 * Wraps the generic VideoListPanel with transcript-specific features:
 * - "No transcript" badges for videos without captions
 * - AI transcription actions and progress
 * - Extraction state management
 *
 * This is the component that LockInSidebar.tsx should import.
 */

import type { DetectedVideo } from '@core/transcripts/types';
import { VideoListPanel } from '../../videos';
import { TranscriptVideoStatus } from './TranscriptVideoStatus';
import type { AiTranscriptionUiState, VideoExtractionResult } from './types';
import { isAiTranscriptionBusy } from './types';

// Re-export types for consumers
export type { AiTranscriptionUiState, VideoExtractionResult } from './types';

export interface TranscriptVideoListPanelProps {
  /** List of detected videos */
  videos: DetectedVideo[];
  /** Whether video detection is in progress */
  isLoading: boolean;
  /** Callback when a video is selected for extraction */
  onSelectVideo: (video: DetectedVideo) => void;
  /** Callback to close the panel */
  onClose: () => void;

  // State props
  /** Error message if detection failed */
  error?: string;
  /** Optional hint to show when no videos are detected */
  detectionHint?: string;
  /** Auth required info for sign-in prompt */
  authRequired?: {
    provider: string;
    signInUrl: string;
  };

  // Transcript-specific props
  /** Whether transcript extraction is in progress */
  isExtracting: boolean;
  /** ID of video currently being extracted */
  extractingVideoId: string | null;
  /** Per-video extraction results */
  extractionResults: Record<string, VideoExtractionResult>;
  /** AI transcription state */
  aiTranscription: AiTranscriptionUiState;
  /** Callback to start AI transcription */
  onTranscribeWithAI: (video: DetectedVideo) => void;
  /** Callback to cancel AI transcription */
  onCancelAi: () => void;
}

function buildPanelOptionalProps({
  error,
  detectionHint,
  authRequired,
}: {
  error: string | undefined;
  detectionHint: string | undefined;
  authRequired: { provider: string; signInUrl: string } | undefined;
}): {
  error?: string;
  detectionHint?: string;
  authRequired?: { provider: string; signInUrl: string };
} {
  const panelOptionalProps: {
    error?: string;
    detectionHint?: string;
    authRequired?: { provider: string; signInUrl: string };
  } = {};

  if (error !== undefined && error.length > 0) {
    panelOptionalProps.error = error;
  }
  if (detectionHint !== undefined && detectionHint.length > 0) {
    panelOptionalProps.detectionHint = detectionHint;
  }
  if (authRequired !== undefined) {
    panelOptionalProps.authRequired = authRequired;
  }

  return panelOptionalProps;
}

function isVideoDisabledForExtraction({
  video,
  isExtracting,
  extractingVideoId,
  isAiBusy,
}: {
  video: DetectedVideo;
  isExtracting: boolean;
  extractingVideoId: string | null;
  isAiBusy: boolean;
}): boolean {
  const isThisExtracting = isExtracting && extractingVideoId === video.id;
  const isAnotherExtracting = isExtracting && extractingVideoId !== video.id;
  return isAnotherExtracting || (isAiBusy && !isThisExtracting);
}

function renderNoTranscriptBadge({
  video,
  extractionResults,
}: {
  video: DetectedVideo;
  extractionResults: Record<string, VideoExtractionResult>;
}): JSX.Element | null {
  const result = extractionResults[video.id];
  const noCaptions =
    result !== undefined && result.success === false && result.errorCode === 'NO_CAPTIONS';
  return noCaptions ? <span className="lockin-video-item-badge">No transcript</span> : null;
}

export function TranscriptVideoListPanel({
  videos,
  isLoading,
  onSelectVideo,
  onClose,
  error,
  detectionHint,
  authRequired,
  isExtracting,
  extractingVideoId,
  extractionResults,
  aiTranscription,
  onTranscribeWithAI,
  onCancelAi,
}: TranscriptVideoListPanelProps): JSX.Element {
  const isAiBusy = isAiTranscriptionBusy(aiTranscription.status);

  return (
    <VideoListPanel
      videos={videos}
      isLoading={isLoading}
      onSelectVideo={onSelectVideo}
      onClose={onClose}
      {...buildPanelOptionalProps({ error, detectionHint, authRequired })}
      selectedVideoId={extractingVideoId}
      isVideoDisabled={(video) =>
        isVideoDisabledForExtraction({ video, isExtracting, extractingVideoId, isAiBusy })
      }
      renderItemBadge={({ video }) => renderNoTranscriptBadge({ video, extractionResults })}
      renderItemActions={({ video }) => (
        <TranscriptVideoStatus
          video={video}
          aiTranscription={aiTranscription}
          isExtracting={isExtracting}
          isAiBusy={isAiBusy}
          onTranscribeWithAI={onTranscribeWithAI}
          onCancelAi={onCancelAi}
          {...(extractionResults[video.id] !== undefined
            ? { extractionResult: extractionResults[video.id] }
            : {})}
        />
      )}
    />
  );
}
