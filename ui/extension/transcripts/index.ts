/**
 * Transcript UI Components
 *
 * Components and hooks for video transcript extraction in the extension sidebar.
 */

// Transcript-specific components (wrapping generic video components)
export {
    TranscriptVideoListPanel,
    TranscriptVideoStatus,
    isAiTranscriptionBusy,
    getAiStatusLabel,
} from './components';
export type {
    TranscriptVideoListPanelProps,
    AiTranscriptionUiState,
    VideoExtractionResult,
    AiTranscriptionStatus,
} from './components';

export { TranscriptMessage } from './TranscriptMessage';
export { useTranscripts } from './useTranscripts';

// Focused hooks for granular control
export {
    useVideoDetection,
    useTranscriptExtraction,
    useAiTranscription,
} from './hooks';
