/**
 * Transcript Hooks
 *
 * Re-exports all transcript-related hooks for easy importing.
 */

export { useVideoDetection } from './useVideoDetection';
export type { VideoDetectionState, UseVideoDetectionResult } from './useVideoDetection';

export { useTranscriptExtraction } from './useTranscriptExtraction';
export type {
    TranscriptExtractionState,
    UseTranscriptExtractionResult,
} from './useTranscriptExtraction';

export { useAiTranscription } from './useAiTranscription';
export type { UseAiTranscriptionResult } from './useAiTranscription';

export * from './types';
