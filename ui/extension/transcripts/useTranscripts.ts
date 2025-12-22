/**
 * useTranscripts Hook
 *
 * Manages transcript extraction state and communication with background script.
 * Detects Panopto videos embedded on the current page.
 */

import { useState, useCallback } from "react";
import type {
  DetectedVideo,
  TranscriptResult,
} from "../../../core/transcripts/types";

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
}

interface UseTranscriptsResult {
  state: TranscriptState;
  openVideoList: () => void;
  closeVideoList: () => void;
  detectVideos: () => void;
  extractTranscript: (video: DetectedVideo) => Promise<TranscriptResult | null>;
  clearError: () => void;
}

interface PanoptoInfo {
  deliveryId: string;
  tenant: string;
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
  data?: TranscriptResponseData;
  error?: string;
  transcript?: TranscriptResult;
  aiTranscriptionAvailable?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum iframe nesting depth to search */
const MAX_IFRAME_DEPTH = 3;

/** Regex patterns for Panopto URLs */
const PANOPTO_URL_PATTERNS = [
  /https?:\/\/([^/]+\.panopto\.com)\/Panopto\/Pages\/Embed\.aspx\?.*\bid=([a-f0-9-]+)/i,
  /https?:\/\/([^/]+\.panopto\.com)\/Panopto\/Pages\/Viewer\.aspx\?.*\bid=([a-f0-9-]+)/i,
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Video Detection Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract video ID and tenant from a Panopto URL.
 * Supports both Embed.aspx and Viewer.aspx URL formats.
 */
function extractPanoptoInfo(url: string): PanoptoInfo | null {
  for (const pattern of PANOPTO_URL_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      return { deliveryId: match[2], tenant: match[1] };
    }
  }
  return null;
}

/**
 * Get the source URL from an iframe, checking both src and data-src attributes.
 */
function getIframeSrc(iframe: HTMLIFrameElement): string {
  return iframe.src || iframe.getAttribute("data-src") || iframe.dataset.src || "";
}

/**
 * Recursively collect iframes from a document.
 * Handles same-origin nested iframes up to MAX_IFRAME_DEPTH levels.
 */
function collectIframes(doc: Document, depth = 0): HTMLIFrameElement[] {
  if (depth > MAX_IFRAME_DEPTH) return [];

  const iframes = Array.from(doc.querySelectorAll("iframe")) as HTMLIFrameElement[];
  const result: HTMLIFrameElement[] = [...iframes];

  for (const iframe of iframes) {
    try {
      const innerDoc = iframe.contentDocument;
      if (innerDoc) {
        result.push(...collectIframes(innerDoc, depth + 1));
      }
    } catch {
      // Cross-origin iframe - cannot access contentDocument
    }
  }

  return result;
}

/**
 * Add a video to the collection if not already present.
 * Returns the updated video index.
 */
function addVideo(
  videos: DetectedVideo[],
  info: PanoptoInfo,
  title: string,
  embedUrl: string,
  videoIndex: number
): number {
  if (videos.some((v) => v.id === info.deliveryId)) {
    return videoIndex;
  }

  videos.push({
    id: info.deliveryId,
    provider: "panopto",
    title: title || `Panopto video ${videoIndex + 1}`,
    embedUrl,
  });

  return videoIndex + 1;
}

/**
 * Detect Panopto videos on the current page.
 *
 * Detection strategy (in order):
 * 1. Check if current page is a Panopto viewer/embed page
 * 2. Search all iframes (including nested same-origin iframes)
 * 3. Search object/embed elements
 * 4. Search elements with Panopto-related class/id attributes
 * 5. Fallback: search for links to Panopto videos
 */
function detectPanoptoVideos(): DetectedVideo[] {
  const videos: DetectedVideo[] = [];
  let videoIndex = 0;

  // 1. Check if current page is a Panopto page
  const currentUrl = window.location.href;
  const currentPageInfo = extractPanoptoInfo(currentUrl);
  if (currentPageInfo) {
    const pageTitle = document.title?.trim();
    const title =
      pageTitle && !pageTitle.toLowerCase().includes("panopto")
        ? pageTitle
        : `Panopto video ${videoIndex + 1}`;

    videoIndex = addVideo(videos, currentPageInfo, title, currentUrl, videoIndex);
  }

  // 2. Search all iframes (including nested)
  const allIframes = collectIframes(document);
  for (const iframe of allIframes) {
    const src = getIframeSrc(iframe);
    if (!src) continue;

    const info = extractPanoptoInfo(src);
    if (info) {
      const title = iframe.title?.trim() || "";
      videoIndex = addVideo(videos, info, title, src, videoIndex);
    }
  }

  // 3. Search object/embed elements
  const mediaElements = document.querySelectorAll(
    'object[data*="panopto"], embed[src*="panopto"]'
  );
  for (const el of mediaElements) {
    const src = (el as HTMLObjectElement).data || (el as HTMLEmbedElement).src || "";
    const info = extractPanoptoInfo(src);
    if (info) {
      videoIndex = addVideo(videos, info, "", src, videoIndex);
    }
  }

  // 4. Search Panopto-related containers for iframes
  const panoptoContainers = document.querySelectorAll(
    '[class*="panopto"], [id*="panopto"]'
  );
  for (const container of panoptoContainers) {
    const containerIframes = container.querySelectorAll("iframe");
    for (const iframe of containerIframes) {
      const src = getIframeSrc(iframe as HTMLIFrameElement);
      const info = extractPanoptoInfo(src);
      if (info) {
        const title = (iframe as HTMLIFrameElement).title?.trim() || "";
        videoIndex = addVideo(videos, info, title, src, videoIndex);
      }
    }
  }

  // 5. Fallback: search for links (only if no videos found yet)
  if (videos.length === 0) {
    const links = document.querySelectorAll('a[href*="panopto.com"]');
    for (const link of links) {
      const href = (link as HTMLAnchorElement).href;
      const info = extractPanoptoInfo(href);
      if (info) {
        const linkText = link.textContent?.trim();
        const title =
          linkText && linkText.length > 3 && linkText.length < 100 ? linkText : "";
        videoIndex = addVideo(videos, info, title, href, videoIndex);
      }
    }
  }

  return videos;
}

// ─────────────────────────────────────────────────────────────────────────────
// Background Script Communication
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a message to the background script and await response.
 */
async function sendToBackground<T>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === "undefined" || !chrome.runtime) {
      reject(new Error("Chrome runtime not available"));
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
 * Normalize the background script response to a consistent format.
 */
function normalizeTranscriptResponse(response: BackgroundResponse): TranscriptResponseData {
  return (
    response.data ?? {
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

  const detectVideos = useCallback(() => {
    setState((prev) => ({ ...prev, isDetecting: true, error: null }));

    try {
      const videos = detectPanoptoVideos();
      setState((prev) => ({ ...prev, videos, isDetecting: false }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isDetecting: false,
        error: error instanceof Error ? error.message : "Failed to detect videos",
      }));
    }
  }, []);

  const extractTranscript = useCallback(
    async (video: DetectedVideo): Promise<TranscriptResult | null> => {
      setState((prev) => ({
        ...prev,
        isExtracting: true,
        extractingVideoId: video.id,
        error: null,
      }));

      try {
        const response = await sendToBackground<BackgroundResponse>({
          type: "EXTRACT_TRANSCRIPT",
          payload: { video },
        });

        const result = normalizeTranscriptResponse(response);

        if (result.success && result.transcript) {
          setState((prev) => ({
            ...prev,
            isExtracting: false,
            extractingVideoId: null,
            isVideoListOpen: false,
            lastTranscript: { video, transcript: result.transcript! },
          }));
          return result.transcript;
        }

        const errorMessage = result.error || "Failed to extract transcript";
        setState((prev) => ({
          ...prev,
          isExtracting: false,
          extractingVideoId: null,
          error: result.aiTranscriptionAvailable
            ? `${errorMessage} (AI transcription available as fallback)`
            : errorMessage,
        }));
        return null;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isExtracting: false,
          extractingVideoId: null,
          error: error instanceof Error ? error.message : "Unknown error",
        }));
        return null;
      }
    },
    []
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    state,
    openVideoList,
    closeVideoList,
    detectVideos,
    extractTranscript,
    clearError,
  };
}
