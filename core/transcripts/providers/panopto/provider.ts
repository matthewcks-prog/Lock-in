import type { DetectedVideo, TranscriptExtractionResult, VideoDetectionContext } from '../../types';
import type { TranscriptProviderV2 } from '../../providerRegistry';
import type { EnhancedAsyncFetcher } from '../../fetchers/types';
import { hasHtmlParsingSupport, hasRedirectSupport } from '../../fetchers/types';
import { parseWebVtt } from '../../webvttParser';
import {
  buildPanoptoEmbedUrl,
  buildPanoptoViewerUrl,
  extractPanoptoInfo,
  isPanoptoUrl,
} from './urlUtils';
import {
  extractCaptionVttUrl,
  resolveCaptionUrl,
  resolvePanoptoEmbedUrl,
  resolvePanoptoViewerUrl,
} from './extraction';

function buildCandidateUrls(video: DetectedVideo): string[] {
  const candidateUrls: string[] = [];
  if (video.panoptoTenant && video.id) {
    candidateUrls.push(
      buildPanoptoEmbedUrl(video.panoptoTenant, video.id),
      buildPanoptoViewerUrl(video.panoptoTenant, video.id),
    );
  }

  const primaryEmbedUrl = resolvePanoptoEmbedUrl(video);
  const viewerUrl = resolvePanoptoViewerUrl(video);
  if (primaryEmbedUrl) {
    candidateUrls.push(primaryEmbedUrl);
  }
  if (viewerUrl) {
    candidateUrls.push(viewerUrl);
  }

  candidateUrls.push(video.embedUrl);
  return Array.from(new Set(candidateUrls.filter(Boolean)));
}

async function fetchPanoptoHtml(fetcher: EnhancedAsyncFetcher, url: string) {
  if (hasRedirectSupport(fetcher) && fetcher.fetchHtmlWithRedirectInfo) {
    return fetcher.fetchHtmlWithRedirectInfo(url);
  }
  const html = await fetcher.fetchWithCredentials(url);
  return { html, finalUrl: url };
}

async function extractTranscriptFromUrl(
  url: string,
  fetcher: EnhancedAsyncFetcher,
  enqueueCandidate: (candidate: string | null) => void,
  onFetched: () => void,
): Promise<TranscriptExtractionResult | null> {
  const { html, finalUrl } = await fetchPanoptoHtml(fetcher, url);
  onFetched();

  const captionUrl = extractCaptionVttUrl(html);
  if (!captionUrl) {
    if (hasHtmlParsingSupport(fetcher) && fetcher.extractPanoptoInfoFromHtml) {
      const resolvedInfo = extractPanoptoInfo(finalUrl);
      const fromHtml = fetcher.extractPanoptoInfoFromHtml(html, finalUrl || url);
      const info = resolvedInfo || fromHtml?.info;

      if (fromHtml?.url) {
        enqueueCandidate(fromHtml.url);
      }
      if (info) {
        enqueueCandidate(buildPanoptoEmbedUrl(info.tenant, info.deliveryId));
        enqueueCandidate(buildPanoptoViewerUrl(info.tenant, info.deliveryId));
      }
    }
    return null;
  }

  const resolvedCaptionUrl = resolveCaptionUrl(captionUrl, finalUrl);
  const vttContent = await fetcher.fetchWithCredentials(resolvedCaptionUrl);
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
}

function mapPanoptoError(message: string): TranscriptExtractionResult {
  if (message === 'AUTH_REQUIRED') {
    return {
      success: false,
      error: 'Authentication required. Please log in to Panopto.',
      errorCode: 'AUTH_REQUIRED',
      aiTranscriptionAvailable: true,
    };
  }

  if (message.includes('timeout') || message.includes('AbortError')) {
    return {
      success: false,
      error: 'Request timeout. The server took too long to respond.',
      errorCode: 'TIMEOUT',
      aiTranscriptionAvailable: true,
    };
  }

  if (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('CORS') ||
    message.includes('Network request failed')
  ) {
    return {
      success: false,
      error:
        "Network error. Please check your internet connection and ensure you're logged into Panopto.",
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

/**
 * Panopto transcript provider implementation
 */
export class PanoptoProvider implements TranscriptProviderV2 {
  readonly provider = 'panopto' as const;

  canHandle(url: string): boolean {
    return isPanoptoUrl(url);
  }

  requiresAsyncDetection(_context: VideoDetectionContext): boolean {
    // Panopto uses DOM-based detection only
    return false;
  }

  /**
   * Detect Panopto videos using multiple strategies:
   * 1. Current page URL (if user is on Panopto directly)
   * 2. Embedded iframes
   */
  detectVideosSync(context: VideoDetectionContext): DetectedVideo[] {
    const seenIds = new Set<string>();
    const allVideos: DetectedVideo[] = [];

    const addVideos = (videos: DetectedVideo[]): void => {
      for (const video of videos) {
        if (!seenIds.has(video.id)) {
          seenIds.add(video.id);
          allVideos.push(video);
        }
      }
    };

    // Strategy 1: Check current page URL
    const pageInfo = extractPanoptoInfo(context.pageUrl);
    if (pageInfo) {
      addVideos([
        {
          id: pageInfo.deliveryId,
          provider: 'panopto',
          title: '',
          embedUrl: buildPanoptoEmbedUrl(pageInfo.tenant, pageInfo.deliveryId),
          panoptoTenant: pageInfo.tenant,
        },
      ]);
    }

    // Strategy 2: Check iframes
    for (const iframe of context.iframes) {
      if (!iframe.src) continue;
      const info = extractPanoptoInfo(iframe.src);
      if (info && !seenIds.has(info.deliveryId)) {
        seenIds.add(info.deliveryId);
        allVideos.push({
          id: info.deliveryId,
          provider: 'panopto',
          title: iframe.title || `Panopto video ${allVideos.length + 1}`,
          embedUrl: buildPanoptoEmbedUrl(info.tenant, info.deliveryId),
          panoptoTenant: info.tenant,
        });
      }
    }

    return allVideos;
  }

  async extractTranscript(
    video: DetectedVideo,
    fetcher: EnhancedAsyncFetcher,
  ): Promise<TranscriptExtractionResult> {
    try {
      if (!video.embedUrl) {
        return {
          success: false,
          error: 'No video URL provided',
          errorCode: 'INVALID_VIDEO',
          aiTranscriptionAvailable: true,
        };
      }

      const pendingUrls = buildCandidateUrls(video);
      const visitedUrls = new Set<string>();
      let anyFetched = false;
      let primaryError: unknown = null;

      const enqueueCandidate = (candidate: string | null): void => {
        if (!candidate) return;
        if (visitedUrls.has(candidate)) return;
        if (pendingUrls.includes(candidate)) return;
        pendingUrls.push(candidate);
      };

      while (pendingUrls.length > 0) {
        const url = pendingUrls.shift();
        if (!url || visitedUrls.has(url)) continue;
        visitedUrls.add(url);

        try {
          const result = await extractTranscriptFromUrl(url, fetcher, enqueueCandidate, () => {
            anyFetched = true;
          });
          if (result) {
            return result;
          }
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

      return {
        success: false,
        error: 'No captions available for this video',
        errorCode: 'NO_CAPTIONS',
        aiTranscriptionAvailable: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return mapPanoptoError(message);
    }
  }
}

/**
 * Create a new Panopto provider instance
 */
export function createPanoptoProvider(): PanoptoProvider {
  return new PanoptoProvider();
}
