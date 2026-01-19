/**
 * Transcript-specific types for video list UI
 *
 * These types extend the generic video types with transcript-specific
 * state for extraction and AI transcription.
 */

import type { DetectedVideo } from '@core/transcripts/types';

// -----------------------------------------------------------------------------
// AI Transcription UI Types
// -----------------------------------------------------------------------------

export type AiTranscriptionStatus =
  | 'idle'
  | 'starting'
  | 'uploading'
  | 'processing'
  | 'polling'
  | 'completed'
  | 'failed'
  | 'canceled';

export interface AiTranscriptionUiState {
  status: AiTranscriptionStatus;
  video: DetectedVideo | null;
  progressMessage?: string | null;
  progressPercent?: number | null;
  error?: string | null;
}

// -----------------------------------------------------------------------------
// Extraction Result Types
// -----------------------------------------------------------------------------

export interface VideoExtractionResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  aiTranscriptionAvailable?: boolean;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

export function isAiTranscriptionBusy(status: AiTranscriptionStatus): boolean {
  return (
    status === 'starting' ||
    status === 'uploading' ||
    status === 'processing' ||
    status === 'polling'
  );
}

export function getAiStatusLabel(status: AiTranscriptionStatus): string {
  switch (status) {
    case 'starting':
      return 'Preparing AI transcription';
    case 'uploading':
      return 'Uploading media';
    case 'processing':
      return 'Processing audio';
    case 'polling':
      return 'Transcribing';
    case 'completed':
      return 'Transcript ready';
    case 'failed':
      return 'AI transcription failed';
    case 'canceled':
      return 'Transcription canceled';
    default:
      return 'AI transcription';
  }
}
