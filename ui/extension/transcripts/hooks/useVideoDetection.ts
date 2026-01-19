/**
 * useVideoDetection Hook
 *
 * Manages video detection state and logic.
 * Handles retry logic for delayed video players (video.js, MediaElement.js).
 * Delegates to provider's requiresAsyncDetection() for async detection needs.
 */

import { useState, useCallback } from 'react';
import type { DetectedVideo } from '@core/transcripts/types';
import { detectVideosSync, collectIframeInfo } from '@core/transcripts/videoDetection';
import { getProviderForUrl } from '@core/transcripts/providerRegistry';
import {
  sendToBackground,
  normalizeVideoDetectionResponse,
  type BackgroundResponse,
} from './types';

// -----------------------------------------------------------------------------
// Echo360 Detection Helpers
// Note: These are needed because the provider registry may not be populated
// in the content script context. The background script handles actual extraction.
// -----------------------------------------------------------------------------

const ECHO360_SECTION_REGEX =
  /\/section\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const ECHO360_EMPTY_HINT = 'Echo360 tip: open a lesson page or the syllabus list to load videos.';

function hasEcho360Hint(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.toLowerCase().includes('echo360');
}

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
// Types
// -----------------------------------------------------------------------------

export interface VideoDetectionState {
  /** Detected videos on the page */
  videos: DetectedVideo[];
  /** Whether video detection is in progress */
  isDetecting: boolean;
  /** Error message for detection failures */
  error: string | null;
  /** Optional hint for empty detection results (provider-specific) */
  detectionHint: string | null;
}

export interface UseVideoDetectionResult {
  state: VideoDetectionState;
  /** Detect videos on the current page */
  detectVideos: () => Promise<{ videos: DetectedVideo[]; provider: string | null }>;
  /** Reset detection state */
  resetDetection: () => void;
  /** Set error message */
  setError: (error: string | null) => void;
  /** Set detecting state */
  setDetecting: (isDetecting: boolean) => void;
  /** Update videos list */
  setVideos: (videos: DetectedVideo[]) => void;
}

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const INITIAL_STATE: VideoDetectionState = {
  videos: [],
  isDetecting: false,
  error: null,
  detectionHint: null,
};

// -----------------------------------------------------------------------------
// Hook Implementation
// -----------------------------------------------------------------------------

export function useVideoDetection(): UseVideoDetectionResult {
  const [state, setState] = useState<VideoDetectionState>(INITIAL_STATE);

  /**
   * Core detection logic with retry for delayed video players (video.js, MediaElement.js).
   */
  const detectVideos = useCallback(async (): Promise<{
    videos: DetectedVideo[];
    provider: string | null;
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

    // Check for Echo360 context and determine if async detection is needed
    // Note: Provider registry may not be populated in content script context,
    // so we use explicit checks for Echo360
    const echo360Context = hasEcho360Context(contextForBackground);
    const shouldFetchAsync = shouldFetchEcho360Async(
      contextForBackground,
      result.videos,
      echo360Context,
    );

    // Also check provider registry as fallback (may work in some contexts)
    const provider = getProviderForUrl(context.pageUrl);
    const providerName = result.provider ?? (echo360Context ? 'echo360' : null);
    const requiresAsync =
      shouldFetchAsync ||
      provider?.requiresAsyncDetection?.(contextForBackground) ||
      result.requiresApiCall;

    console.log('[Lock-in UI] Checking if async detection needed', {
      requiresAsync,
      shouldFetchAsync,
      echo360Context,
      currentVideoCount: result.videos.length,
      provider: providerName,
    });

    if (requiresAsync) {
      try {
        console.log('[Lock-in UI] Sending async detection request', {
          context: contextForBackground,
        });

        // For Echo360, use the dedicated message type
        const messageType = echo360Context ? 'DETECT_ECHO360_VIDEOS' : 'DETECT_VIDEOS_ASYNC';

        const response = await sendToBackground<BackgroundResponse>({
          type: messageType,
          payload: { context: contextForBackground },
        });

        console.log('[Lock-in UI] Async detection response received', {
          success: response.success,
          videoCount: response.videos?.length,
        });

        const asyncVideos = normalizeVideoDetectionResponse(response);
        console.log('[Lock-in UI] Async videos normalized', {
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
          console.log('[Lock-in UI] Returning async videos', {
            count: asyncVideos.length,
          });

          setState((prev) => ({
            ...prev,
            videos: asyncVideos,
            detectionHint: null,
          }));

          return { videos: asyncVideos, provider: providerName };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Async detection failed';
        console.error('[Lock-in UI] Async detection failed:', {
          message,
          error: error instanceof Error ? error.stack : String(error),
        });
      }
    }

    // Get hint when no videos found on Echo360 pages
    const detectionHint = result.videos.length === 0 && echo360Context ? ECHO360_EMPTY_HINT : null;

    console.log('[Lock-in UI] Returning sync detection videos', {
      count: result.videos.length,
    });

    setState((prev) => ({
      ...prev,
      videos: result.videos,
      detectionHint,
    }));

    return { videos: result.videos, provider: providerName };
  }, []);

  const resetDetection = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const setDetecting = useCallback((isDetecting: boolean) => {
    setState((prev) => ({ ...prev, isDetecting }));
  }, []);

  const setVideos = useCallback((videos: DetectedVideo[]) => {
    setState((prev) => ({ ...prev, videos }));
  }, []);

  return {
    state,
    detectVideos,
    resetDetection,
    setError,
    setDetecting,
    setVideos,
  };
}
