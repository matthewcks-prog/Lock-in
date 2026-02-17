/**
 * Shared types for transcript hooks
 */

import type { DetectedVideo, TranscriptResult } from '@core/transcripts/types';

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const LONG_DURATION_CONFIRM_MINUTES = 20;

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
    const runtime = globalThis.chrome?.runtime;
    if (runtime === undefined) {
      reject(new Error('Chrome runtime not available'));
      return;
    }

    runtime.sendMessage(message, (response: T) => {
      const lastError = runtime.lastError;
      if (lastError !== undefined) {
        reject(new Error(lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// -----------------------------------------------------------------------------
// Response Normalization
// -----------------------------------------------------------------------------

function copyResponseFields(
  target: TranscriptResponseData,
  source: {
    transcript?: TranscriptResult;
    error?: string;
    errorCode?: string;
    aiTranscriptionAvailable?: boolean;
  },
): void {
  if (source.transcript !== undefined) {
    target.transcript = source.transcript;
  }
  if (source.error !== undefined) {
    target.error = source.error;
  }
  if (source.errorCode !== undefined) {
    target.errorCode = source.errorCode;
  }
  if (source.aiTranscriptionAvailable !== undefined) {
    target.aiTranscriptionAvailable = source.aiTranscriptionAvailable;
  }
}

function mergeTopLevelFallbacks(
  target: TranscriptResponseData,
  response: BackgroundResponse,
): void {
  if (target.errorCode === undefined && response.errorCode !== undefined) {
    target.errorCode = response.errorCode;
  }
  if (
    target.aiTranscriptionAvailable === undefined &&
    response.aiTranscriptionAvailable !== undefined
  ) {
    target.aiTranscriptionAvailable = response.aiTranscriptionAvailable;
  }
}

/**
 * Normalize the background script response for transcript extraction
 */
export function normalizeTranscriptResponse(response: BackgroundResponse): TranscriptResponseData {
  const data = response.data;
  if (data !== undefined) {
    const normalized: TranscriptResponseData = { success: data.success };
    copyResponseFields(normalized, data);
    mergeTopLevelFallbacks(normalized, response);
    return normalized;
  }

  const normalized: TranscriptResponseData = { success: response.success ?? false };
  copyResponseFields(normalized, response);
  return normalized;
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
    case null:
    case undefined:
      return fallback;
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
  if (message !== null && message !== undefined && message.length > 0) {
    return typeof percent === 'number' ? `${message} (${Math.round(percent)}%)` : message;
  }

  const stageLabel = (() => {
    switch (stage) {
      case null:
      case undefined:
        return null;
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

  if (stageLabel === null) return fallback;
  if (typeof percent === 'number') {
    return `${stageLabel} (${Math.round(percent)}%)`;
  }
  return stageLabel;
}

// -----------------------------------------------------------------------------
// Duration Formatting
// -----------------------------------------------------------------------------

export function formatDurationForConfirm(durationMs?: number): string | null {
  if (
    durationMs === undefined ||
    Number.isNaN(durationMs) ||
    !Number.isFinite(durationMs) ||
    durationMs <= 0
  ) {
    return null;
  }
  const totalSeconds = Math.round(durationMs / MS_PER_SECOND);
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;

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

export const LONG_DURATION_CONFIRM_MS =
  LONG_DURATION_CONFIRM_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;

export const INITIAL_AI_TRANSCRIPTION_STATE: AiTranscriptionState = {
  status: 'idle',
  requestId: null,
  jobId: null,
  video: null,
  progressMessage: null,
  progressPercent: null,
  error: null,
};
