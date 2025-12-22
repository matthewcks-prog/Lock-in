/**
 * useTranscripts Hook
 *
 * Manages transcript extraction state and communication with background script.
 * Detects videos from multiple providers (Panopto, Echo360).
 */

import { useState, useCallback } from "react";
import type {
  DetectedVideo,
  TranscriptResult,
  Echo360Context,
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

/** Echo360 supported host domains */
const ECHO360_HOSTS = [
  'echo360qa.org',
  'echo360qa.dev',
  'echo360.org',
  'echo360.org.au',
  'echo360.net.au',
  'echo360.ca',
  'echo360.org.uk',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Echo360 Detection Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if hostname is an Echo360 domain
 */
function isEcho360Domain(hostname: string): boolean {
  const lowerHost = hostname.toLowerCase();
  return ECHO360_HOSTS.some(domain => 
    lowerHost === domain || lowerHost.endsWith('.' + domain)
  );
}

/**
 * Extract Echo360 context from current page URL
 * Uses multiple strategies for robustness across different university configurations
 */
function extractEcho360Context(url: string): Echo360Context | null {
  try {
    const urlObj = new URL(url);
    if (!isEcho360Domain(urlObj.hostname)) {
      return null;
    }
    
    const echoOrigin = urlObj.origin;
    const pathname = urlObj.pathname;
    
    // Strategy 1: Extract section ID from URL path
    // Section IDs are typically UUIDs: /section/{uuid}/...
    const sectionMatch = pathname.match(/\/section\/([^/]+)/i);
    const sectionId = sectionMatch ? decodeURIComponent(sectionMatch[1]) : undefined;
    
    // Strategy 2: Extract lesson ID from URL path
    // Lesson IDs can vary widely: UUIDs, compound IDs, or other formats
    // Use permissive regex that captures everything until next slash
    const lessonMatch = pathname.match(/\/lesson\/([^/]+)/i);
    let lessonId = lessonMatch ? decodeURIComponent(lessonMatch[1]) : undefined;
    
    // Strategy 3: Try to get lesson/media info from query params (some Echo360 configs use this)
    const mediaId = urlObj.searchParams.get('mediaId') || 
                    urlObj.searchParams.get('media') || 
                    urlObj.searchParams.get('mid') || 
                    undefined;
    
    // Strategy 4: Check for lesson ID in query params as fallback
    if (!lessonId) {
      lessonId = urlObj.searchParams.get('lessonId') || 
                 urlObj.searchParams.get('lesson') || 
                 urlObj.searchParams.get('lid') || 
                 undefined;
    }
    
    // Strategy 5: Check hash fragment (some single-page app configs)
    if (!lessonId && !sectionId && urlObj.hash) {
      const hashLessonMatch = urlObj.hash.match(/lesson[=/]([^&/#]+)/i);
      if (hashLessonMatch) {
        lessonId = decodeURIComponent(hashLessonMatch[1]);
      }
      const hashSectionMatch = urlObj.hash.match(/section[=/]([^&/#]+)/i);
      if (hashSectionMatch) {
        const potentialSectionId = decodeURIComponent(hashSectionMatch[1]);
        // Only use if it looks like a UUID (basic validation)
        if (/^[a-f0-9-]{8,}$/i.test(potentialSectionId)) {
          // sectionId from hash - less common but possible
        }
      }
    }
    
    return {
      echoOrigin,
      sectionId,
      lessonId,
      mediaId,
    };
  } catch (e) {
    console.warn('[Lock-in] Failed to extract Echo360 context:', e);
    return null;
  }
}

/**
 * Extract video title from Echo360 page using multiple strategies
 * Falls back gracefully if no title can be found
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
  const metaTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                    document.querySelector('meta[name="title"]')?.getAttribute('content');
  if (metaTitle?.trim()) {
    return metaTitle.trim();
  }
  
  // Strategy 3: Clean up document.title
  let pageTitle = document.title || '';
  // Remove common Echo360 suffixes
  pageTitle = pageTitle.replace(/\s*[-|–—]\s*(Echo360|Classroom|Player).*$/i, '').trim();
  // Remove leading/trailing noise
  pageTitle = pageTitle.replace(/^(Video|Recording|Lecture):\s*/i, '').trim();
  
  if (pageTitle && pageTitle.length > 2) {
    return pageTitle;
  }
  
  // Strategy 4: Default fallback
  return 'Echo360 Recording';
}

/**
 * Try to extract media ID from Echo360 page DOM
 * Useful when mediaId is not in the URL
 * Returns undefined if not found or if any errors occur
 */
function extractMediaIdFromDom(): string | undefined {
  const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  
  // Strategy 1: Look for media ID in data attributes
  try {
    const mediaElements = document.querySelectorAll('[data-media-id], [data-mediaid], [data-video-id]');
    for (const el of mediaElements) {
      const mediaId = el.getAttribute('data-media-id') || 
                      el.getAttribute('data-mediaid') ||
                      el.getAttribute('data-video-id');
      if (mediaId && UUID_PATTERN.test(mediaId)) {
        console.log('[Lock-in] Found mediaId from data attribute:', mediaId);
        return mediaId;
      }
    }
  } catch (e) {
    console.warn('[Lock-in] Failed to extract mediaId from data attributes:', e);
  }
  
  // Strategy 2: Look in video elements
  try {
    const videos = document.querySelectorAll('video[data-id], video[id], video[data-media-id]');
    for (const video of videos) {
      const id = video.getAttribute('data-id') || 
                 video.getAttribute('data-media-id') || 
                 video.id;
      if (id && UUID_PATTERN.test(id)) {
        console.log('[Lock-in] Found mediaId from video element:', id);
        return id;
      }
    }
  } catch (e) {
    console.warn('[Lock-in] Failed to extract mediaId from video elements:', e);
  }
  
  // Strategy 3: Look in script tags for media configuration
  try {
    const scripts = Array.from(document.querySelectorAll('script:not([src])')).slice(0, 20);
    for (const script of scripts) {
      const content = script.textContent || '';
      if (content.length > 50 && content.length < 100000) {
        // Try multiple patterns
        const patterns = [
          /"mediaId"\s*:\s*"([a-f0-9-]{36})"/i,
          /"media[_-]?id"\s*[=:]\s*"([a-f0-9-]{36})"/i,
          /medias\/([a-f0-9-]{36})\/transcript/i,
          /medias\/([a-f0-9-]{36})(?:\/|\?|"|')/i,
        ];
        for (const pattern of patterns) {
          const match = content.match(pattern);
          if (match && match[1] && UUID_PATTERN.test(match[1])) {
            console.log('[Lock-in] Found mediaId from script:', match[1]);
            return match[1];
          }
        }
      }
    }
  } catch (e) {
    console.warn('[Lock-in] Failed to extract mediaId from scripts:', e);
  }
  
  // Strategy 4: Look in any element with source containing /medias/
  try {
    const sourceElements = document.querySelectorAll('[src*="/medias/"], [data-src*="/medias/"]');
    for (const el of sourceElements) {
      const src = el.getAttribute('src') || el.getAttribute('data-src') || '';
      const match = src.match(/\/medias\/([a-f0-9-]{36})/i);
      if (match && match[1] && UUID_PATTERN.test(match[1])) {
        console.log('[Lock-in] Found mediaId from src attribute:', match[1]);
        return match[1];
      }
    }
  } catch (e) {
    console.warn('[Lock-in] Failed to extract mediaId from src attributes:', e);
  }
  
  // Strategy 5: Check the page's HTML source for transcript API URLs
  try {
    const htmlContent = document.documentElement.innerHTML;
    // Look for transcript URL patterns which contain the mediaId
    const transcriptMatch = htmlContent.match(/\/medias\/([a-f0-9-]{36})\/transcript/i);
    if (transcriptMatch && transcriptMatch[1] && UUID_PATTERN.test(transcriptMatch[1])) {
      console.log('[Lock-in] Found mediaId from HTML transcript URL:', transcriptMatch[1]);
      return transcriptMatch[1];
    }
    
    // Look for media URL patterns
    const mediaMatch = htmlContent.match(/\/medias\/([a-f0-9-]{36})(?:\/|"|'|\?)/i);
    if (mediaMatch && mediaMatch[1] && UUID_PATTERN.test(mediaMatch[1])) {
      console.log('[Lock-in] Found mediaId from HTML media URL:', mediaMatch[1]);
      return mediaMatch[1];
    }
  } catch (e) {
    console.warn('[Lock-in] Failed to extract mediaId from HTML content:', e);
  }
  
  // Strategy 6: Look for window/global variables that Echo360 might set
  try {
    // Check common Echo360 global variables
    const win = window as unknown as Record<string, unknown>;
    const possibleVars = ['__ECHO360__', 'Echo360', 'echoPlayerData', 'playerConfig'];
    for (const varName of possibleVars) {
      const obj = win[varName];
      if (obj && typeof obj === 'object') {
        const jsonStr = JSON.stringify(obj);
        const match = jsonStr.match(/"mediaId"\s*:\s*"([a-f0-9-]{36})"/i) ||
                      jsonStr.match(/\/medias\/([a-f0-9-]{36})/i);
        if (match && match[1] && UUID_PATTERN.test(match[1])) {
          console.log('[Lock-in] Found mediaId from global variable:', match[1]);
          return match[1];
        }
      }
    }
  } catch (e) {
    console.warn('[Lock-in] Failed to extract mediaId from global variables:', e);
  }
  
  console.log('[Lock-in] Could not find mediaId from DOM');
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Panopto Detection Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract video ID and tenant from a Panopto URL.
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
 * Get the source URL from an iframe
 */
function getIframeSrc(iframe: HTMLIFrameElement): string {
  return iframe.src || iframe.getAttribute("data-src") || iframe.dataset.src || "";
}

/**
 * Recursively collect iframes from a document
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
      // Cross-origin iframe
    }
  }

  return result;
}

/**
 * Add a Panopto video to the collection if not already present
 */
function addPanoptoVideo(
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
 * Detect Panopto videos on the current page
 */
function detectPanoptoVideos(): DetectedVideo[] {
  const videos: DetectedVideo[] = [];
  let videoIndex = 0;

  // Check if current page is a Panopto page
  const currentUrl = window.location.href;
  const currentPageInfo = extractPanoptoInfo(currentUrl);
  if (currentPageInfo) {
    const pageTitle = document.title?.trim();
    const title =
      pageTitle && !pageTitle.toLowerCase().includes("panopto")
        ? pageTitle
        : `Panopto video ${videoIndex + 1}`;

    videoIndex = addPanoptoVideo(videos, currentPageInfo, title, currentUrl, videoIndex);
  }

  // Search all iframes
  const allIframes = collectIframes(document);
  for (const iframe of allIframes) {
    const src = getIframeSrc(iframe);
    if (!src) continue;

    const info = extractPanoptoInfo(src);
    if (info) {
      const title = iframe.title?.trim() || "";
      videoIndex = addPanoptoVideo(videos, info, title, src, videoIndex);
    }
  }

  // Search object/embed elements
  const mediaElements = document.querySelectorAll(
    'object[data*="panopto"], embed[src*="panopto"]'
  );
  for (const el of mediaElements) {
    const src = (el as HTMLObjectElement).data || (el as HTMLEmbedElement).src || "";
    const info = extractPanoptoInfo(src);
    if (info) {
      videoIndex = addPanoptoVideo(videos, info, "", src, videoIndex);
    }
  }

  // Search Panopto containers
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
        videoIndex = addPanoptoVideo(videos, info, title, src, videoIndex);
      }
    }
  }

  // Fallback: search for links
  if (videos.length === 0) {
    const links = document.querySelectorAll('a[href*="panopto.com"]');
    for (const link of links) {
      const href = (link as HTMLAnchorElement).href;
      const info = extractPanoptoInfo(href);
      if (info) {
        const linkText = link.textContent?.trim();
        const title =
          linkText && linkText.length > 3 && linkText.length < 100 ? linkText : "";
        videoIndex = addPanoptoVideo(videos, info, title, href, videoIndex);
      }
    }
  }

  return videos;
}

// ─────────────────────────────────────────────────────────────────────────────
// Background Script Communication
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a message to the background script and await response
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
 * Normalize the background script response
 */
function normalizeTranscriptResponse(response: BackgroundResponse): TranscriptResponseData {
  return (
    response.data as TranscriptResponseData ?? {
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
   * Internal video detection logic - returns detected videos instead of just updating state
   * This allows both detectVideos and detectAndAutoExtract to share the same logic
   */
  const detectVideosInternal = useCallback(async (): Promise<DetectedVideo[]> => {
    const currentUrl = window.location.href;
    const echo360Context = extractEcho360Context(currentUrl);
    
    if (echo360Context && echo360Context.lessonId) {
      // Echo360 LESSON page - single video, create entry directly
      console.log('[Lock-in] Echo360 lesson page detected, lessonId:', echo360Context.lessonId);
      
      // Try multiple strategies to get the best title
      const title = extractEcho360PageTitle();
      
      // Try to get mediaId from URL or DOM
      const mediaId = echo360Context.mediaId || extractMediaIdFromDom();
      if (mediaId) {
        console.log('[Lock-in] Found mediaId:', mediaId);
      }
      
      const singleVideo: DetectedVideo = {
        id: echo360Context.lessonId,
        provider: 'echo360',
        title,
        embedUrl: currentUrl,
        echoOrigin: echo360Context.echoOrigin,
        lessonId: echo360Context.lessonId,
        mediaId,
      };
      
      console.log('[Lock-in] Single Echo360 video detected:', singleVideo.title);
      return [singleVideo];
    } else if (echo360Context && echo360Context.sectionId) {
      // Echo360 SECTION page - fetch videos via background script API call
      console.log('[Lock-in] Echo360 section page detected, context:', JSON.stringify(echo360Context));
      console.log('[Lock-in] Sending FETCH_ECHO360_SYLLABUS to background...');
      
      const response = await sendToBackground<BackgroundResponse>({
        type: "FETCH_ECHO360_SYLLABUS",
        payload: { context: echo360Context },
      });
      
      console.log('[Lock-in] Background response:', JSON.stringify(response).substring(0, 500));
      
      if (response.success && response.videos) {
        console.log(`[Lock-in] Found ${response.videos.length} Echo360 videos`);
        return response.videos;
      } else {
        const errorCode = (response.data as Echo360SyllabusData)?.errorCode;
        if (errorCode === 'AUTH_REQUIRED') {
          throw { type: 'AUTH_REQUIRED', provider: 'echo360', signInUrl: echo360Context.echoOrigin };
        } else {
          throw new Error(response.error || 'Failed to fetch Echo360 recordings');
        }
      }
    } else {
      // Non-Echo360 page - use DOM-based Panopto detection
      const videos = detectPanoptoVideos();
      console.log(`[Lock-in] Found ${videos.length} Panopto videos`);
      return videos;
    }
  }, []);

  /**
   * Detect videos on the current page.
   * Handles both Panopto (DOM-based) and Echo360 (API-based) detection.
   * For Echo360 lesson pages (single video), creates a single video entry.
   * For Echo360 section pages (video list), fetches syllabus.
   * Uses multiple fallback strategies for robustness.
   */
  const detectVideos = useCallback(async () => {
    setState((prev) => ({ ...prev, isDetecting: true, error: null, authRequired: undefined }));

    try {
      const currentUrl = window.location.href;
      const echo360Context = extractEcho360Context(currentUrl);
      
      if (echo360Context && echo360Context.lessonId) {
        // Echo360 LESSON page - single video, create entry directly
        console.log('[Lock-in] Echo360 lesson page detected, lessonId:', echo360Context.lessonId);
        
        // Try multiple strategies to get the best title
        const title = extractEcho360PageTitle();
        
        // Try to get mediaId from URL or DOM
        const mediaId = echo360Context.mediaId || extractMediaIdFromDom();
        if (mediaId) {
          console.log('[Lock-in] Found mediaId:', mediaId);
        }
        
        const singleVideo: DetectedVideo = {
          id: echo360Context.lessonId,
          provider: 'echo360',
          title,
          embedUrl: currentUrl,
          echoOrigin: echo360Context.echoOrigin,
          lessonId: echo360Context.lessonId,
          mediaId,
        };
        
        console.log('[Lock-in] Single Echo360 video detected:', singleVideo.title);
        setState((prev) => ({ 
          ...prev, 
          videos: [singleVideo], 
          isDetecting: false 
        }));
      } else if (echo360Context && echo360Context.sectionId) {
        // Echo360 SECTION page - fetch videos via background script API call
        console.log('[Lock-in] Echo360 section page detected, context:', JSON.stringify(echo360Context));
        console.log('[Lock-in] Sending FETCH_ECHO360_SYLLABUS to background...');
        
        const response = await sendToBackground<BackgroundResponse>({
          type: "FETCH_ECHO360_SYLLABUS",
          payload: { context: echo360Context },
        });
        
        console.log('[Lock-in] Background response:', JSON.stringify(response).substring(0, 500));
        
        if (response.success && response.videos) {
          console.log(`[Lock-in] Found ${response.videos.length} Echo360 videos`);
          setState((prev) => ({ 
            ...prev, 
            videos: response.videos!, 
            isDetecting: false 
          }));
        } else {
          const errorCode = (response.data as Echo360SyllabusData)?.errorCode;
          if (errorCode === 'AUTH_REQUIRED') {
            setState((prev) => ({
              ...prev,
              isDetecting: false,
              error: 'Please sign in to Echo360 to view recordings.',
              authRequired: {
                provider: 'echo360',
                signInUrl: echo360Context.echoOrigin,
              },
            }));
          } else {
            setState((prev) => ({
              ...prev,
              isDetecting: false,
              error: response.error || 'Failed to fetch Echo360 recordings',
            }));
          }
        }
      } else {
        // Non-Echo360 page - use DOM-based Panopto detection
        const videos = detectPanoptoVideos();
        console.log(`[Lock-in] Found ${videos.length} Panopto videos`);
        setState((prev) => ({ ...prev, videos, isDetecting: false }));
      }
    } catch (error) {
      console.error('[Lock-in] Video detection failed:', error);
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
        console.log(`[Lock-in] Extracting transcript for ${video.provider} video: ${video.id}`);
        
        const response = await sendToBackground<BackgroundResponse>({
          type: "EXTRACT_TRANSCRIPT",
          payload: { video },
        });

        const result = normalizeTranscriptResponse(response);

        if (result.success && result.transcript) {
          console.log('[Lock-in] Transcript extracted successfully:', {
            segments: result.transcript.segments.length,
            plainTextLength: result.transcript.plainText.length,
            durationMs: result.transcript.durationMs,
          });
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
        console.warn('[Lock-in] Transcript extraction failed:', errorMessage);
        
        // Handle auth required for Echo360
        if (result.errorCode === 'AUTH_REQUIRED' && video.provider === 'echo360') {
          setState((prev) => ({
            ...prev,
            isExtracting: false,
            extractingVideoId: null,
            error: errorMessage,
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
            error: result.aiTranscriptionAvailable
              ? `${errorMessage} (AI transcription available as fallback)`
              : errorMessage,
          }));
        }
        return null;
      } catch (error) {
        console.error('[Lock-in] Transcript extraction error:', error);
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
    setState((prev) => ({ ...prev, error: null, authRequired: undefined }));
  }, []);

  /**
   * Detect videos and automatically extract transcript if only one video is found.
   * This provides a better UX for lesson pages where there's only a single video.
   */
  const detectAndAutoExtract = useCallback(async () => {
    setState((prev) => ({ ...prev, isVideoListOpen: true, isDetecting: true, error: null, authRequired: undefined }));

    try {
      const videos = await detectVideosInternal();
      
      if (videos.length === 1) {
        // Single video found - auto-extract without showing selection UI
        console.log('[Lock-in] Single video detected, auto-extracting transcript');
        setState((prev) => ({ 
          ...prev, 
          videos, 
          isDetecting: false,
          isVideoListOpen: false, // Close the panel immediately
          isExtracting: true,
          extractingVideoId: videos[0].id,
        }));
        
        // Trigger extraction
        const video = videos[0];
        console.log(`[Lock-in] Auto-extracting transcript for ${video.provider} video: ${video.id}`);
        
        const response = await sendToBackground<BackgroundResponse>({
          type: "EXTRACT_TRANSCRIPT",
          payload: { video },
        });

        const result = normalizeTranscriptResponse(response);

        if (result.success && result.transcript) {
          console.log('[Lock-in] Auto-extract: Transcript extracted successfully');
          setState((prev) => ({
            ...prev,
            isExtracting: false,
            extractingVideoId: null,
            lastTranscript: { video, transcript: result.transcript! },
          }));
        } else {
          const errorMessage = result.error || "Failed to extract transcript";
          console.warn('[Lock-in] Auto-extract: Transcript extraction failed:', errorMessage);
          
          setState((prev) => ({
            ...prev,
            isExtracting: false,
            extractingVideoId: null,
            isVideoListOpen: true, // Re-open panel to show error
            error: result.aiTranscriptionAvailable
              ? `${errorMessage} (AI transcription available as fallback)`
              : errorMessage,
          }));
        }
      } else {
        // Multiple videos or no videos - show selection UI
        console.log(`[Lock-in] Found ${videos.length} videos, showing selection UI`);
        setState((prev) => ({ 
          ...prev, 
          videos, 
          isDetecting: false 
        }));
      }
    } catch (error: unknown) {
      console.error('[Lock-in] detectAndAutoExtract failed:', error);
      
      // Handle auth required error
      if (error && typeof error === 'object' && 'type' in error && (error as { type: string }).type === 'AUTH_REQUIRED') {
        const authError = error as { type: string; provider: string; signInUrl: string };
        setState((prev) => ({
          ...prev,
          isDetecting: false,
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
          error: error instanceof Error ? error.message : "Failed to detect videos",
        }));
      }
    }
  }, [detectVideosInternal]);

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
