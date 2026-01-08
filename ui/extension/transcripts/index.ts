/**
 * Transcript UI Components
 *
 * Components and hooks for video transcript extraction in the extension sidebar.
 */

export { VideoListPanel } from './VideoListPanel';
export { TranscriptMessage } from './TranscriptMessage';
export { useTranscripts } from './useTranscripts';

// Focused hooks for granular control
export {
    useVideoDetection,
    useTranscriptExtraction,
    useAiTranscription,
} from './hooks';
