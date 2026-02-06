import type { DetectedVideo } from '@core/transcripts/types';
import type { PanoptoInfo } from '@core/transcripts';
import {
  buildPanoptoEmbedUrl,
  extractPanoptoInfo,
  extractPanoptoMediaUrl,
  resolvePanoptoInfoFromWrapperUrl,
} from '@core/transcripts';
import { BackgroundFetcher } from './fetcher';

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
