/**
 * Transcript Message Handler
 *
 * Handles transcript-related messages from content scripts.
 * Runs in the background service worker context.
 *
 * Delegates transcript extraction to core providers via fetcher interface.
 */

import type { DetectedVideo, TranscriptExtractionResult } from '@core/transcripts/types';
import type { PanoptoInfo } from '@core/transcripts';
import type { EnhancedAsyncFetcher } from '@core/transcripts/fetchers/types';
import {
  buildPanoptoEmbedUrl,
  Echo360Provider,
  extractPanoptoInfo,
  extractPanoptoInfoFromHtml,
  extractPanoptoMediaUrl,
  getProviderRegistry,
  Html5Provider,
  PanoptoProvider,
  registerProvider,
  resolvePanoptoInfoFromWrapperUrl,
} from '@core/transcripts';

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

class BackgroundFetcher implements EnhancedAsyncFetcher {
  async fetchWithCredentials(url: string): Promise<string> {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: '*/*',
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

  async fetchJson<T>(url: string): Promise<T> {
    const text = await this.fetchWithCredentials(url);
    return JSON.parse(text) as T;
  }

  async fetchHtmlWithRedirectInfo(url: string): Promise<HtmlFetchResult> {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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

  extractPanoptoInfoFromHtml(html: string, baseUrl: string) {
    return extractPanoptoInfoFromHtml(html, baseUrl);
  }
}

let providersRegistered = false;

function ensureProvidersRegistered(): void {
  if (providersRegistered) return;
  registerProvider(new PanoptoProvider());
  registerProvider(new Echo360Provider());
  registerProvider(new Html5Provider());
  providersRegistered = true;
}

function getProviderForVideo(video: DetectedVideo) {
  const registry = getProviderRegistry();
  const providers = registry.getAll();
  return providers.find((provider) => provider.provider === video.provider) || null;
}

async function extractTranscriptForVideo(
  video: DetectedVideo,
): Promise<TranscriptExtractionResult> {
  if (!video || !video.provider) {
    return {
      success: false,
      error: 'No video provider specified',
      errorCode: 'INVALID_VIDEO',
      aiTranscriptionAvailable: true,
    };
  }

  ensureProvidersRegistered();
  const provider = getProviderForVideo(video);
  if (!provider || typeof provider.extractTranscript !== 'function') {
    return {
      success: false,
      error: `Unsupported video provider: ${video.provider}`,
      errorCode: 'NOT_AVAILABLE',
      aiTranscriptionAvailable: true,
    };
  }

  const fetcher = new BackgroundFetcher();
  try {
    return await provider.extractTranscript(video, fetcher);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message || 'Failed to extract transcript',
      errorCode: 'NOT_AVAILABLE',
      aiTranscriptionAvailable: true,
    };
  }
}

/**
 * Extract transcript from a Panopto video
 */
export async function extractPanoptoTranscript(
  video: DetectedVideo,
): Promise<TranscriptExtractionResult> {
  return extractTranscriptForVideo(video);
}

/**
 * Handle transcript extraction message
 */
export async function handleTranscriptMessage(
  message: TranscriptMessage,
): Promise<TranscriptResponse> {
  if (message.type !== 'EXTRACT_TRANSCRIPT') {
    return {
      success: false,
      error: `Unknown message type: ${message.type}`,
    };
  }

  const { video } = message.payload;
  const result = await extractTranscriptForVideo(video);
  return {
    success: result.success,
    data: result,
  };
}

function resolveRelativeUrl(candidate: string, baseUrl: string): string {
  try {
    return new URL(candidate, baseUrl).toString();
  } catch {
    return candidate;
  }
}

/**
 * Fetch and extract media URL from Panopto embed page
 * Used to enable AI transcription for Panopto videos
 */
export async function fetchPanoptoMediaUrl(
  video: DetectedVideo,
): Promise<{ success: boolean; mediaUrl?: string; error?: string; errorCode?: string }> {
  try {
    if (video.provider !== 'panopto') {
      return {
        success: false,
        error: 'Not a Panopto video',
        errorCode: 'NOT_AVAILABLE',
      };
    }

    const fetcher = new BackgroundFetcher();
    let resolvedInfo: PanoptoInfo | null = null;

    if (video.panoptoTenant) {
      resolvedInfo = { tenant: video.panoptoTenant, deliveryId: video.id };
    } else if (video.embedUrl) {
      resolvedInfo = extractPanoptoInfo(video.embedUrl);
    }

    if (!resolvedInfo && video.embedUrl) {
      const resolved = await resolvePanoptoInfoFromWrapperUrl(video.embedUrl, fetcher);
      if (resolved.authRequired) {
        return {
          success: false,
          error: 'Authentication required. Please log in to Panopto.',
          errorCode: 'AUTH_REQUIRED',
        };
      }
      resolvedInfo = resolved.info;
    }

    if (!resolvedInfo) {
      return {
        success: false,
        error: 'Could not resolve this Panopto link. Open the video once and try again.',
        errorCode: 'NOT_AVAILABLE',
      };
    }

    const embedUrl = buildPanoptoEmbedUrl(resolvedInfo.tenant, resolvedInfo.deliveryId);
    const html = await fetcher.fetchWithCredentials(embedUrl);
    const mediaUrl = extractPanoptoMediaUrl(html);

    if (!mediaUrl) {
      return {
        success: false,
        error:
          'Could not find video URL. The video may be restricted or not available for download.',
        errorCode: 'NOT_AVAILABLE',
      };
    }

    return {
      success: true,
      mediaUrl: resolveRelativeUrl(mediaUrl, embedUrl),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `Failed to fetch video URL: ${message}`,
      errorCode: 'NOT_AVAILABLE',
    };
  }
}
