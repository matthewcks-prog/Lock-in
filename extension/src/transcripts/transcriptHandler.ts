/**
 * Transcript Message Handler
 * 
 * Handles transcript-related messages from content scripts.
 * Runs in the background service worker context.
 * 
 * This module provides the background-side logic for:
 * - Fetching Panopto embed HTML (cross-origin)
 * - Extracting caption URLs
 * - Fetching and parsing VTT captions
 */

import type {
  DetectedVideo,
  TranscriptExtractionResult,
} from '@core/transcripts/types';
import type { PanoptoInfo } from '@core/transcripts';
import {
  buildPanoptoEmbedUrl,
  buildPanoptoViewerUrl,
  extractCaptionVttUrl,
  extractPanoptoInfo,
  extractPanoptoMediaUrl,
} from '@core/transcripts';
import { parseWebVtt } from '@core/transcripts/webvttParser';

/**
 * Message types for transcript operations
 */
export interface TranscriptMessage {
  type: 'EXTRACT_TRANSCRIPT';
  payload: {
    video: DetectedVideo;
  };
}

export interface TranscriptResponse {
  success: boolean;
  data?: TranscriptExtractionResult;
  error?: string;
}

interface HtmlFetchResult {
  html: string;
  finalUrl: string;
  redirected: boolean;
  status: number;
}

const PANOPTO_LOG_PREFIX = '[Lock-in Transcript:Panopto]';

function isDebugEnabled(): boolean {
  const config = (globalThis as { LOCKIN_CONFIG?: Record<string, unknown> })
    .LOCKIN_CONFIG;
  const logLevel =
    typeof config?.LOG_LEVEL === 'string'
      ? config.LOG_LEVEL.toLowerCase()
      : null;
  const debug =
    config?.DEBUG === true || config?.DEBUG === 'true' || logLevel === 'debug';

  return debug;
}

function debugLog(message: string, data?: Record<string, unknown>): void {
  if (!isDebugEnabled()) return;
  if (data) {
    console.debug(PANOPTO_LOG_PREFIX, message, data);
    return;
  }
  console.debug(PANOPTO_LOG_PREFIX, message);
}

function formatUrlForLog(url: string): Record<string, unknown> {
  try {
    const parsed = new URL(url);
    return {
      origin: parsed.origin,
      path: parsed.pathname,
      queryKeys: Array.from(parsed.searchParams.keys()),
    };
  } catch {
    return { raw: url };
  }
}

function summarizeCaptionMarkers(html: string): Record<string, boolean | number> {
  const normalized = html.toLowerCase();
  return {
    htmlLength: html.length,
    hasCaptionUrlKey: normalized.includes('captionurl'),
    hasCaptionsKey: normalized.includes('"captions"'),
    hasTranscriptUrlKey: normalized.includes('transcripturl'),
    hasGetCaptionVtt: normalized.includes('getcaptionvtt.ashx'),
    hasRelativeCaptionUrl: normalized.includes('/panopto/pages/transcription/getcaptionvtt.ashx'),
  };
}

function looksLikeAuthPage(html: string): boolean {
  const normalized = html.toLowerCase();
  if (normalized.includes('samlrequest')) return true;
  if (normalized.includes('signin') && normalized.includes('password')) return true;
  if (normalized.includes('log in') && normalized.includes('password')) return true;
  if (normalized.includes('panopto') && normalized.includes('login')) return true;
  return false;
}

const SSO_DOMAINS = [
  'okta.com',
  'auth0.com',
  'login.microsoftonline.com',
  'accounts.google.com',
];

function isSsoRedirectUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return SSO_DOMAINS.some((domain) => hostname.includes(domain));
  } catch {
    return false;
  }
}

function resolvePanoptoEmbedUrl(video: DetectedVideo): string {
  if (video.panoptoTenant) {
    return buildPanoptoEmbedUrl(video.panoptoTenant, video.id);
  }

  const info = extractPanoptoInfo(video.embedUrl);
  return info ? buildPanoptoEmbedUrl(info.tenant, info.deliveryId) : video.embedUrl;
}

function resolvePanoptoViewerUrl(video: DetectedVideo): string | null {
  if (video.panoptoTenant) {
    return buildPanoptoViewerUrl(video.panoptoTenant, video.id);
  }

  const info = extractPanoptoInfo(video.embedUrl);
  return info ? buildPanoptoViewerUrl(info.tenant, info.deliveryId) : null;
}

function resolveCaptionUrl(captionUrl: string, baseUrl: string): string {
  const decoded = decodeEscapedUrl(captionUrl);
  try {
    return new URL(decoded, baseUrl).toString();
  } catch {
    return decoded;
  }
}

function decodeEscapedUrl(value: string): string {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\\\//g, '/')
    .replace(/\\\\/g, '\\')
    .replace(/\\\"/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/gi, '/')
    .replace(/&#x3D;/gi, '=')
    .replace(/&#39;/g, "'")
    .trim();
}

function normalizePanoptoCandidateUrl(
  candidate: string,
  baseUrl: string
): string | null {
  const decoded = decodeEscapedUrl(candidate);
  if (!decoded || decoded.startsWith('javascript:')) return null;
  const withProtocol = decoded.startsWith('//') ? `https:${decoded}` : decoded;
  try {
    return new URL(withProtocol, baseUrl).toString();
  } catch {
    return withProtocol;
  }
}

function extractPanoptoInfoFromHtml(
  html: string,
  baseUrl: string
): { info: PanoptoInfo; url: string } | null {
  const candidates = new Set<string>();
  const urlMatches = html.match(/(?:https?:)?\/\/[^\s"'<>]+/gi) || [];
  const escapedMatches = html.match(/https?:\\\/\\\/[^\s"'<>]+/gi) || [];
  const encodedMatches = html.match(/https?%3A%2F%2F[^\s"'<>]+/gi) || [];

  for (const match of [...urlMatches, ...escapedMatches, ...encodedMatches]) {
    if (!match.toLowerCase().includes('panopto')) continue;
    candidates.add(match);
  }

  for (const candidate of candidates) {
    const normalized = normalizePanoptoCandidateUrl(candidate, baseUrl);
    if (normalized) {
      const info = extractPanoptoInfo(normalized);
      if (info) return { info, url: normalized };
      try {
        const decoded = decodeURIComponent(normalized);
        if (decoded !== normalized) {
          const decodedInfo = extractPanoptoInfo(decoded);
          if (decodedInfo) return { info: decodedInfo, url: decoded };
        }
      } catch {
        // Ignore decode errors
      }
    }
  }

  return null;
}

async function resolvePanoptoInfoFromWrapperUrl(
  url: string
): Promise<{ info: PanoptoInfo | null; authRequired: boolean; finalUrl?: string }> {
  try {
    const { html, finalUrl } = await fetchHtmlWithCredentials(url);
    const directInfo = extractPanoptoInfo(finalUrl);
    if (directInfo) {
      return { info: directInfo, authRequired: false, finalUrl };
    }

    const fromHtml = extractPanoptoInfoFromHtml(html, finalUrl || url);
    if (fromHtml) {
      return { info: fromHtml.info, authRequired: false, finalUrl: fromHtml.url };
    }

    return { info: null, authRequired: false, finalUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'AUTH_REQUIRED') {
      return { info: null, authRequired: true };
    }
    return { info: null, authRequired: false };
  }
}

/**
 * Fetch HTML from a URL with credentials
 * Used to fetch Panopto embed pages which require session cookies
 */
async function fetchHtmlWithCredentials(url: string): Promise<HtmlFetchResult> {
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('AUTH_REQUIRED');
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const html = await response.text();
  return {
    html,
    finalUrl: response.url,
    redirected: response.redirected,
    status: response.status,
  };
}

/**
 * Fetch VTT content from a caption URL
 */
async function fetchVttContent(url: string): Promise<string> {
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'text/vtt,text/plain,*/*',
    },
  });
  
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('AUTH_REQUIRED');
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.text();
}

/**
 * Extract transcript from a Panopto video
 */
export async function extractPanoptoTranscript(
  video: DetectedVideo
): Promise<TranscriptExtractionResult> {
  try {
    // Prefer embed URLs because Panopto viewer pages often omit caption metadata.
    const primaryEmbedUrl = resolvePanoptoEmbedUrl(video);
    const viewerUrl = resolvePanoptoViewerUrl(video);
    const candidateUrls = [
      primaryEmbedUrl,
      viewerUrl,
      video.embedUrl,
    ].filter(Boolean) as string[];
    const uniqueCandidateUrls = Array.from(new Set(candidateUrls));
    debugLog('Panopto transcript request', {
      videoId: video.id,
      candidateUrls: uniqueCandidateUrls.map(formatUrlForLog),
    });

    const pendingUrls = [...uniqueCandidateUrls];
    const visitedUrls = new Set<string>();
    const enqueueCandidate = (candidate: string | null | undefined): void => {
      if (!candidate) return;
      if (visitedUrls.has(candidate)) return;
      if (pendingUrls.includes(candidate)) return;
      pendingUrls.push(candidate);
    };

    const extractFromUrl = async (
      url: string
    ): Promise<TranscriptExtractionResult | null> => {
      debugLog('Fetching Panopto HTML', { url: formatUrlForLog(url) });
      const { html, finalUrl, redirected, status } = await fetchHtmlWithCredentials(url);
      anyFetched = true;
      const markers = summarizeCaptionMarkers(html);
      debugLog('Fetched Panopto HTML', {
        requestedUrl: formatUrlForLog(url),
        finalUrl: formatUrlForLog(finalUrl),
        redirected,
        status,
        ...markers,
      });

      if (isSsoRedirectUrl(finalUrl)) {
        authDetected = true;
        debugLog('SSO redirect detected while fetching Panopto HTML', {
          finalUrl: formatUrlForLog(finalUrl),
        });
        return null;
      }

      if (looksLikeAuthPage(html)) {
        authDetected = true;
        debugLog('Panopto HTML resembles auth page', {
          requestedUrl: formatUrlForLog(url),
          finalUrl: formatUrlForLog(finalUrl),
        });
        return null;
      }

      const captionUrl = extractCaptionVttUrl(html);
      if (!captionUrl) {
        const resolvedInfo = extractPanoptoInfo(finalUrl);
        const fromHtml = extractPanoptoInfoFromHtml(html, finalUrl || url);
        const info = resolvedInfo || fromHtml?.info;

        if (fromHtml?.url) {
          enqueueCandidate(fromHtml.url);
        }
        if (info) {
          enqueueCandidate(buildPanoptoEmbedUrl(info.tenant, info.deliveryId));
          enqueueCandidate(buildPanoptoViewerUrl(info.tenant, info.deliveryId));
        }

        return null;
      }

      const resolvedCaptionUrl = resolveCaptionUrl(captionUrl, finalUrl || url);
      debugLog('Caption URL extracted', { url: formatUrlForLog(resolvedCaptionUrl) });

      const vttContent = await fetchVttContent(resolvedCaptionUrl);
      const transcript = parseWebVtt(vttContent);

      if (transcript.segments.length === 0) {
        return {
          success: false,
          error: 'Caption file is empty or could not be parsed',
          errorCode: 'PARSE_ERROR',
          aiTranscriptionAvailable: true,
        };
      }

      return {
        success: true,
        transcript,
      };
    };

    let anyFetched = false;
    let primaryError: unknown = null;
    let authDetected = false;

    while (pendingUrls.length > 0) {
      const url = pendingUrls.shift();
      if (!url || visitedUrls.has(url)) {
        continue;
      }
      visitedUrls.add(url);
      try {
        const result = await extractFromUrl(url);
        if (result) return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'AUTH_REQUIRED') {
          throw error;
        }
        if (!primaryError) {
          primaryError = error;
        }
      }
    }

    if (!anyFetched && primaryError) {
      throw primaryError;
    }

    if (authDetected) {
      return {
        success: false,
        error: 'Authentication required. Please log in to Panopto.',
        errorCode: 'AUTH_REQUIRED',
        aiTranscriptionAvailable: true,
      };
    }

    return {
      success: false,
      error: 'No captions available for this video',
      errorCode: 'NO_CAPTIONS',
      aiTranscriptionAvailable: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    
    if (message === 'AUTH_REQUIRED') {
      return {
        success: false,
        error: 'Authentication required. Please log in to Panopto.',
        errorCode: 'AUTH_REQUIRED',
        aiTranscriptionAvailable: true,
      };
    }
    
    if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
      return {
        success: false,
        error: 'Network error. Please check your connection.',
        errorCode: 'NETWORK_ERROR',
        aiTranscriptionAvailable: true,
      };
    }
    
    return {
      success: false,
      error: `Failed to extract transcript: ${message}`,
      errorCode: 'PARSE_ERROR',
      aiTranscriptionAvailable: true,
    };
  }
}

/**
 * Handle transcript extraction message
 */
export async function handleTranscriptMessage(
  message: TranscriptMessage
): Promise<TranscriptResponse> {
  if (message.type !== 'EXTRACT_TRANSCRIPT') {
    return {
      success: false,
      error: `Unknown message type: ${message.type}`,
    };
  }
  
  const { video } = message.payload;
  
  switch (video.provider) {
    case 'panopto': {
      const result = await extractPanoptoTranscript(video);
      return {
        success: result.success,
        data: result,
      };
    }
    
    case 'html5': {
      // HTML5 videos should primarily be handled by DOM extraction in the content script.
      // If we reach here, it means DOM extraction failed and there are no track URLs.
      // We can try fetching track URLs if available.
      if (video.trackUrls && video.trackUrls.length > 0) {
        for (const track of video.trackUrls) {
          try {
            const vttContent = await fetchVttContent(track.src);
            const transcript = parseWebVtt(vttContent);
            
            if (transcript.segments.length > 0) {
              return {
                success: true,
                data: { success: true, transcript },
              };
            }
          } catch (e) {
            // Continue to try other tracks
          }
        }
      }
      
      // No captions available for this HTML5 video
      return {
        success: false,
        data: {
          success: false,
          error: 'No captions available for this video. This video does not have embedded subtitles or captions.',
          errorCode: 'NO_CAPTIONS',
          aiTranscriptionAvailable: true,
        },
      };
    }
    
    default:
      return {
        success: false,
        error: `Unsupported video provider: ${video.provider}`,
      };
  }
}

/**
 * Fetch and extract media URL from Panopto embed page
 * Used to enable AI transcription for Panopto videos
 */
export async function fetchPanoptoMediaUrl(
  video: DetectedVideo
): Promise<{ success: boolean; mediaUrl?: string; error?: string }> {
  try {
    if (video.provider !== 'panopto') {
      return {
        success: false,
        error: 'Not a Panopto video',
      };
    }

    let resolvedInfo: PanoptoInfo | null = null;
    if (video.panoptoTenant) {
      resolvedInfo = { tenant: video.panoptoTenant, deliveryId: video.id };
    } else {
      resolvedInfo = extractPanoptoInfo(video.embedUrl);
    }

    if (!resolvedInfo) {
      const resolved = await resolvePanoptoInfoFromWrapperUrl(video.embedUrl);
      if (resolved.authRequired) {
        return {
          success: false,
          error: 'Authentication required. Please log in to Panopto.',
        };
      }
      resolvedInfo = resolved.info;
    }

    if (!resolvedInfo) {
      return {
        success: false,
        error: 'Could not resolve this Panopto link. Open the video once and try again.',
      };
    }

    const resolvedVideo: DetectedVideo = {
      ...video,
      id: resolvedInfo.deliveryId,
      panoptoTenant: resolvedInfo.tenant,
    };

    const embedUrl = resolvePanoptoEmbedUrl(resolvedVideo);
    debugLog('Fetching Panopto media URL', { embedUrl: formatUrlForLog(embedUrl) });

    const { html, finalUrl, status } = await fetchHtmlWithCredentials(embedUrl);
    debugLog('Fetched Panopto HTML for media URL', {
      finalUrl: formatUrlForLog(finalUrl),
      status,
      htmlLength: html.length,
    });

    if (isSsoRedirectUrl(finalUrl)) {
      return {
        success: false,
        error: 'Authentication required. Please log in to Panopto.',
      };
    }

    if (looksLikeAuthPage(html)) {
      return {
        success: false,
        error: 'Authentication required. Please log in to Panopto.',
      };
    }

    const mediaUrl = extractPanoptoMediaUrl(html);
    
    if (!mediaUrl) {
      return {
        success: false,
        error: 'Could not find video URL. The video may be restricted or not available for download.',
      };
    }

    // Resolve relative URLs
    const resolvedMediaUrl = resolveCaptionUrl(mediaUrl, finalUrl || embedUrl);
    debugLog('Media URL extracted', { mediaUrl: formatUrlForLog(resolvedMediaUrl) });

    return {
      success: true,
      mediaUrl: resolvedMediaUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Lock-in Transcript:Panopto] Error fetching media URL:', message);
    
    return {
      success: false,
      error: `Failed to fetch video URL: ${message}`,
    };
  }
}
