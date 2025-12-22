/**
 * useTranscripts Hook
 *
 * Manages transcript extraction state and communication with background script.
 * Detects videos from multiple providers (Panopto, Echo360).
 *
 * Uses core detection logic from core/transcripts/videoDetection.ts
 */

import { useState, useCallback } from 'react';
import type { DetectedVideo, TranscriptResult } from '@core/transcripts/types';
import {
  detectVideosSync,
  collectIframeInfo,
  extractEcho360Context,
  getEcho360PageType,
} from '@core/transcripts/videoDetection';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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
  /** Last extracted transcript */
  lastTranscript: {
    video: DetectedVideo;
    transcript: TranscriptResult;
  } | null;
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
  clearError: () => void;
}

interface TranscriptResponseData {
  success: boolean;
  transcript?: TranscriptResult;
  error?: string;
  errorCode?: string;
  aiTranscriptionAvailable?: boolean;
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
  lastTranscript: null,
};

export function useTranscripts(): UseTranscriptsResult {
  const [state, setState] = useState<TranscriptState>(INITIAL_STATE);

  const openVideoList = useCallback(() => {
    setState((prev) => ({ ...prev, isVideoListOpen: true, error: null }));
  }, []);

  const closeVideoList = useCallback(() => {
    setState((prev) => ({ ...prev, isVideoListOpen: false }));
  }, []);

  /**
   * Core detection logic - shared between detectVideos and detectAndAutoExtract
   */
  const performDetection = useCallback(async (): Promise<DetectedVideo[]> => {
    const currentUrl = window.location.href;

    // Build detection context from DOM
    const context = {
      pageUrl: currentUrl,
      iframes: collectIframeInfo(document),
    };

    // Use core detection logic
    const result = detectVideosSync(context);

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
  const performExtraction = useCallback(
    async (video: DetectedVideo): Promise<TranscriptResult | null> => {
      const response = await sendToBackground<BackgroundResponse>({
        type: 'EXTRACT_TRANSCRIPT',
        payload: { video },
      });

      const result = normalizeTranscriptResponse(response);

      if (result.success && result.transcript) {
        return result.transcript;
      }

      // Build error message
      let errorMessage = result.error || 'Failed to extract transcript';
      if (result.aiTranscriptionAvailable) {
        errorMessage += ' (AI transcription available as fallback)';
      }

      // Check for auth required
      if (result.errorCode === 'AUTH_REQUIRED' && video.provider === 'echo360') {
        const authError: AuthRequiredError = {
          type: 'AUTH_REQUIRED',
          provider: 'echo360',
          signInUrl: video.echoOrigin || 'https://echo360.net.au',
        };
        throw authError;
      }

      throw new Error(errorMessage);
    },
    []
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
      }));

      try {
        const transcript = await performExtraction(video);

        setState((prev) => ({
          ...prev,
          isExtracting: false,
          extractingVideoId: null,
          isVideoListOpen: false,
          lastTranscript: transcript ? { video, transcript } : null,
        }));

        return transcript;
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'type' in error &&
          (error as AuthRequiredError).type === 'AUTH_REQUIRED'
        ) {
          const authError = error as AuthRequiredError;
          setState((prev) => ({
            ...prev,
            isExtracting: false,
            extractingVideoId: null,
            error: 'Please sign in to Echo360 to access transcripts.',
            authRequired: {
              provider: authError.provider,
              signInUrl: authError.signInUrl,
            },
          }));
        } else {
          setState((prev) => ({
            ...prev,
            isExtracting: false,
            extractingVideoId: null,
            error: error instanceof Error ? error.message : 'Unknown error',
          }));
        }
        return null;
      }
    },
    [performExtraction]
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
          const transcript = await performExtraction(videos[0]);

          setState((prev) => ({
            ...prev,
            isExtracting: false,
            extractingVideoId: null,
            lastTranscript: transcript ? { video: videos[0], transcript } : null,
          }));
        } catch (extractError) {
          // Show panel with error if extraction fails
          if (
            extractError &&
            typeof extractError === 'object' &&
            'type' in extractError &&
            (extractError as AuthRequiredError).type === 'AUTH_REQUIRED'
          ) {
            const authError = extractError as AuthRequiredError;
            setState((prev) => ({
              ...prev,
              isExtracting: false,
              extractingVideoId: null,
              isVideoListOpen: true,
              error: 'Please sign in to access transcripts.',
              authRequired: {
                provider: authError.provider,
                signInUrl: authError.signInUrl,
              },
            }));
          } else {
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
  }, [performDetection, performExtraction, handleDetectionError]);

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
    clearError,
  };
}
