import type { DetectedVideo, TranscriptExtractionResult, VideoDetectionContext } from '../../types';
import type { TranscriptProviderV2 } from '../../providerRegistry';
import type { AsyncFetcher } from '../../fetchers/types';
import { parseWebVtt } from '../../webvttParser';
import {
  isYouTubeUrl,
  extractYouTubeInfo,
  buildYouTubeEmbedUrl,
  buildYouTubeWatchUrl,
} from './urlUtils';
import {
  type CaptionTrack,
  extractCaptionTracks,
  selectBestTrack,
  buildCaptionUrl,
  buildTimedtextUrls,
  parseYouTubeXmlTranscript,
} from './captionExtraction';

const isNonEmptyString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.length > 0;

function buildNoCaptionsResult(): TranscriptExtractionResult {
  return {
    success: false,
    error: 'No captions available for this YouTube video',
    errorCode: 'NO_CAPTIONS',
    aiTranscriptionAvailable: true,
  };
}

function buildNetworkErrorResult(message: string): TranscriptExtractionResult {
  if (message.includes('timeout') || message.includes('AbortError')) {
    return {
      success: false,
      error: 'Request timeout. The server took too long to respond.',
      errorCode: 'TIMEOUT',
      aiTranscriptionAvailable: true,
    };
  }

  return {
    success: false,
    error: `Failed to fetch YouTube transcript: ${message}`,
    errorCode: 'NETWORK_ERROR',
    aiTranscriptionAvailable: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Strategy 1: Direct timedtext API (most reliable from service workers)
// ─────────────────────────────────────────────────────────────────────────────

function isNonEmptyXml(content: string): boolean {
  return content.length > 0 && content.includes('<text');
}

async function tryTimedtextApi(
  videoId: string,
  fetcher: AsyncFetcher,
): Promise<TranscriptExtractionResult | null> {
  const urls = buildTimedtextUrls(videoId);

  for (const url of urls) {
    try {
      const content = await fetcher.fetchWithCredentials(url);
      if (isNonEmptyXml(content)) {
        const transcript = parseYouTubeXmlTranscript(content);
        if (transcript.segments.length > 0) {
          return { success: true, transcript };
        }
      }
    } catch {
      // This URL didn't work, try next
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Strategy 2: Watch page HTML scraping
// ─────────────────────────────────────────────────────────────────────────────

async function tryWatchPageExtraction(
  videoId: string,
  fetcher: AsyncFetcher,
): Promise<TranscriptExtractionResult | null> {
  try {
    const watchUrl = buildYouTubeWatchUrl(videoId);
    const html = await fetcher.fetchWithCredentials(watchUrl);
    const { tracks } = extractCaptionTracks(html);

    if (tracks.length === 0) return null;

    const bestTrack = selectBestTrack(tracks);
    if (bestTrack === null) return null;

    return fetchAndParseCaption(bestTrack, fetcher);
  } catch {
    return null;
  }
}

async function fetchAndParseCaption(
  track: CaptionTrack,
  fetcher: AsyncFetcher,
): Promise<TranscriptExtractionResult | null> {
  // Try VTT format first
  try {
    const captionUrl = buildCaptionUrl(track);
    const content = await fetcher.fetchWithCredentials(captionUrl);

    if (content.length > 0) {
      const transcript = parseWebVtt(content);
      if (transcript.segments.length > 0) {
        return { success: true, transcript };
      }

      const xmlTranscript = parseYouTubeXmlTranscript(content);
      if (xmlTranscript.segments.length > 0) {
        return { success: true, transcript: xmlTranscript };
      }
    }
  } catch {
    // VTT fetch failed
  }

  // Try raw baseUrl (XML format)
  try {
    const rawContent = await fetcher.fetchWithCredentials(track.baseUrl);
    if (rawContent.length > 0) {
      const rawXml = parseYouTubeXmlTranscript(rawContent);
      if (rawXml.segments.length > 0) {
        return { success: true, transcript: rawXml };
      }
    }
  } catch {
    // Raw fetch failed
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export class YouTubeProvider implements TranscriptProviderV2 {
  readonly provider = 'youtube' as const;

  canHandle(url: string): boolean {
    return isYouTubeUrl(url);
  }

  requiresAsyncDetection(_context: VideoDetectionContext): boolean {
    return false;
  }

  detectVideosSync(context: VideoDetectionContext): DetectedVideo[] {
    const seenIds = new Set<string>();
    const videos: DetectedVideo[] = [];

    const addVideo = (videoId: string, title: string): void => {
      if (seenIds.has(videoId)) return;
      seenIds.add(videoId);
      videos.push({
        id: videoId,
        provider: 'youtube',
        title: title.length > 0 ? title : `YouTube video`,
        embedUrl: buildYouTubeEmbedUrl(videoId),
      });
    };

    const pageInfo = extractYouTubeInfo(context.pageUrl);
    if (pageInfo !== null) {
      addVideo(pageInfo.videoId, '');
    }

    for (const iframe of context.iframes) {
      if (iframe.src.length === 0) continue;
      const info = extractYouTubeInfo(iframe.src);
      if (info !== null) {
        const iframeTitle = isNonEmptyString(iframe.title) ? iframe.title : '';
        addVideo(info.videoId, iframeTitle);
      }
    }

    return videos;
  }

  async extractTranscript(
    video: DetectedVideo,
    fetcher: AsyncFetcher,
  ): Promise<TranscriptExtractionResult> {
    try {
      if (video.id.length === 0) {
        return {
          success: false,
          error: 'No video ID provided',
          errorCode: 'INVALID_VIDEO',
          aiTranscriptionAvailable: true,
        };
      }

      // Strategy 1: Direct timedtext API (works without HTML parsing)
      const timedtextResult = await tryTimedtextApi(video.id, fetcher);
      if (timedtextResult !== null) {
        return timedtextResult;
      }

      // Strategy 2: Watch page HTML scraping
      const watchPageResult = await tryWatchPageExtraction(video.id, fetcher);
      if (watchPageResult !== null) {
        return watchPageResult;
      }

      return buildNoCaptionsResult();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return buildNetworkErrorResult(message);
    }
  }
}

export function createYouTubeProvider(): YouTubeProvider {
  return new YouTubeProvider();
}
