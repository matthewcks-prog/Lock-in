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
}: TranscriptVideoListPanelProps) {
  const isAiBusy = isAiTranscriptionBusy(aiTranscription.status);

  return (
    <VideoListPanel
      videos={videos}
      isLoading={isLoading}
      onSelectVideo={onSelectVideo}
      onClose={onClose}
      error={error}
      detectionHint={detectionHint}
      authRequired={authRequired}
      selectedVideoId={extractingVideoId}
      isVideoDisabled={(video) => {
        // Disable if another video is extracting or AI is busy on a different video
        const isThisExtracting = isExtracting && extractingVideoId === video.id;
        const isAnotherExtracting = isExtracting && extractingVideoId !== video.id;
        return isAnotherExtracting || (isAiBusy && !isThisExtracting);
      }}
      renderItemBadge={({ video }) => {
        // Show "No transcript" badge for videos without captions
        const result = extractionResults[video.id];
        const noCaptions = result && !result.success && result.errorCode === 'NO_CAPTIONS';
        return noCaptions ? <span className="lockin-video-item-badge">No transcript</span> : null;
      }}
      renderItemActions={({ video }) => (
        <TranscriptVideoStatus
          video={video}
          extractionResult={extractionResults[video.id]}
          aiTranscription={aiTranscription}
          isExtracting={isExtracting}
          isAiBusy={isAiBusy}
          onTranscribeWithAI={onTranscribeWithAI}
          onCancelAi={onCancelAi}
        />
      )}
    />
  );
}
