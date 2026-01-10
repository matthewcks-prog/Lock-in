/**
 * Shared types for transcript hooks
 */

import type { DetectedVideo, TranscriptResult } from '@core/transcripts/types';

// -----------------------------------------------------------------------------
// AI Transcription Types
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

export interface AiTranscriptionState {
    status: AiTranscriptionStatus;
    requestId: string | null;
    jobId: string | null;
    video: DetectedVideo | null;
    progressMessage: string | null;
    progressPercent: number | null;
    error: string | null;
}

// -----------------------------------------------------------------------------
// Extraction Types
// -----------------------------------------------------------------------------

export interface TranscriptResponseData {
    success: boolean;
    transcript?: TranscriptResult;
    error?: string;
    errorCode?: string;
    aiTranscriptionAvailable?: boolean;
}

// -----------------------------------------------------------------------------
// Background Response Types
// -----------------------------------------------------------------------------

export interface BackgroundResponse {
    success?: boolean;
    ok?: boolean;
    data?: TranscriptResponseData;
    error?: string;
    errorCode?: string;
    transcript?: TranscriptResult;
    aiTranscriptionAvailable?: boolean;
    videos?: DetectedVideo[];
}

export interface AiTranscriptionResponse {
    success: boolean;
    transcript?: TranscriptResult;
    error?: string;
    errorCode?: string;
    jobId?: string;
    status?: string;
    requestId?: string;
}

export interface AiTranscriptionProgressPayload {
    requestId?: string;
    jobId?: string | null;
    stage?: string | null;
    message?: string | null;
    percent?: number | null;
}

export interface PanoptoMediaUrlResponse {
    success: boolean;
    mediaUrl?: string;
    error?: string;
}

// -----------------------------------------------------------------------------
// Background Communication
// -----------------------------------------------------------------------------

/**
 * Send a message to the background script and await response
 */
export async function sendToBackground<T>(message: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
            reject(new Error('Chrome runtime not available'));
            return;
        }

        chrome.runtime.sendMessage(message, (response: T) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(response);
            }
        });
    });
}

// -----------------------------------------------------------------------------
// Response Normalization
// -----------------------------------------------------------------------------

/**
 * Normalize the background script response for transcript extraction
 */
export function normalizeTranscriptResponse(response: BackgroundResponse): TranscriptResponseData {
    const data = response.data as TranscriptResponseData | undefined;
    if (data) {
        return {
            ...data,
            errorCode: data.errorCode ?? response.errorCode,
            aiTranscriptionAvailable: data.aiTranscriptionAvailable ?? response.aiTranscriptionAvailable,
        };
    }

    return {
        success: response.success ?? false,
        transcript: response.transcript,
        error: response.error,
        errorCode: response.errorCode,
        aiTranscriptionAvailable: response.aiTranscriptionAvailable,
    };
}

/**
 * Normalize the background script response for video detection
 */
export function normalizeVideoDetectionResponse(response: BackgroundResponse): DetectedVideo[] {
    if (Array.isArray(response.videos)) {
        return response.videos;
    }
    const data = response.data as { videos?: DetectedVideo[] } | undefined;
    if (Array.isArray(data?.videos)) {
        return data.videos;
    }
    return [];
}

// -----------------------------------------------------------------------------
// AI Transcription Helpers
// -----------------------------------------------------------------------------

export function mapStageToStatus(
    stage: string | null | undefined,
    fallback: AiTranscriptionStatus,
): AiTranscriptionStatus {
    switch (stage) {
        case 'starting':
            return 'starting';
        case 'uploading':
            return 'uploading';
        case 'processing':
            return 'processing';
        case 'polling':
            return 'polling';
        case 'completed':
            return 'completed';
        case 'failed':
            return 'failed';
        case 'canceled':
            return 'canceled';
        default:
            return fallback;
    }
}

export function isAiTranscriptionBusy(status: AiTranscriptionStatus): boolean {
    return (
        status === 'starting' ||
        status === 'uploading' ||
        status === 'processing' ||
        status === 'polling'
    );
}

export function formatAiProgressMessage(
    stage: string | null | undefined,
    message: string | null | undefined,
    percent: number | null | undefined,
    fallback: string | null,
): string | null {
    if (message) {
        return typeof percent === 'number' ? `${message} (${Math.round(percent)}%)` : message;
    }

    const stageLabel = (() => {
        switch (stage) {
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
                return null;
        }
    })();

    if (!stageLabel) return fallback;
    if (typeof percent === 'number') {
        return `${stageLabel} (${Math.round(percent)}%)`;
    }
    return stageLabel;
}

// -----------------------------------------------------------------------------
// Duration Formatting
// -----------------------------------------------------------------------------

export function formatDurationForConfirm(durationMs?: number): string | null {
    if (!durationMs || durationMs <= 0) return null;
    const totalSeconds = Math.round(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

export const LONG_DURATION_CONFIRM_MS = 20 * 60 * 1000;

export const INITIAL_AI_TRANSCRIPTION_STATE: AiTranscriptionState = {
    status: 'idle',
    requestId: null,
    jobId: null,
    video: null,
    progressMessage: null,
    progressPercent: null,
    error: null,
};
