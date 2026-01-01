/**
 * useTranscripts Hook
 *
 * Manages transcript extraction state and communication with background script.
 * Detects videos from multiple providers (Panopto, Echo360).
 *
 * Uses core detection logic from core/transcripts/videoDetection.ts
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { DetectedVideo, TranscriptResult } from '@core/transcripts/types';
import {
  detectVideosSync,
  collectIframeInfo,
  extractEcho360Context,
  getEcho360PageType,
} from '@core/transcripts/videoDetection';
import { extractHtml5TranscriptFromDom } from './extractHtml5TranscriptFromDom';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AiTranscriptionStatus =
  | 'idle'
  | 'starting'
  | 'uploading'
  | 'processing'
  | 'polling'
  | 'completed'
  | 'failed'
  | 'canceled';

interface AiTranscriptionState {
  status: AiTranscriptionStatus;
  requestId: string | null;
  jobId: string | null;
  video: DetectedVideo | null;
  progressMessage: string | null;
  error: string | null;
}

interface TranscriptState {
  /** Whether the video list panel is open */
  isVideoListOpen: boolean;
  /** Detected videos on the page */
  videos: DetectedVideo[];
  /** Whether video detection is in progress */
  isDetecting: boolean;
  /** Whether transcript extraction is in progress */
  isExtracting: boolean;
  /** ID of video currently being extracted */
  extractingVideoId: string | null;
  /** Error message if any */
  error: string | null;
  /** Last transcript extraction result */
  lastExtraction: {
    video: DetectedVideo;
    result: TranscriptResponseData;
  } | null;
  /** Last extracted transcript */
  lastTranscript: {
    video: DetectedVideo;
    transcript: TranscriptResult;
  } | null;
  /** AI transcription state */
  aiTranscription: AiTranscriptionState;
  /** Auth required info for displaying sign-in prompt */
  authRequired?: {
    provider: string;
    signInUrl: string;
  };
}

interface UseTranscriptsResult {
  state: TranscriptState;
  openVideoList: () => void;
  closeVideoList: () => void;
  detectVideos: () => void;
  /** Detect videos and auto-extract if only one is found */
  detectAndAutoExtract: () => void;
  extractTranscript: (video: DetectedVideo) => Promise<TranscriptResult | null>;
  transcribeWithAI: (
    video: DetectedVideo,
    options?: { languageHint?: string; maxMinutes?: number }
  ) => Promise<TranscriptResult | null>;
  cancelAiTranscription: () => Promise<void>;
  clearError: () => void;
}

interface TranscriptResponseData {
  success: boolean;
  transcript?: TranscriptResult;
  error?: string;
  errorCode?: string;
  aiTranscriptionAvailable?: boolean;
}

interface AiTranscriptionResponse {
  success: boolean;
  transcript?: TranscriptResult;
  error?: string;
  errorCode?: string;
  jobId?: string;
  status?: string;
  requestId?: string;
}

interface AiTranscriptionProgressPayload {
  requestId?: string;
  jobId?: string | null;
  stage?: string | null;
  message?: string | null;
  percent?: number | null;
}

interface BackgroundResponse {
  success?: boolean;
  ok?: boolean;
  data?: TranscriptResponseData | Echo360SyllabusData;
  error?: string;
  transcript?: TranscriptResult;
  aiTranscriptionAvailable?: boolean;
  videos?: DetectedVideo[];
}

interface Echo360SyllabusData {
  success: boolean;
  videos?: DetectedVideo[];
  error?: string;
  errorCode?: string;
}

interface AuthRequiredError {
  type: 'AUTH_REQUIRED';
  provider: string;
  signInUrl: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM Helpers (content script context only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract video title from Echo360 page using multiple strategies
 */
function extractEcho360PageTitle(): string {
  // Strategy 1: Look for specific Echo360 title elements
  const titleSelectors = [
    '[data-testid="lesson-title"]',
    '[class*="lesson-title"]',
    '[class*="video-title"]',
    '.classroom-title',
    'h1[class*="title"]',
    '.header-title',
  ];

  for (const selector of titleSelectors) {
    try {
      const el = document.querySelector(selector);
      const text = el?.textContent?.trim();
      if (text && text.length > 2 && text.length < 500) {
        return text;
      }
    } catch {
      // Selector failed, try next
    }
  }

  // Strategy 2: Check meta tags
  const metaTitle =
    document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
    document.querySelector('meta[name="title"]')?.getAttribute('content');
  if (metaTitle?.trim()) {
    return metaTitle.trim();
  }

  // Strategy 3: Clean up document.title
  let pageTitle = document.title || '';
  pageTitle = pageTitle
    .replace(/\s*[-|–—]\s*(Echo360|Classroom|Player).*$/i, '')
    .trim();
  pageTitle = pageTitle.replace(/^(Video|Recording|Lecture):\s*/i, '').trim();

  if (pageTitle && pageTitle.length > 2) {
    return pageTitle;
  }

  return 'Echo360 Recording';
}

/**
 * Try to extract media ID from Echo360 page DOM
 * Note: This is a simplified version. Complex extraction moved to background script.
 */
function extractMediaIdFromDom(): string | undefined {
  const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

  // Strategy 1: Look for media ID in data attributes
  try {
    const mediaElements = document.querySelectorAll(
      '[data-media-id], [data-mediaid], [data-video-id]'
    );
    for (const el of mediaElements) {
      const mediaId =
        el.getAttribute('data-media-id') ||
        el.getAttribute('data-mediaid') ||
        el.getAttribute('data-video-id');
      if (mediaId && UUID_PATTERN.test(mediaId)) {
        return mediaId;
      }
    }
  } catch {
    // Ignore errors
  }

  // Strategy 2: Look in video elements
  try {
    const videos = document.querySelectorAll('video[data-id], video[id], video[data-media-id]');
    for (const video of videos) {
      const id =
        video.getAttribute('data-id') ||
        video.getAttribute('data-media-id') ||
        video.id;
      if (id && UUID_PATTERN.test(id)) {
        return id;
      }
    }
  } catch {
    // Ignore errors
  }

  return undefined;
}

function formatDurationForConfirm(durationMs?: number): string | null {
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

// ─────────────────────────────────────────────────────────────────────────────
// Background Script Communication
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a message to the background script and await response
 */
async function sendToBackground<T>(message: unknown): Promise<T> {
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

/**
 * Normalize the background script response
 */
function normalizeTranscriptResponse(response: BackgroundResponse): TranscriptResponseData {
  return (
    (response.data as TranscriptResponseData) ?? {
      success: response.success ?? false,
      transcript: response.transcript,
      error: response.error,
      aiTranscriptionAvailable: response.aiTranscriptionAvailable,
    }
  );
}

function mapStageToStatus(
  stage: string | null | undefined,
  fallback: AiTranscriptionStatus
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

function formatAiProgressMessage(
  stage: string | null | undefined,
  message: string | null | undefined,
  percent: number | null | undefined,
  fallback: string | null
): string | null {
  if (message) {
    return typeof percent === 'number'
      ? `${message} (${Math.round(percent)}%)`
      : message;
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

// ─────────────────────────────────────────────────────────────────────────────
// Hook Implementation
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_STATE: TranscriptState = {
  isVideoListOpen: false,
  videos: [],
  isDetecting: false,
  isExtracting: false,
  extractingVideoId: null,
  error: null,
  lastExtraction: null,
  lastTranscript: null,
  aiTranscription: {
    status: 'idle',
    requestId: null,
    jobId: null,
    video: null,
    progressMessage: null,
    error: null,
  },
};

const LONG_DURATION_CONFIRM_MS = 20 * 60 * 1000;

export function useTranscripts(): UseTranscriptsResult {
  const [state, setState] = useState<TranscriptState>(INITIAL_STATE);
  const activeAiRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;

    const listener = (
      message: { type?: string; payload?: AiTranscriptionProgressPayload },
      _sender: chrome.runtime.MessageSender
    ) => {
      if (!message || message.type !== 'TRANSCRIBE_MEDIA_AI_PROGRESS') return;
      const payload = message.payload || {};
      if (!payload.requestId || payload.requestId !== activeAiRequestIdRef.current) {
        return;
      }

      setState((prev) => {
        if (prev.aiTranscription.requestId !== payload.requestId) return prev;
        const nextStatus = mapStageToStatus(payload.stage, prev.aiTranscription.status);
        const progressMessage = formatAiProgressMessage(
          payload.stage,
          payload.message,
          payload.percent,
          prev.aiTranscription.progressMessage
        );
        return {
          ...prev,
          aiTranscription: {
            ...prev.aiTranscription,
            status: nextStatus,
            progressMessage,
            jobId: payload.jobId ?? prev.aiTranscription.jobId,
          },
        };
      });
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  const openVideoList = useCallback(() => {
    setState((prev) => ({ ...prev, isVideoListOpen: true, error: null }));
  }, []);

  const closeVideoList = useCallback(() => {
    setState((prev) => ({ ...prev, isVideoListOpen: false }));
  }, []);

  /**
   * Core detection logic - shared between detectVideos and detectAndAutoExtract
   * Includes retry logic for video players that take time to initialize (video.js, etc.)
   */
  const performDetection = useCallback(async (): Promise<DetectedVideo[]> => {
    const currentUrl = window.location.href;
    console.log('[Lock-in Transcript] performDetection called for URL:', currentUrl);

    // Helper to run a single detection attempt
    const runDetection = (): ReturnType<typeof detectVideosSync> => {
      const iframes = collectIframeInfo(document);
      console.log('[Lock-in Transcript] Collected iframes:', iframes.length);
      iframes.forEach((iframe, i) => {
        console.log(`[Lock-in Transcript] Iframe ${i + 1}:`, iframe.src, iframe.title || '(no title)');
      });
      
      const context = {
        pageUrl: currentUrl,
        iframes,
        document,
      };
      console.log('[Lock-in Transcript] Detection context built, document present:', !!context.document);

      return detectVideosSync(context);
    };

    // First attempt
    let result = runDetection();
    console.log('[Lock-in Transcript] Initial detection result:', {
      provider: result.provider,
      videoCount: result.videos.length,
      requiresApiCall: result.requiresApiCall,
    });

    // Retry logic for delayed video players (video.js, MediaElement.js, etc.)
    // Some players take time to initialize the video element with proper src
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 500;
    
    if (result.videos.length === 0 && !result.requiresApiCall) {
      // Check if there are any video elements that might still be loading
      const videoElements = document.querySelectorAll('video');
      const hasUnreadyVideos = Array.from(videoElements).some(v => {
        const video = v as HTMLVideoElement;
        return !video.currentSrc && !video.src && video.querySelector('source');
      });
      
      if (hasUnreadyVideos || videoElements.length > 0) {
        console.log('[Lock-in Transcript] Found', videoElements.length, 'video elements, some may be loading. Retrying...');
        
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          result = runDetection();
          console.log(`[Lock-in Transcript] Retry ${attempt}/${MAX_RETRIES} result:`, {
            provider: result.provider,
            videoCount: result.videos.length,
          });
          
          if (result.videos.length > 0) {
            console.log('[Lock-in Transcript] Found videos after retry');
            break;
          }
        }
      }
    }

    console.log('[Lock-in Transcript] Final detection result:', {
      provider: result.provider,
      videoCount: result.videos.length,
      requiresApiCall: result.requiresApiCall,
    });

    if (result.provider === 'echo360') {
      const echo360Context = extractEcho360Context(currentUrl);
      const pageType = getEcho360PageType(echo360Context);

      if (pageType === 'lesson' && result.videos.length === 1) {
        // Lesson page - enrich single video with page title and mediaId
        const video = result.videos[0];
        video.title = extractEcho360PageTitle();
        video.mediaId = video.mediaId || extractMediaIdFromDom();
        return [video];
      }

      if (pageType === 'section' && result.requiresApiCall && echo360Context) {
        // Section page - need API call for video list
        const response = await sendToBackground<BackgroundResponse>({
          type: 'FETCH_ECHO360_SYLLABUS',
          payload: { context: echo360Context },
        });

        if (response.success && response.videos) {
          return response.videos;
        }

        // Handle auth required
        const errorCode = (response.data as Echo360SyllabusData)?.errorCode;
        if (errorCode === 'AUTH_REQUIRED') {
          const authError: AuthRequiredError = {
            type: 'AUTH_REQUIRED',
            provider: 'echo360',
            signInUrl: echo360Context.echoOrigin,
          };
          throw authError;
        }

        throw new Error(response.error || 'Failed to fetch Echo360 recordings');
      }
    }

    // Panopto or no videos detected
    return result.videos;
  }, []);

  /**
   * Handle detection errors consistently
   */
  const handleDetectionError = useCallback(
    (error: unknown, showPanel: boolean): void => {
      if (
        error &&
        typeof error === 'object' &&
        'type' in error &&
        (error as AuthRequiredError).type === 'AUTH_REQUIRED'
      ) {
        const authError = error as AuthRequiredError;
        setState((prev) => ({
          ...prev,
          isDetecting: false,
          isVideoListOpen: showPanel,
          error: 'Please sign in to Echo360 to view recordings.',
          authRequired: {
            provider: authError.provider,
            signInUrl: authError.signInUrl,
          },
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isDetecting: false,
          isVideoListOpen: showPanel,
          error: error instanceof Error ? error.message : 'Failed to detect videos',
        }));
      }
    },
    []
  );

  /**
   * Detect videos on the current page
   */
  const detectVideos = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isDetecting: true,
      error: null,
      authRequired: undefined,
      lastExtraction: null,
    }));

    try {
      const videos = await performDetection();
      setState((prev) => ({
        ...prev,
        videos,
        isDetecting: false,
      }));
    } catch (error) {
      handleDetectionError(error, true);
    }
  }, [performDetection, handleDetectionError]);

  /**
   * Extract transcript from background script
   */
  const fetchBackgroundTranscript = useCallback(
    async (video: DetectedVideo): Promise<TranscriptResponseData> => {
      const response = await sendToBackground<BackgroundResponse>({
        type: 'EXTRACT_TRANSCRIPT',
        payload: { video },
      });

      return normalizeTranscriptResponse(response);
    },
    []
  );

  const extractTranscriptWithDomFallback = useCallback(
    async (
      video: DetectedVideo
    ): Promise<{ transcript: TranscriptResult | null; result: TranscriptResponseData }> => {
      if (video.provider === 'html5') {
        const domResult = await extractHtml5TranscriptFromDom(video);
        if (domResult?.success && domResult.transcript) {
          return {
            transcript: domResult.transcript,
            result: { success: true, transcript: domResult.transcript },
          };
        }
      }

      const result = await fetchBackgroundTranscript(video);
      return { transcript: result.transcript || null, result };
    },
    [fetchBackgroundTranscript]
  );

  /**
   * Extract transcript for a video
   */
  const extractTranscript = useCallback(
    async (video: DetectedVideo): Promise<TranscriptResult | null> => {
      setState((prev) => ({
        ...prev,
        isExtracting: true,
        extractingVideoId: video.id,
        error: null,
        authRequired: undefined,
        lastExtraction: null,
      }));

      try {
        const { transcript, result } = await extractTranscriptWithDomFallback(video);

        if (result.success && transcript) {
          setState((prev) => ({
            ...prev,
            isExtracting: false,
            extractingVideoId: null,
            isVideoListOpen: false,
            lastTranscript: { video, transcript },
            lastExtraction: { video, result },
          }));

          return transcript;
        }

        let errorMessage = result.error || 'Failed to extract transcript';
        if (result.aiTranscriptionAvailable) {
          errorMessage += ' (AI transcription available as fallback)';
        }

        if (result.errorCode === 'AUTH_REQUIRED' && video.provider === 'echo360') {
          setState((prev) => ({
            ...prev,
            isExtracting: false,
            extractingVideoId: null,
            error: 'Please sign in to Echo360 to access transcripts.',
            lastExtraction: { video, result },
            authRequired: {
              provider: 'echo360',
              signInUrl: video.echoOrigin || 'https://echo360.net.au',
            },
          }));
        } else {
          setState((prev) => ({
            ...prev,
            isExtracting: false,
            extractingVideoId: null,
            error: errorMessage,
            lastExtraction: { video, result },
          }));
        }

        return null;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isExtracting: false,
          extractingVideoId: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
        return null;
      }
    },
    [extractTranscriptWithDomFallback]
  );

  /**
   * Detect videos and automatically extract if only one video is found
   */
  const detectAndAutoExtract = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isVideoListOpen: true,
      isDetecting: true,
      error: null,
      authRequired: undefined,
      lastExtraction: null,
    }));

    try {
      const videos = await performDetection();

      if (videos.length === 1) {
        // Single video - auto-extract without showing selection UI
        setState((prev) => ({
          ...prev,
          videos,
          isDetecting: false,
          isVideoListOpen: false,
          isExtracting: true,
          extractingVideoId: videos[0].id,
        }));

        try {
          const { transcript, result } = await extractTranscriptWithDomFallback(videos[0]);

          if (result.success && transcript) {
            setState((prev) => ({
              ...prev,
              isExtracting: false,
              extractingVideoId: null,
              lastTranscript: { video: videos[0], transcript },
              lastExtraction: { video: videos[0], result },
            }));
          } else {
            let errorMessage = result.error || 'Failed to extract transcript';
            if (result.aiTranscriptionAvailable) {
              errorMessage += ' (AI transcription available as fallback)';
            }

            if (result.errorCode === 'AUTH_REQUIRED' && videos[0].provider === 'echo360') {
              setState((prev) => ({
                ...prev,
                isExtracting: false,
                extractingVideoId: null,
                isVideoListOpen: true,
                error: 'Please sign in to access transcripts.',
                lastExtraction: { video: videos[0], result },
                authRequired: {
                  provider: 'echo360',
                  signInUrl: videos[0].echoOrigin || 'https://echo360.net.au',
                },
              }));
            } else {
              setState((prev) => ({
                ...prev,
                isExtracting: false,
                extractingVideoId: null,
                isVideoListOpen: true,
                error: errorMessage,
                lastExtraction: { video: videos[0], result },
              }));
            }
          }
        } catch (extractError) {
          setState((prev) => ({
            ...prev,
            isExtracting: false,
            extractingVideoId: null,
            isVideoListOpen: true,
            error:
              extractError instanceof Error
                ? extractError.message
                : 'Failed to extract transcript',
          }));
        }
      } else {
        // Multiple or no videos - show selection UI
        setState((prev) => ({
          ...prev,
          videos,
          isDetecting: false,
        }));
      }
    } catch (error) {
      handleDetectionError(error, true);
    }
  }, [performDetection, extractTranscriptWithDomFallback, handleDetectionError]);

  const transcribeWithAI = useCallback(
    async (
      video: DetectedVideo,
      options?: { languageHint?: string; maxMinutes?: number }
    ): Promise<TranscriptResult | null> => {
      if (!video.mediaUrl) {
        setState((prev) => ({
          ...prev,
          error: 'AI transcription is not available for this video.',
        }));
        return null;
      }

      const isBusy =
        state.aiTranscription.status === 'starting' ||
        state.aiTranscription.status === 'uploading' ||
        state.aiTranscription.status === 'processing' ||
        state.aiTranscription.status === 'polling';
      if (isBusy) return null;

      const durationLabel = formatDurationForConfirm(video.durationMs);
      const isLong =
        typeof video.durationMs === 'number' && video.durationMs >= LONG_DURATION_CONFIRM_MS;
      const confirmMessage = isLong
        ? `Transcribe${durationLabel ? ` (${durationLabel})` : ''} with AI? This may take a while.`
        : `Transcribe${durationLabel ? ` (${durationLabel})` : ''} with AI?`;

      if (!window.confirm(confirmMessage)) {
        return null;
      }

      const requestId = `ai-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      activeAiRequestIdRef.current = requestId;

      setState((prev) => ({
        ...prev,
        aiTranscription: {
          status: 'starting',
          requestId,
          jobId: null,
          video,
          progressMessage: 'Preparing AI transcription',
          error: null,
        },
      }));

      try {
        const response = await sendToBackground<AiTranscriptionResponse>({
          type: 'TRANSCRIBE_MEDIA_AI',
          payload: { video, options, requestId },
        });

        if (activeAiRequestIdRef.current !== requestId) {
          return null;
        }

        if (response.success && response.transcript) {
          const transcript = response.transcript; // Capture for type narrowing
          setState((prev) => ({
            ...prev,
            isExtracting: false,
            extractingVideoId: null,
            isVideoListOpen: false,
            error: null,
            lastTranscript: { video, transcript },
            lastExtraction: { video, result: { success: true, transcript } },
            aiTranscription: {
              status: 'completed',
              requestId,
              jobId: response.jobId || prev.aiTranscription.jobId,
              video,
              progressMessage: 'Transcript ready',
              error: null,
            },
          }));
          return transcript;
        }

        const errorMessage = response.error || 'AI transcription failed';
        const status = response.errorCode === 'CANCELED' ? 'canceled' : 'failed';
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          aiTranscription: {
            status,
            requestId,
            jobId: response.jobId || prev.aiTranscription.jobId,
            video,
            progressMessage: status === 'canceled' ? 'Transcription canceled' : null,
            error: errorMessage,
          },
        }));
        return null;
      } catch (error) {
        if (activeAiRequestIdRef.current !== requestId) {
          return null;
        }
        const message =
          error instanceof Error ? error.message : 'AI transcription failed';
        setState((prev) => ({
          ...prev,
          error: message,
          aiTranscription: {
            status: 'failed',
            requestId,
            jobId: prev.aiTranscription.jobId,
            video,
            progressMessage: null,
            error: message,
          },
        }));
        return null;
      }
    },
    [state.aiTranscription.status]
  );

  const cancelAiTranscription = useCallback(async (): Promise<void> => {
    const requestId = state.aiTranscription.requestId;
    const jobId = state.aiTranscription.jobId;
    if (!requestId && !jobId) {
      return;
    }

    activeAiRequestIdRef.current = null;
    setState((prev) => ({
      ...prev,
      aiTranscription: {
        ...prev.aiTranscription,
        status: 'canceled',
        progressMessage: 'Transcription canceled',
        error: null,
      },
    }));

    try {
      await sendToBackground<AiTranscriptionResponse>({
        type: 'TRANSCRIBE_MEDIA_AI',
        payload: { action: 'cancel', requestId, jobId },
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        aiTranscription: {
          ...prev.aiTranscription,
          status: 'failed',
          error:
            error instanceof Error
              ? error.message
              : 'Failed to cancel transcription',
        },
      }));
    }
  }, [state.aiTranscription.jobId, state.aiTranscription.requestId]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null, authRequired: undefined }));
  }, []);

  return {
    state,
    openVideoList,
    closeVideoList,
    detectVideos,
    detectAndAutoExtract,
    extractTranscript,
    transcribeWithAI,
    cancelAiTranscription,
    clearError,
  };
}
