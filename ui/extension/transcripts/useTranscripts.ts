/**
 * useTranscripts Hook
 *
 * Manages transcript extraction state and communication with background script.
 * Detects videos from multiple providers (Panopto, HTML5).
 *
 * Uses core detection logic from core/transcripts/videoDetection.ts
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { DetectedVideo, TranscriptResult } from '@core/transcripts/types';
import { detectVideosSync, collectIframeInfo } from '@core/transcripts/videoDetection';
import { extractHtml5TranscriptFromDom } from './extractHtml5TranscriptFromDom';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

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
  progressPercent: number | null;
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
  /** Error message for detection failures */
  error: string | null;
  /** Optional hint for empty detection results */
  detectionHint: string | null;
  /** Per-video transcript extraction results */
  extractionsByVideoId: Record<string, TranscriptResponseData>;
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
  closeVideoList: () => void;
  /** Detect videos and auto-extract if only one is found */
  detectAndAutoExtract: () => void;
  extractTranscript: (video: DetectedVideo) => Promise<TranscriptResult | null>;
  transcribeWithAI: (
    video: DetectedVideo,
    options?: { languageHint?: string; maxMinutes?: number },
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

interface PanoptoMediaUrlResponse {
  success: boolean;
  mediaUrl?: string;
  error?: string;
}

interface BackgroundResponse {
  success?: boolean;
  ok?: boolean;
  data?: TranscriptResponseData;
  error?: string;
  errorCode?: string;
  transcript?: TranscriptResult;
  aiTranscriptionAvailable?: boolean;
  videos?: DetectedVideo[];
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

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

const ECHO360_SECTION_REGEX =
  /\/section\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function hasEcho360Hint(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.toLowerCase().includes('echo360');
}

/**
 * Check if URL is an Echo360 section/course listing page
 * Section pages should fetch from syllabus API to get all videos
 */
function isEcho360SectionPage(pageUrl: string): boolean {
  if (!hasEcho360Hint(pageUrl)) return false;

  const isSectionPath = ECHO360_SECTION_REGEX.test(pageUrl);
  if (!isSectionPath) return false;

  // It's a section page if we're not on a specific lesson page
  const isLessonPage = /\/lessons?\/[^/]+/i.test(pageUrl);
  return !isLessonPage;
}

function hasEcho360Context(context: { pageUrl: string; iframes: Array<{ src: string }> }): boolean {
  if (hasEcho360Hint(context.pageUrl)) return true;
  return context.iframes.some((iframe) => hasEcho360Hint(iframe.src));
}

function shouldFetchEcho360Async(
  context: { pageUrl: string; iframes: Array<{ src: string }> },
  videos: DetectedVideo[],
  echo360Context = hasEcho360Context(context),
): boolean {
  if (!echo360Context) return false;

  // Always fetch async on section pages to get all videos from syllabus
  if (isEcho360SectionPage(context.pageUrl)) {
    return true;
  }

  if (videos.length === 0) return true;

  const echoVideos = videos.filter((video) => video.provider === 'echo360');
  if (echoVideos.length === 0) return false;

  return echoVideos.some(
    (video) =>
      !video.echoLessonId || !video.echoMediaId || ECHO360_SECTION_REGEX.test(video.embedUrl),
  );
}

// -----------------------------------------------------------------------------
// Background Script Communication
// -----------------------------------------------------------------------------

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

function normalizeVideoDetectionResponse(response: BackgroundResponse): DetectedVideo[] {
  if (Array.isArray(response.videos)) {
    return response.videos;
  }
  const data = response.data as { videos?: DetectedVideo[] } | undefined;
  if (Array.isArray(data?.videos)) {
    return data.videos;
  }
  return [];
}

function mapStageToStatus(
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

function isAiTranscriptionBusy(status: AiTranscriptionStatus): boolean {
  return (
    status === 'starting' ||
    status === 'uploading' ||
    status === 'processing' ||
    status === 'polling'
  );
}

function formatAiProgressMessage(
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
// Hook Implementation
// -----------------------------------------------------------------------------

const INITIAL_STATE: TranscriptState = {
  isVideoListOpen: false,
  videos: [],
  isDetecting: false,
  isExtracting: false,
  extractingVideoId: null,
  error: null,
  detectionHint: null,
  extractionsByVideoId: {},
  lastTranscript: null,
  aiTranscription: {
    status: 'idle',
    requestId: null,
    jobId: null,
    video: null,
    progressMessage: null,
    progressPercent: null,
    error: null,
  },
};

const LONG_DURATION_CONFIRM_MS = 20 * 60 * 1000;
const ECHO360_EMPTY_HINT = 'Echo360 tip: open a lesson page or the syllabus list to load videos.';

export function useTranscripts(): UseTranscriptsResult {
  const [state, setState] = useState<TranscriptState>(INITIAL_STATE);
  const activeAiRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) {
      return;
    }
    const listener = (
      message: { type?: string; payload?: AiTranscriptionProgressPayload },
      _sender: chrome.runtime.MessageSender,
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
          prev.aiTranscription.progressMessage,
        );
        return {
          ...prev,
          aiTranscription: {
            ...prev.aiTranscription,
            status: nextStatus,
            progressMessage,
            progressPercent:
              typeof payload.percent === 'number'
                ? payload.percent
                : prev.aiTranscription.progressPercent,
          },
        };
      });
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);

  const closeVideoList = useCallback(() => {
    setState((prev) => ({ ...prev, isVideoListOpen: false }));
  }, []);

  /**
   * Core detection logic with retry for delayed video players (video.js, MediaElement.js).
   */
  const performDetection = useCallback(async (): Promise<{
    videos: DetectedVideo[];
    echo360Context: boolean;
  }> => {
    const currentUrl = window.location.href;
    console.log('[Lock-in UI] Starting video detection', { currentUrl });

    // Helper to run a single detection attempt
    const runDetection = (): {
      result: ReturnType<typeof detectVideosSync>;
      context: {
        pageUrl: string;
        iframes: Array<{ src: string; title?: string }>;
        document: Document;
      };
    } => {
      const iframes = collectIframeInfo(document);
      const context = {
        pageUrl: currentUrl,
        iframes,
        document,
      };
      console.log('[Lock-in UI] Detection context built', {
        pageUrl: context.pageUrl,
        iframeCount: context.iframes.length,
        iframeSrcs: context.iframes.map((iframe) => iframe.src).filter(Boolean),
      });

      const result = detectVideosSync(context);
      console.log('[Lock-in UI] Sync detection result', {
        videoCount: result.videos.length,
        provider: result.provider,
        requiresApiCall: result.requiresApiCall,
        videos: result.videos.map((v) => ({
          id: v.id,
          provider: v.provider,
          title: v.title,
          lessonId: v.echoLessonId,
          mediaId: v.echoMediaId,
        })),
      });

      return { result, context };
    };

    // First attempt
    let { result, context } = runDetection();

    // Retry logic for delayed video players (video.js, MediaElement.js, etc.)
    // Some players take time to initialize the video element with proper src
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 500;

    if (result.videos.length === 0 && !result.requiresApiCall) {
      // Check if there are any video elements that might still be loading
      const videoElements = document.querySelectorAll('video');
      const hasUnreadyVideos = Array.from(videoElements).some((v) => {
        const video = v as HTMLVideoElement;
        return !video.currentSrc && !video.src && video.querySelector('source');
      });

      if (hasUnreadyVideos || videoElements.length > 0) {
        console.log('[Lock-in UI] Retrying detection for delayed video players', {
          videoElementCount: videoElements.length,
          hasUnreadyVideos,
        });
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          ({ result, context } = runDetection());

          if (result.videos.length > 0) {
            console.log('[Lock-in UI] Videos detected on retry', {
              attempt,
              videoCount: result.videos.length,
            });
            break;
          }
        }
      }
    }

    const contextForBackground = {
      pageUrl: context.pageUrl,
      iframes: context.iframes,
    };

    const echo360Context = hasEcho360Context(contextForBackground);
    const shouldFetchAsync = shouldFetchEcho360Async(
      contextForBackground,
      result.videos,
      echo360Context,
    );
    console.log('[Lock-in UI] Checking if Echo360 async detection needed', {
      shouldFetchAsync,
      currentVideoCount: result.videos.length,
      provider: result.provider,
    });

    if (shouldFetchAsync) {
      try {
        console.log('[Lock-in UI] Sending Echo360 async detection request', {
          context: contextForBackground,
        });
        const response = await sendToBackground<BackgroundResponse>({
          type: 'DETECT_ECHO360_VIDEOS',
          payload: { context: contextForBackground },
        });
        console.log('[Lock-in UI] Echo360 async detection response received', {
          success: response.success,
          videoCount: response.videos?.length,
        });
        const asyncVideos = normalizeVideoDetectionResponse(response);
        console.log('[Lock-in UI] Echo360 async videos normalized', {
          videoCount: asyncVideos.length,
          videos: asyncVideos.map((v) => ({
            id: v.id,
            provider: v.provider,
            title: v.title,
            lessonId: v.echoLessonId,
            mediaId: v.echoMediaId,
          })),
        });
        if (asyncVideos.length > 0) {
          console.log('[Lock-in UI] Returning async Echo360 videos', {
            count: asyncVideos.length,
          });
          return { videos: asyncVideos, echo360Context };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Echo360 detection failed';
        console.error('[Lock-in UI] Echo360 async detection failed:', {
          message,
          error: error instanceof Error ? error.stack : String(error),
        });
      }
    }

    console.log('[Lock-in UI] Returning sync detection videos', {
      count: result.videos.length,
    });
    return { videos: result.videos, echo360Context };
  }, []);

  /**
   * Handle detection errors consistently
   */
  const handleDetectionError = useCallback((error: unknown, showPanel: boolean): void => {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Video detection failed. Please refresh and try again.';
    setState((prev) => ({
      ...prev,
      isDetecting: false,
      isVideoListOpen: showPanel,
      error: message,
      detectionHint: null,
    }));
  }, []);

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
    [],
  );

  const extractTranscriptWithDomFallback = useCallback(
    async (
      video: DetectedVideo,
    ): Promise<{ transcript: TranscriptResult | null; result: TranscriptResponseData }> => {
      if (video.provider === 'html5') {
        const domResult = await extractHtml5TranscriptFromDom(video);
        // Handle null result (no video element found or no captions available)
        if (!domResult) {
          return {
            transcript: null,
            result: {
              success: false,
              error: 'No captions available for this video',
              errorCode: 'NO_CAPTIONS',
              aiTranscriptionAvailable: Boolean(video.mediaUrl),
            },
          };
        }
        return {
          transcript: domResult.transcript ?? null,
          result: { success: true, transcript: domResult.transcript },
        };
      }

      const result = await fetchBackgroundTranscript(video);
      return { transcript: result.transcript || null, result };
    },
    [fetchBackgroundTranscript],
  );

  /**
   * Extract transcript for a video
   */
  const extractTranscript = useCallback(
    async (video: DetectedVideo): Promise<TranscriptResult | null> => {
      if (state.isExtracting || isAiTranscriptionBusy(state.aiTranscription.status)) {
        return null;
      }

      setState((prev) => {
        const nextExtractions = { ...prev.extractionsByVideoId };
        delete nextExtractions[video.id];
        return {
          ...prev,
          isExtracting: true,
          extractingVideoId: video.id,
          error: null,
          authRequired: undefined,
          extractionsByVideoId: nextExtractions,
        };
      });

      try {
        const { transcript, result } = await extractTranscriptWithDomFallback(video);

        if (result.success && transcript) {
          setState((prev) => ({
            ...prev,
            isExtracting: false,
            extractingVideoId: null,
            isVideoListOpen: false,
            lastTranscript: { video, transcript },
            extractionsByVideoId: {
              ...prev.extractionsByVideoId,
              [video.id]: result,
            },
          }));

          return transcript;
        }

        setState((prev) => ({
          ...prev,
          isExtracting: false,
          extractingVideoId: null,
          extractionsByVideoId: {
            ...prev.extractionsByVideoId,
            [video.id]: {
              ...result,
              error: result.error || 'Failed to extract transcript',
            },
          },
        }));

        return null;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState((prev) => ({
          ...prev,
          isExtracting: false,
          extractingVideoId: null,
          extractionsByVideoId: {
            ...prev.extractionsByVideoId,
            [video.id]: {
              success: false,
              error: errorMessage,
            },
          },
        }));
        return null;
      }
    },
    [extractTranscriptWithDomFallback, state.aiTranscription.status, state.isExtracting],
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
      detectionHint: null,
      authRequired: undefined,
      extractionsByVideoId: {},
    }));

    try {
      const { videos, echo360Context } = await performDetection();
      const detectionHint = videos.length === 0 && echo360Context ? ECHO360_EMPTY_HINT : null;

      if (videos.length === 1) {
        // Single video - auto-extract without showing selection UI
        setState((prev) => {
          const nextExtractions = { ...prev.extractionsByVideoId };
          delete nextExtractions[videos[0].id];
          return {
            ...prev,
            videos,
            isDetecting: false,
            isVideoListOpen: false,
            isExtracting: true,
            extractingVideoId: videos[0].id,
            detectionHint,
            extractionsByVideoId: nextExtractions,
          };
        });

        try {
          const { transcript, result } = await extractTranscriptWithDomFallback(videos[0]);

          if (result.success && transcript) {
            setState((prev) => ({
              ...prev,
              isExtracting: false,
              extractingVideoId: null,
              lastTranscript: { video: videos[0], transcript },
              extractionsByVideoId: {
                ...prev.extractionsByVideoId,
                [videos[0].id]: result,
              },
            }));
          } else {
            setState((prev) => ({
              ...prev,
              isExtracting: false,
              extractingVideoId: null,
              isVideoListOpen: true,
              extractionsByVideoId: {
                ...prev.extractionsByVideoId,
                [videos[0].id]: {
                  ...result,
                  error: result.error || 'Failed to extract transcript',
                },
              },
            }));
          }
        } catch (extractError) {
          const errorMessage =
            extractError instanceof Error ? extractError.message : 'Failed to extract transcript';
          setState((prev) => ({
            ...prev,
            isExtracting: false,
            extractingVideoId: null,
            isVideoListOpen: true,
            extractionsByVideoId: {
              ...prev.extractionsByVideoId,
              [videos[0].id]: {
                success: false,
                error: errorMessage,
              },
            },
          }));
        }
      } else {
        // Multiple or no videos - show selection UI
        setState((prev) => ({
          ...prev,
          videos,
          isDetecting: false,
          detectionHint,
        }));
      }
    } catch (error) {
      handleDetectionError(error, true);
    }
  }, [performDetection, extractTranscriptWithDomFallback, handleDetectionError]);

  const transcribeWithAI = useCallback(
    async (
      video: DetectedVideo,
      options?: { languageHint?: string; maxMinutes?: number },
    ): Promise<TranscriptResult | null> => {
      if (isAiTranscriptionBusy(state.aiTranscription.status)) return null;
      // For Panopto videos, fetch the media URL first if not available
      let videoWithMediaUrl = video;
      if (video.provider === 'panopto' && !video.mediaUrl) {
        setState((prev) => ({
          ...prev,
          error: null,
          aiTranscription: {
            status: 'starting',
            requestId: null,
            jobId: null,
            video,
            progressMessage:
              'Finding downloadable video URL... (checking if podcast download is enabled)',
            progressPercent: null,
            error: null,
          },
        }));

        try {
          const mediaUrlResponse = await sendToBackground<PanoptoMediaUrlResponse>({
            type: 'FETCH_PANOPTO_MEDIA_URL',
            payload: { video },
          });

          if (!mediaUrlResponse.success || !mediaUrlResponse.mediaUrl) {
            const errorMsg =
              mediaUrlResponse.error ||
              'Could not find video URL. The video may be restricted or require authentication.';
            setState((prev) => ({
              ...prev,
              aiTranscription: {
                status: 'failed',
                requestId: null,
                jobId: null,
                video,
                progressMessage: null,
                progressPercent: null,
                error: errorMsg,
              },
            }));
            return null;
          }

          videoWithMediaUrl = {
            ...video,
            mediaUrl: mediaUrlResponse.mediaUrl,
          };
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : 'Failed to prepare video for AI transcription';
          setState((prev) => ({
            ...prev,
            aiTranscription: {
              status: 'failed',
              requestId: null,
              jobId: null,
              video,
              progressMessage: null,
              progressPercent: null,
              error: errorMsg,
            },
          }));
          return null;
        }
      }

      if (!videoWithMediaUrl.mediaUrl) {
        const message = 'AI transcription is not available for this video.';
        setState((prev) => ({
          ...prev,
          aiTranscription: {
            status: 'failed',
            requestId: null,
            jobId: null,
            video: videoWithMediaUrl,
            progressMessage: null,
            progressPercent: null,
            error: message,
          },
        }));
        return null;
      }

      const durationLabel = formatDurationForConfirm(videoWithMediaUrl.durationMs);
      const isLong =
        typeof videoWithMediaUrl.durationMs === 'number' &&
        videoWithMediaUrl.durationMs >= LONG_DURATION_CONFIRM_MS;

      // Ethical consent: Explain external processing clearly
      const confirmMessage = isLong
        ? `This ${durationLabel ? `${durationLabel} ` : ''}video will be uploaded to Lock-in for AI transcription. This may take several minutes. Continue?`
        : 'This video will be uploaded to Lock-in for AI transcription. Continue?';

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
          video: videoWithMediaUrl,
          progressMessage:
            'No transcript available - transcribing with AI... This may take a minute.',
          progressPercent: null,
          error: null,
        },
      }));

      try {
        const response = await sendToBackground<AiTranscriptionResponse>({
          type: 'TRANSCRIBE_MEDIA_AI',
          payload: { video: videoWithMediaUrl, options, requestId },
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
            lastTranscript: { video: videoWithMediaUrl, transcript },
            extractionsByVideoId: {
              ...prev.extractionsByVideoId,
              [videoWithMediaUrl.id]: { success: true, transcript },
            },
            aiTranscription: {
              status: 'completed',
              requestId,
              jobId: response.jobId || prev.aiTranscription.jobId,
              video: videoWithMediaUrl,
              progressMessage: 'Transcript ready',
              progressPercent: 100,
              error: null,
            },
          }));
          activeAiRequestIdRef.current = null;
          return transcript;
        }

        const errorMessage = response.error || 'AI transcription failed';
        const fallbackStatus = response.status === 'canceled' ? 'canceled' : 'failed';
        const nextStatus = mapStageToStatus(response.status, fallbackStatus);
        setState((prev) => ({
          ...prev,
          aiTranscription: {
            status: nextStatus,
            requestId,
            jobId: response.jobId || prev.aiTranscription.jobId,
            video: videoWithMediaUrl,
            progressMessage: null,
            progressPercent: null,
            error: errorMessage,
          },
        }));
        activeAiRequestIdRef.current = null;
        return null;
      } catch (error) {
        if (activeAiRequestIdRef.current !== requestId) {
          return null;
        }
        const message = error instanceof Error ? error.message : 'AI transcription failed';
        setState((prev) => ({
          ...prev,
          aiTranscription: {
            status: 'failed',
            requestId,
            jobId: prev.aiTranscription.jobId,
            video: videoWithMediaUrl,
            progressMessage: null,
            progressPercent: null,
            error: message,
          },
        }));
        activeAiRequestIdRef.current = null;
        return null;
      }
    },
    [state.aiTranscription.status],
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
        progressPercent: null,
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
          error: error instanceof Error ? error.message : 'Failed to cancel transcription',
          progressPercent: null,
        },
      }));
    }
  }, [state.aiTranscription.jobId, state.aiTranscription.requestId]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null, authRequired: undefined }));
  }, []);

  return {
    state,
    closeVideoList,
    detectAndAutoExtract,
    extractTranscript,
    transcribeWithAI,
    cancelAiTranscription,
    clearError,
  };
}
