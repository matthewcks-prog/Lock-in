/**
 * Lock-in Background Service Worker
 *
 * Handles context menu integration, per-tab session management, and extension-level coordination.
 * Uses the messaging system for typed communication.
 */

// ============================================================================
// Import shared libraries
// ============================================================================

// Config must be first (sets up LOCKIN_CONFIG)
try {
  importScripts('config.js');
} catch (e) {
  console.warn('Lock-in: Failed to import config.js:', e);
}

// Sentry error tracking (must be early, after config)
try {
  importScripts('dist/libs/sentry.js');
  if (typeof self !== 'undefined' && self.LockInSentry) {
    self.LockInSentry.initSentry('background');
    self.LockInSentry.setupMv3Lifecycle();
  }
} catch (e) {
  console.warn('Lock-in: Failed to import/init sentry.js:', e);
}

// Other shared libraries
try {
  importScripts('dist/libs/webvttParser.js');
} catch (e) {
  console.warn('Lock-in: Failed to import webvttParser.js:', e);
}
try {
  importScripts('dist/libs/transcriptProviders.js');
} catch (e) {
  console.warn('Lock-in: Failed to import transcriptProviders.js:', e);
}
try {
  importScripts('src/networkUtils.js');
} catch (e) {
  console.warn('Lock-in: Failed to import networkUtils.js:', e);
}
try {
  importScripts('src/panoptoResolver.js');
} catch (e) {
  console.warn('Lock-in: Failed to import panoptoResolver.js:', e);
}

// Import messaging system (available via global in service worker)
const Messaging = typeof self !== 'undefined' && self.LockInMessaging ? self.LockInMessaging : null;

// Get shared VTT parser
const WebVtt = typeof self !== 'undefined' && self.LockInWebVtt ? self.LockInWebVtt : null;
const TranscriptProviders =
  typeof self !== 'undefined' && self.LockInTranscriptProviders
    ? self.LockInTranscriptProviders
    : null;
const NetworkUtils =
  typeof self !== 'undefined' && self.LockInNetworkUtils ? self.LockInNetworkUtils : null;
const PanoptoResolver =
  typeof self !== 'undefined' && self.LockInPanoptoResolver ? self.LockInPanoptoResolver : null;
const { fetchWithRetry, fetchWithCredentials, fetchVttContent, fetchHtmlWithRedirectInfo } =
  NetworkUtils || {};
const {
  extractCaptionVttUrl,
  resolveCaptionUrl,
  extractPanoptoInfoFromHtml,
  resolvePanoptoInfoFromWrapperUrl,
  extractPanoptoInfoFromUrl,
  buildPanoptoViewerUrl,
  buildPanoptoEmbedUrl,
  PanoptoMediaResolver,
} = PanoptoResolver || {};

// ─────────────────────────────────────────────────────────────────────────────
// Transcript Extraction Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse WebVTT content into structured segments
 * Uses shared parser from dist/libs/webvttParser.js if available, otherwise fallback
 */
function parseWebVtt(vttContent) {
  if (WebVtt && typeof WebVtt.parseWebVtt === 'function') {
    return WebVtt.parseWebVtt(vttContent);
  }
  // Fallback: minimal parser in case shared lib not loaded
  console.warn('Lock-in: Using fallback VTT parser');
  const lines = vttContent.split(/\r?\n/);
  const segments = [];
  const textParts = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('WEBVTT') && !trimmed.includes('-->')) {
      textParts.push(trimmed);
    }
  }
  return {
    plainText: textParts.join(' '),
    segments,
    durationMs: 0,
  };
}

/**
 * Extract transcript from a Panopto video
 */
async function extractPanoptoTranscript(video) {
  console.log('[Lock-in] extractPanoptoTranscript starting for:', {
    id: video.id,
    title: video.title,
    embedUrl: video.embedUrl,
  });

  try {
    // Validate video embedUrl
    if (!video.embedUrl) {
      console.error('[Lock-in] No embedUrl provided for Panopto video');
      return {
        success: false,
        error: 'No video URL provided',
        errorCode: 'INVALID_VIDEO',
        aiTranscriptionAvailable: true,
      };
    }

    const candidateUrls = [];
    if (video.panoptoTenant && video.id) {
      candidateUrls.push(
        buildPanoptoEmbedUrl(video.panoptoTenant, video.id),
        buildPanoptoViewerUrl(video.panoptoTenant, video.id),
      );
    }

    const directInfo = extractPanoptoInfoFromUrl(video.embedUrl);
    if (directInfo) {
      candidateUrls.push(
        buildPanoptoEmbedUrl(directInfo.tenant, directInfo.deliveryId),
        buildPanoptoViewerUrl(directInfo.tenant, directInfo.deliveryId),
      );
    }

    candidateUrls.push(video.embedUrl);
    const pendingUrls = Array.from(new Set(candidateUrls.filter(Boolean)));
    const visitedUrls = new Set();
    let anyFetched = false;
    let primaryError = null;

    const enqueueCandidate = (candidate) => {
      if (!candidate) return;
      if (visitedUrls.has(candidate)) return;
      if (pendingUrls.includes(candidate)) return;
      pendingUrls.push(candidate);
    };

    const extractFromUrl = async (url) => {
      console.log('[Lock-in] Fetching Panopto HTML:', url.substring(0, 120));
      const { html, finalUrl } = await fetchHtmlWithRedirectInfo(url);
      anyFetched = true;

      const captionUrl = extractCaptionVttUrl(html);
      if (!captionUrl) {
        const resolvedInfo = extractPanoptoInfoFromUrl(finalUrl);
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

      console.log('[Lock-in] Caption URL found:', captionUrl.substring(0, 100));
      const resolvedCaptionUrl = resolveCaptionUrl(captionUrl, finalUrl || url);

      console.log('[Lock-in] Fetching VTT content...');
      const vttContent = await fetchVttContent(resolvedCaptionUrl);

      console.log('[Lock-in] Parsing VTT content...');
      const transcript = parseWebVtt(vttContent);

      if (transcript.segments.length === 0) {
        console.warn('[Lock-in] Parsed transcript has no segments');
        return {
          success: false,
          error: 'Caption file is empty or could not be parsed',
          errorCode: 'PARSE_ERROR',
          aiTranscriptionAvailable: true,
        };
      }

      console.log('[Lock-in] Transcript extracted successfully:', {
        segments: transcript.segments.length,
        plainTextLength: transcript.plainText?.length || 0,
        durationMs: transcript.durationMs,
      });

      return { success: true, transcript };
    };

    while (pendingUrls.length > 0) {
      const url = pendingUrls.shift();
      if (!url || visitedUrls.has(url)) continue;
      visitedUrls.add(url);

      try {
        const result = await extractFromUrl(url);
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
    console.error('[Lock-in] extractPanoptoTranscript error:', message, error);

    // Auth error
    if (message === 'AUTH_REQUIRED') {
      return {
        success: false,
        error: 'Authentication required. Please log in to Panopto.',
        errorCode: 'AUTH_REQUIRED',
        aiTranscriptionAvailable: true,
      };
    }

    // Timeout error
    if (message.includes('timeout') || message.includes('AbortError')) {
      return {
        success: false,
        error: 'Request timeout. The server took too long to respond.',
        errorCode: 'TIMEOUT',
        aiTranscriptionAvailable: true,
      };
    }

    // Network/CORS errors
    if (
      message.includes('Failed to fetch') ||
      message.includes('NetworkError') ||
      message.includes('CORS') ||
      message.includes('Network request failed')
    ) {
      console.error('[Lock-in] Network error details:', {
        message,
        embedUrl: video.embedUrl,
        error: error.toString(),
      });
      return {
        success: false,
        error:
          "Network error. Please check your internet connection and ensure you're logged into Panopto.",
        errorCode: 'NETWORK_ERROR',
        aiTranscriptionAvailable: true,
      };
    }

    // Generic error
    return {
      success: false,
      error: `Failed to extract transcript: ${message}`,
      errorCode: 'PARSE_ERROR',
      aiTranscriptionAvailable: true,
    };
  }
}

/**
 * Extract transcript from an HTML5 video using track URLs
 */
async function extractHtml5Transcript(video) {
  console.log('[Lock-in BG] extractHtml5Transcript called for video:', video.id, video.title);
  const tracks = Array.isArray(video.trackUrls) ? video.trackUrls : [];
  console.log(
    '[Lock-in BG] Track URLs found:',
    tracks.length,
    tracks.map((t) => t?.src),
  );

  if (tracks.length === 0) {
    console.log('[Lock-in BG] No caption tracks available for HTML5 video');
    return {
      success: false,
      error: 'No captions found',
      errorCode: 'NO_CAPTIONS',
      aiTranscriptionAvailable: true,
    };
  }

  let lastError = null;

  for (const track of tracks) {
    if (!track || !track.src) continue;
    try {
      const vttContent = await fetchVttContent(track.src);
      const transcript = parseWebVtt(vttContent);

      if (transcript.segments.length > 0) {
        return { success: true, transcript };
      }

      lastError = {
        error: 'Caption file is empty or could not be parsed',
        errorCode: 'PARSE_ERROR',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message === 'AUTH_REQUIRED') {
        return {
          success: false,
          error: 'Authentication required to access captions.',
          errorCode: 'AUTH_REQUIRED',
          aiTranscriptionAvailable: true,
        };
      }

      if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
        lastError = {
          error: 'Captions could not be fetched due to browser restrictions or network errors.',
          errorCode: 'NOT_AVAILABLE',
        };
      } else {
        lastError = {
          error: `Failed to fetch captions: ${message}`,
          errorCode: 'NOT_AVAILABLE',
        };
      }
    }
  }

  if (lastError) {
    return {
      success: false,
      error: lastError.error,
      errorCode: lastError.errorCode,
      aiTranscriptionAvailable: true,
    };
  }

  return {
    success: false,
    error: 'No captions found',
    errorCode: 'NO_CAPTIONS',
    aiTranscriptionAvailable: true,
  };
}
// ─────────────────────────────────────────────────────────────────────────────
// Extension Fetcher (Chrome-specific implementation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extension-specific fetcher implementation
 * Handles CORS, credentials, and redirects using Chrome extension privileges.
 * This adapter allows core providers to work in the extension context.
 */
class ExtensionFetcher {
  /**
   * Fetch with credentials (sends cookies)
   * Background script can do this, content script cannot
   */
  async fetchWithCredentials(url) {
    return fetchWithCredentials(url);
  }

  /**
   * Fetch JSON with credentials
   */
  async fetchJson(url) {
    const text = await this.fetchWithCredentials(url);
    return JSON.parse(text);
  }

  /**
   * Fetch HTML with redirect tracking
   * Background script can access response.url for final redirect URL
   */
  async fetchHtmlWithRedirectInfo(url) {
    return fetchHtmlWithRedirectInfo(url);
  }

  /**
   * Extract Panopto info from HTML
   * Pure function - delegates to existing helper
   */
  extractPanoptoInfoFromHtml(html, baseUrl) {
    return extractPanoptoInfoFromHtml(html, baseUrl);
  }
}

/**
 * Handle transcript extraction for supported providers.
 * Delegates to core providers while preserving Chrome-specific fetching.
 */
async function handleTranscriptExtraction(video) {
  console.log('[Lock-in BG] handleTranscriptExtraction called');
  if (!video || !video.provider) {
    return {
      success: false,
      error: 'No video provider specified',
      errorCode: 'INVALID_VIDEO',
      aiTranscriptionAvailable: true,
    };
  }

  switch (video.provider) {
    case 'panopto': {
      console.log('[Lock-in BG] Handling Panopto video');

      const Provider =
        (TranscriptProviders && TranscriptProviders.PanoptoProvider) ||
        (typeof self !== 'undefined' && self.PanoptoProvider
          ? self.PanoptoProvider.PanoptoProvider || self.PanoptoProvider
          : null);

      if (Provider) {
        try {
          const provider = new Provider();
          const fetcher = new ExtensionFetcher();
          const result = await provider.extractTranscript(video, fetcher);
          console.log('[Lock-in BG] Panopto result (via provider):', result.success);
          return result;
        } catch (error) {
          console.warn('[Lock-in BG] Provider extraction failed, using legacy:', error);
          // Fall through to legacy function
        }
      }

      // Legacy extraction (preserved for backward compatibility)
      const result = await extractPanoptoTranscript(video);
      console.log('[Lock-in BG] Panopto result (legacy):', result.success);
      return result;
    }
    case 'echo360': {
      console.log('[Lock-in BG] Handling Echo360 video', {
        videoId: video.id,
        embedUrl: video.embedUrl,
        lessonId: video.echoLessonId,
        mediaId: video.echoMediaId,
        baseUrl: video.echoBaseUrl,
        title: video.title,
      });
      if (TranscriptProviders && TranscriptProviders.Echo360Provider) {
        try {
          const provider = new TranscriptProviders.Echo360Provider();
          const fetcher = new ExtensionFetcher();
          console.log('[Lock-in BG] Echo360 provider created, starting extraction');
          const result = await provider.extractTranscript(video, fetcher);
          console.log('[Lock-in BG] Echo360 extraction completed', {
            success: result.success,
            error: result.error,
            errorCode: result.errorCode,
            hasTranscript: !!result.transcript,
            transcriptSegments: result.transcript?.segments?.length,
            transcriptChars: result.transcript?.plainText?.length,
          });
          return result;
        } catch (error) {
          console.error('[Lock-in BG] Echo360 provider extraction failed:', {
            error: error?.message,
            stack: error?.stack,
            errorObject: error,
            videoId: video.id,
            embedUrl: video.embedUrl,
          });
          return {
            success: false,
            error: 'Failed to extract Echo360 transcript',
            errorCode: 'NOT_AVAILABLE',
            aiTranscriptionAvailable: true,
          };
        }
      }
      console.warn('[Lock-in BG] Echo360 provider is not available');
      return {
        success: false,
        error: 'Echo360 provider is not available',
        errorCode: 'NOT_AVAILABLE',
        aiTranscriptionAvailable: true,
      };
    }
    case 'html5': {
      console.log('[Lock-in BG] Handling HTML5 video');
      const result = await extractHtml5Transcript(video);
      console.log('[Lock-in BG] HTML5 result:', result.success);
      return result;
    }
    default:
      return {
        success: false,
        error: `Unsupported video provider: ${video.provider}`,
        errorCode: 'NOT_AVAILABLE',
        aiTranscriptionAvailable: true,
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
async function handleEcho360VideoDetection(context) {
  console.log('[Lock-in BG] handleEcho360VideoDetection called', {
    hasContext: !!context,
    pageUrl: context?.pageUrl,
    iframeCount: Array.isArray(context?.iframes) ? context.iframes.length : 0,
    iframes: context?.iframes,
  });

  if (!context || !context.pageUrl) {
    console.warn('[Lock-in BG] No detection context provided for Echo360');
    return {
      success: false,
      error: 'No detection context provided',
    };
  }

  if (TranscriptProviders && TranscriptProviders.Echo360Provider) {
    try {
      const provider = new TranscriptProviders.Echo360Provider();
      const fetcher = new ExtensionFetcher();
      const normalizedContext = {
        pageUrl: context.pageUrl,
        iframes: Array.isArray(context.iframes) ? context.iframes : [],
      };
      console.log('[Lock-in BG] Echo360 provider created, starting detection', {
        pageUrl: normalizedContext.pageUrl,
        iframeCount: normalizedContext.iframes.length,
        hasDetectVideosAsync: typeof provider.detectVideosAsync === 'function',
        hasDetectVideosSync: typeof provider.detectVideosSync === 'function',
      });

      if (typeof provider.detectVideosAsync === 'function') {
        console.log('[Lock-in BG] Using async detection');
        const videos = await provider.detectVideosAsync(normalizedContext, fetcher);
        console.log('[Lock-in BG] Echo360 async detection completed', {
          videoCount: videos.length,
          videos: videos.map((v) => ({
            id: v.id,
            provider: v.provider,
            title: v.title,
            lessonId: v.echoLessonId,
            mediaId: v.echoMediaId,
            baseUrl: v.echoBaseUrl,
          })),
        });
        return { success: true, videos };
      }
      if (typeof provider.detectVideosSync === 'function') {
        console.log('[Lock-in BG] Using sync detection');
        const videos = provider.detectVideosSync(normalizedContext);
        console.log('[Lock-in BG] Echo360 sync detection completed', {
          videoCount: videos.length,
          videos: videos.map((v) => ({
            id: v.id,
            provider: v.provider,
            title: v.title,
            lessonId: v.echoLessonId,
            mediaId: v.echoMediaId,
            baseUrl: v.echoBaseUrl,
          })),
        });
        return { success: true, videos };
      }
      console.warn('[Lock-in BG] Echo360 provider missing detection methods');
    } catch (error) {
      console.error('[Lock-in BG] Echo360 detection failed', {
        error: error?.message,
        stack: error?.stack,
        errorObject: error,
      });
      return {
        success: false,
        error: error?.message || 'Echo360 detection failed',
      };
    }
  }

  console.warn('[Lock-in BG] Echo360 provider is not available');
  return {
    success: false,
    error: 'Echo360 provider is not available',
  };
}

// AI Transcription Helpers
// ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?ƒ"?

const AI_TRANSCRIPTION_JOBS = new Map();

/**
 * Fetch media URL from Panopto video for AI transcription
 * @param {Object} video - DetectedVideo object
 * @returns {Promise<Object>} - { success, mediaUrl?, error? }
 */
async function handlePanoptoMediaUrlFetch(video, options = {}) {
  console.log('[Lock-in BG] Fetching Panopto media URL for AI transcription');
  console.log('[Lock-in BG] Video:', {
    id: video.id,
    provider: video.provider,
    embedUrl: video.embedUrl,
    panoptoTenant: video.panoptoTenant,
  });

  if (video.provider !== 'panopto') {
    return {
      success: false,
      error: 'Not a Panopto video',
    };
  }

  try {
    const tabId = options?.tabId || null;
    let resolvedInfo = null;

    if (video.panoptoTenant && video.id) {
      resolvedInfo = { tenant: video.panoptoTenant, deliveryId: video.id };
    } else if (video.embedUrl) {
      resolvedInfo = extractPanoptoInfoFromUrl(video.embedUrl);
    }

    if (!resolvedInfo && video.embedUrl) {
      const resolved = await resolvePanoptoInfoFromWrapperUrl(video.embedUrl);
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

    const resolvedEmbedUrl = buildPanoptoEmbedUrl(resolvedInfo.tenant, resolvedInfo.deliveryId);
    const resolverResult = await PanoptoMediaResolver.resolve({
      tenant: resolvedInfo.tenant,
      deliveryId: resolvedInfo.deliveryId,
      embedUrl: resolvedEmbedUrl,
      tabId,
    });
    console.log('[Lock-in BG] Panopto media URL fetch (v2) result:', resolverResult.ok);
    return {
      success: resolverResult.ok,
      mediaUrl: resolverResult.mediaUrl,
      mime: resolverResult.mime,
      method: resolverResult.method,
      error: resolverResult.message,
      errorCode: resolverResult.errorCode,
      debug: resolverResult.debug,
    };
  } catch (error) {
    console.error('[Lock-in BG] Error fetching Panopto media URL:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch media URL',
    };
  }
}

const AI_UPLOAD_CHUNK_BYTES = 4 * 1024 * 1024;
const AI_POLL_INTERVAL_MS = 3000;
const AI_POLL_MAX_ATTEMPTS = 160;

function getConfigValue(key, fallback) {
  if (typeof self === 'undefined' || !self.LOCKIN_CONFIG) {
    return fallback;
  }
  const value = self.LOCKIN_CONFIG[key];
  return value === undefined || value === null || value === '' ? fallback : value;
}

function getBackendUrl() {
  return getConfigValue('BACKEND_URL', 'http://localhost:3000');
}

function getSessionStorageKey() {
  return getConfigValue('SESSION_STORAGE_KEY', 'lockinSupabaseSession');
}

async function getAuthToken() {
  const key = getSessionStorageKey();
  try {
    const result = await chrome.storage.sync.get([key]);
    const session = result[key];
    if (!session) return null;
    return session.accessToken || session.access_token || null;
  } catch (error) {
    console.error('[Lock-in] Failed to read auth session:', error);
    return null;
  }
}

const TRACKING_QUERY_KEYS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_name',
  'gclid',
  'dclid',
  'fbclid',
  'msclkid',
  'yclid',
  'igshid',
  '_ga',
  '_gid',
  '_gac',
  '_gl',
  'mc_cid',
  'mc_eid',
  'hsa_acc',
  'hsa_cam',
  'hsa_grp',
  'hsa_ad',
  'hsa_src',
  'hsa_tgt',
  'hsa_kw',
  'hsa_mt',
  'hsa_net',
  'hsa_ver',
]);

function normalizeMediaUrl(mediaUrl) {
  if (!mediaUrl) return '';
  try {
    const url = new URL(mediaUrl);
    url.hash = '';
    const params = url.searchParams;
    for (const key of Array.from(params.keys())) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.startsWith('utm_') || TRACKING_QUERY_KEYS.has(lowerKey)) {
        params.delete(key);
      }
    }
    const nextSearch = params.toString();
    url.search = nextSearch ? `?${nextSearch}` : '';
    return url.toString();
  } catch {
    return mediaUrl;
  }
}

function isAuthStatus(status) {
  return status === 401 || status === 403;
}

function isBlobUrl(mediaUrl) {
  return typeof mediaUrl === 'string' && mediaUrl.startsWith('blob:');
}

function createErrorWithCode(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getErrorCode(error) {
  if (!error || typeof error !== 'object') return null;
  if ('code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return null;
}

async function fetchMediaHeadMetadata(mediaUrl, signal) {
  try {
    const response = await fetchWithRetry(mediaUrl, {
      method: 'HEAD',
      credentials: 'include',
      signal,
    });

    if (isAuthStatus(response.status)) {
      return { authRequired: true };
    }

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    if (response.type === 'opaque') {
      return { ok: false, opaque: true };
    }

    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');
    const contentLength = response.headers.get('content-length');
    return {
      ok: true,
      etag: etag ? etag.trim() : '',
      lastModified: lastModified ? lastModified.trim() : '',
      contentLength: contentLength ? contentLength.trim() : '',
    };
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}

function fallbackHash(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

async function hashStringSha256(value) {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return fallbackHash(value);
  }
  const encoded = new TextEncoder().encode(value);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function createProgressEmitter(tabId, requestId) {
  let lastStage = null;
  let lastPercentBucket = null;

  return (stage, info = {}) => {
    if (!tabId) return;

    const percent =
      typeof info.percent === 'number' ? Math.max(0, Math.min(100, info.percent)) : undefined;
    const percentBucket = typeof percent === 'number' ? Math.floor(percent) : null;
    const shouldSkip =
      stage === lastStage &&
      percentBucket !== null &&
      percentBucket === lastPercentBucket &&
      !info.message;

    if (shouldSkip) return;

    lastStage = stage;
    if (percentBucket !== null) {
      lastPercentBucket = percentBucket;
    }

    try {
      chrome.tabs.sendMessage(tabId, {
        type: 'TRANSCRIBE_MEDIA_AI_PROGRESS',
        payload: {
          requestId,
          jobId: info.jobId || null,
          stage,
          message: info.message || null,
          percent,
        },
      });
    } catch (error) {
      console.warn('[Lock-in] Failed to send progress update:', error);
    }
  };
}

async function fetchJsonWithAuth(url, token, options = {}) {
  const headers = Object.assign({}, options.headers || {}, {
    Authorization: `Bearer ${token}`,
  });

  const response = await fetch(url, { ...options, headers });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    // Extract error message - handle both string and object error formats
    let message = 'Request failed';
    if (data?.error?.message) {
      message = data.error.message;
    } else if (typeof data?.error === 'string') {
      message = data.error;
    } else if (typeof data?.message === 'string') {
      message = data.message;
    } else if (response.statusText) {
      message = response.statusText;
    }
    const error = new Error(message);
    if (data?.error?.code) {
      error.code = data.error.code;
    }
    if (data?.error?.details) {
      error.details = data.error.details;
    }
    error.status = response.status;
    throw error;
  }

  return data;
}

async function createTranscriptionJob({ token, payload, signal }) {
  const backendUrl = getBackendUrl();
  return fetchJsonWithAuth(`${backendUrl}/api/transcripts/jobs`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Content Script Media Fetcher (CORS Fallback)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Storage for pending media chunks from content script
 */
const pendingMediaChunks = new Map();

/**
 * Convert base64 string to Uint8Array
 */
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Request content script to fetch media and stream it back
 * This is used as a fallback when CORS blocks direct fetching from background
 *
 * @param {number} tabId - The tab ID to send the request to
 * @param {string} mediaUrl - The URL of the media to fetch
 * @param {string} jobId - The transcription job ID
 * @param {string} requestId - The request ID for tracking
 * @param {function} onChunk - Callback for each chunk received
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function fetchMediaViaContentScript({ tabId, mediaUrl, jobId, requestId, onChunk }) {
  console.log('[Lock-in BG] Requesting content script to fetch media:', mediaUrl);

  // Set up chunk receiver
  let resolveComplete;
  let rejectComplete;
  const completePromise = new Promise((resolve, reject) => {
    resolveComplete = resolve;
    rejectComplete = reject;
  });

  // Store the chunk handler for this request
  pendingMediaChunks.set(requestId, {
    onChunk,
    resolve: resolveComplete,
    reject: rejectComplete,
  });

  try {
    // Send request to content script - this kicks off the fetch
    // The content script will send chunks via separate MEDIA_CHUNK messages
    const result = await chrome.tabs.sendMessage(tabId, {
      type: 'FETCH_MEDIA_FOR_TRANSCRIPTION',
      payload: { mediaUrl, jobId, requestId },
    });

    console.log('[Lock-in BG] Content script fetch result:', result);

    if (!result || !result.success) {
      throw createErrorWithCode(
        result?.error || 'Content script failed to fetch media',
        result?.errorCode || 'CONTENT_FETCH_ERROR',
      );
    }

    // Wait for all chunks to be processed
    // The handleMediaChunkMessage will resolve this when isLast=true
    console.log('[Lock-in BG] Waiting for all chunks to be uploaded...');
    await completePromise;
    console.log('[Lock-in BG] All chunks uploaded successfully');

    return result;
  } catch (error) {
    console.error('[Lock-in BG] Content script media fetch error:', error);
    throw error;
  } finally {
    pendingMediaChunks.delete(requestId);
  }
}

/**
 * Handle MEDIA_CHUNK messages from content script
 */
function handleMediaChunkMessage(message) {
  const { requestId, chunkIndex, chunkData, chunkSize, isLast } = message.payload || {};

  const handler = pendingMediaChunks.get(requestId);
  if (!handler) {
    console.warn('[Lock-in BG] Received chunk for unknown request:', requestId);
    return;
  }

  console.log('[Lock-in BG] Received chunk:', chunkIndex, 'size:', chunkSize, 'isLast:', isLast);

  // Convert base64 to Uint8Array
  const chunkBytes = base64ToArrayBuffer(chunkData);

  // Call the chunk handler
  handler
    .onChunk(chunkBytes, chunkIndex, isLast)
    .then(() => {
      if (isLast) {
        handler.resolve({ success: true });
      }
    })
    .catch((error) => {
      handler.reject(error);
    });
}

async function uploadMediaInChunks({
  jobId,
  mediaUrl,
  token,
  signal,
  onProgress,
  tabId,
  requestId,
}) {
  const backendUrl = getBackendUrl();
  let uploadedBytes = 0;
  let chunkIndex = 0;

  // Helper to send a chunk to the backend with retry logic for rate limits
  const sendChunkToBackend = async (chunk, index, maxRetries = 5) => {
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'x-chunk-index': String(index),
    };

    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (signal?.aborted) {
        throw new Error('CANCELED');
      }

      const response = await fetch(`${backendUrl}/api/transcripts/jobs/${jobId}/chunks`, {
        method: 'PUT',
        headers,
        body: chunk,
        signal,
      });

      if (response.ok) {
        return response.json();
      }

      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        let retryAfterMs;

        if (retryAfterHeader) {
          retryAfterMs = parseInt(retryAfterHeader, 10) * 1000;
        } else {
          // Exponential backoff: 2s, 4s, 8s, 16s, 32s
          retryAfterMs = Math.min(2000 * Math.pow(2, attempt), 32000);
        }

        console.log(
          `[Lock-in BG] Rate limited on chunk ${index}, retrying in ${retryAfterMs}ms (attempt ${
            attempt + 1
          }/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
        continue;
      }

      const text = await response.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        /* ignore */
      }
      lastError = new Error(
        data?.error?.message || data?.error || `Chunk upload failed: ${response.status}`,
      );
      break;
    }

    throw lastError || new Error(`Chunk ${index} upload failed after ${maxRetries} retries`);
  };

  // Known SSO domains that indicate session expiration
  const SSO_DOMAINS = ['okta.com', 'auth0.com', 'login.microsoftonline.com', 'accounts.google.com'];

  const isSsoRedirect = (url) => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return SSO_DOMAINS.some((domain) => hostname.includes(domain));
    } catch {
      return false;
    }
  };

  const isCdnUrl = (url) => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return (
        hostname.includes('cloudfront.net') ||
        hostname.includes('cdn.') ||
        hostname.includes('akamai') ||
        hostname.includes('fastly') ||
        hostname.includes('cloudflare')
      );
    } catch {
      return false;
    }
  };

  // First try direct fetch from background script
  let response;
  let usedContentScript = false;

  try {
    console.log('[Lock-in BG] Attempting direct media fetch:', mediaUrl);

    // Use manual redirect to handle Moodle → CDN redirects properly
    // Moodle needs credentials, CDN doesn't (and CDN returns Access-Control-Allow-Origin: *)
    response = await fetch(mediaUrl, {
      method: 'GET',
      credentials: 'include',
      redirect: 'manual',
      signal,
    });

    console.log('[Lock-in BG] Initial response:', response.status, response.type);

    // Handle redirects manually
    if (
      response.type === 'opaqueredirect' ||
      response.status === 0 ||
      (response.status >= 300 && response.status < 400)
    ) {
      const location = response.headers.get('location');
      console.log('[Lock-in BG] Redirect detected, location:', location);

      if (location) {
        // Check for SSO redirect (session expired)
        if (isSsoRedirect(location)) {
          throw createErrorWithCode(
            'Your session has expired. Please refresh the page and log in again.',
            'SESSION_EXPIRED',
          );
        }

        // Follow redirect with appropriate credentials
        const useCredentials = !isCdnUrl(location);
        console.log('[Lock-in BG] Following redirect, credentials:', useCredentials);

        response = await fetch(location, {
          method: 'GET',
          credentials: useCredentials ? 'include' : 'omit',
          signal,
        });
      } else {
        // Can't get location - fall back to content script
        console.log('[Lock-in BG] No location header, falling back to content script');
        throw createErrorWithCode('CORS_BLOCKED', 'CORS_BLOCKED');
      }
    }

    // Check for CORS/opaque issues
    if (response.type === 'opaque') {
      console.log('[Lock-in BG] Got opaque response, will try content script fallback');
      throw createErrorWithCode('CORS_BLOCKED', 'CORS_BLOCKED');
    }

    if (!response.ok) {
      if (isAuthStatus(response.status)) {
        throw createErrorWithCode(
          'Authentication required. Please refresh the page and log in.',
          'AUTH_REQUIRED',
        );
      }
      throw createErrorWithCode(`HTTP ${response.status}`, 'FETCH_ERROR');
    }

    console.log('[Lock-in BG] Direct fetch successful');
  } catch (error) {
    // Check if we should try content script fallback
    const shouldFallback =
      error?.code === 'CORS_BLOCKED' ||
      error?.code === 'NOT_AVAILABLE' ||
      (error?.message &&
        (error.message.includes('CORS') ||
          error.message.includes('opaque') ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError')));

    if (shouldFallback && tabId) {
      console.log('[Lock-in BG] Trying content script fallback for media fetch');
      usedContentScript = true;

      try {
        // Use content script to fetch and upload chunks
        await fetchMediaViaContentScript({
          tabId,
          mediaUrl,
          jobId,
          requestId,
          onChunk: async (chunkBytes, index, isLast) => {
            await sendChunkToBackend(chunkBytes, index);
            uploadedBytes += chunkBytes.length;
            if (onProgress) {
              onProgress({ bytesUploaded: uploadedBytes, chunkIndex: index });
            }
            chunkIndex = index + 1;
          },
        });

        // Return consistent property names with direct fetch path
        // chunkIndex is now the total count (0-indexed + 1 after each chunk)
        return {
          chunkCount: chunkIndex,
          totalChunks: chunkIndex, // We know exact count after streaming completes
          totalBytes: uploadedBytes,
          usedContentScript: true,
        };
      } catch (contentError) {
        console.error('[Lock-in BG] Content script fallback failed:', contentError);
        throw createErrorWithCode(
          contentError?.message || 'Media could not be fetched via content script.',
          contentError?.code || 'CONTENT_FETCH_ERROR',
        );
      }
    }

    // Re-throw original error if we can't fallback
    if (error?.name === 'AbortError') throw error;
    if (error?.code) throw error;

    throw createErrorWithCode(
      'Media could not be fetched due to browser restrictions (CORS/opaque response) or network errors.',
      'NOT_AVAILABLE',
    );
  }

  // Process the direct fetch response
  if (!response.body || typeof response.body.getReader !== 'function') {
    throw createErrorWithCode('Streaming not supported for this media.', 'NOT_AVAILABLE');
  }

  const totalBytesHeader = response.headers.get('content-length');
  const totalBytes = totalBytesHeader ? Number(totalBytesHeader) : null;
  const totalChunks =
    Number.isFinite(totalBytes) && totalBytes > 0
      ? Math.ceil(totalBytes / AI_UPLOAD_CHUNK_BYTES)
      : null;

  const reader = response.body.getReader();
  let pending = new Uint8Array(0);

  // sendChunk with retry logic for rate limits (direct fetch path)
  const sendChunk = async (chunk, maxRetries = 5) => {
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'x-chunk-index': String(chunkIndex),
    };
    if (totalChunks) {
      headers['x-total-chunks'] = String(totalChunks);
    }

    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (signal?.aborted) {
        throw new Error('CANCELED');
      }

      const uploadResponse = await fetch(`${backendUrl}/api/transcripts/jobs/${jobId}/chunks`, {
        method: 'PUT',
        headers,
        body: chunk,
        signal,
      });

      if (uploadResponse.ok) {
        chunkIndex += 1;
        return;
      }

      // Handle rate limiting with exponential backoff
      if (uploadResponse.status === 429) {
        const retryAfterHeader = uploadResponse.headers.get('Retry-After');
        let retryAfterMs;

        if (retryAfterHeader) {
          retryAfterMs = parseInt(retryAfterHeader, 10) * 1000;
        } else {
          // Exponential backoff: 2s, 4s, 8s, 16s, 32s
          retryAfterMs = Math.min(2000 * Math.pow(2, attempt), 32000);
        }

        console.log(
          `[Lock-in BG] Rate limited on chunk ${chunkIndex}, retrying in ${retryAfterMs}ms (attempt ${
            attempt + 1
          }/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
        continue;
      }

      const text = await uploadResponse.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        /* ignore */
      }
      lastError = new Error(
        data?.error?.message ||
          data?.error ||
          `Failed to upload chunk ${chunkIndex}: ${uploadResponse.status}`,
      );
      break;
    }

    throw lastError || new Error(`Chunk ${chunkIndex} upload failed after ${maxRetries} retries`);
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;

    const combined = new Uint8Array(pending.length + value.length);
    combined.set(pending);
    combined.set(value, pending.length);
    pending = combined;

    while (pending.length >= AI_UPLOAD_CHUNK_BYTES) {
      const chunk = pending.slice(0, AI_UPLOAD_CHUNK_BYTES);
      pending = pending.slice(AI_UPLOAD_CHUNK_BYTES);
      await sendChunk(chunk);
      uploadedBytes += chunk.length;
      if (totalBytes) {
        const percent = Math.round((uploadedBytes / totalBytes) * 100);
        if (onProgress) {
          onProgress({ percent });
        }
      } else if (onProgress && chunkIndex % 5 === 0) {
        onProgress({ message: `Uploaded ${chunkIndex} chunks` });
      }
    }
  }

  if (pending.length > 0) {
    await sendChunk(pending);
    uploadedBytes += pending.length;
    if (totalBytes && onProgress) {
      const percent = Math.round((uploadedBytes / totalBytes) * 100);
      onProgress({ percent });
    }
  }

  return {
    chunkCount: chunkIndex,
    totalChunks,
    totalBytes,
  };
}

async function finalizeTranscriptionJob({ jobId, token, options, expectedTotalChunks, signal }) {
  const backendUrl = getBackendUrl();
  const payload = Object.assign({}, options || {});
  if (expectedTotalChunks) {
    payload.expectedTotalChunks = expectedTotalChunks;
  }
  return fetchJsonWithAuth(`${backendUrl}/api/transcripts/jobs/${jobId}/finalize`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
}

async function pollTranscriptJob({ jobId, token, signal, onProgress }) {
  const backendUrl = getBackendUrl();
  for (let attempt = 0; attempt < AI_POLL_MAX_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) {
      throw new Error('CANCELED');
    }

    const data = await fetchJsonWithAuth(`${backendUrl}/api/transcripts/jobs/${jobId}`, token, {
      method: 'GET',
      signal,
    });

    const job = data?.job || data;
    if ((job?.status === 'done' || job?.status === 'completed') && job.transcript) {
      return job.transcript;
    }
    if (job?.status === 'error' || job?.status === 'failed') {
      // Extract error message - handle both string and object error formats
      const errorMsg =
        typeof job.error === 'string' ? job.error : job.error?.message || 'AI transcription failed';
      throw new Error(errorMsg);
    }
    if (job?.status === 'canceled') {
      throw new Error('CANCELED');
    }

    if (onProgress) {
      onProgress({ message: 'Transcribing...' });
    }
    await new Promise((resolve) => setTimeout(resolve, AI_POLL_INTERVAL_MS));
  }

  throw new Error('AI transcription timed out');
}

async function cancelTranscriptJob({ jobId, token }) {
  if (!jobId || !token) return;
  const backendUrl = getBackendUrl();
  try {
    await fetchJsonWithAuth(`${backendUrl}/api/transcripts/jobs/${jobId}/cancel`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  } catch (error) {
    console.warn('[Lock-in] Failed to cancel transcript job:', error);
  }
}

async function listActiveTranscriptJobs({ token }) {
  if (!token) throw new Error('No auth token provided');
  const backendUrl = getBackendUrl();
  return fetchJsonWithAuth(`${backendUrl}/api/transcripts/jobs/active`, token, {
    method: 'GET',
  });
}

async function cancelAllActiveTranscriptJobs({ token }) {
  if (!token) throw new Error('No auth token provided');
  const backendUrl = getBackendUrl();
  return fetchJsonWithAuth(`${backendUrl}/api/transcripts/jobs/cancel-all`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

async function handleAiTranscriptionStart(payload, sender) {
  const video = payload?.video;
  const options = payload?.options || {};
  const requestId = payload?.requestId || `ai-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  if (!video || !video.mediaUrl) {
    return {
      success: false,
      error: 'Media URL not available for AI transcription.',
      errorCode: 'NOT_AVAILABLE',
      requestId,
    };
  }

  const tabId = sender?.tab?.id || null;
  const progress = createProgressEmitter(tabId, requestId);
  const abortController = new AbortController();

  const jobState = {
    requestId,
    jobId: null,
    abortController,
  };

  AI_TRANSCRIPTION_JOBS.set(requestId, jobState);
  progress('starting', { message: 'Preparing AI transcription...' });

  try {
    if (isBlobUrl(video.mediaUrl)) {
      throw createErrorWithCode(
        'This video uses a blob URL and cannot be accessed for AI transcription.',
        'NOT_AVAILABLE',
      );
    }

    if (video.drmDetected) {
      const reason = video.drmReason ? ` (${video.drmReason})` : '';
      throw createErrorWithCode(
        `This video appears to be DRM-protected${reason}. AI transcription is not available.`,
        'NOT_AVAILABLE',
      );
    }

    const token = await getAuthToken();
    if (!token) {
      throw createErrorWithCode(
        'Please sign in to Lock-in to use AI transcription. Click the extension icon to sign in.',
        'LOCKIN_AUTH_REQUIRED',
      );
    }

    const mediaUrlNormalized = normalizeMediaUrl(video.mediaUrl);
    const headInfo = await fetchMediaHeadMetadata(video.mediaUrl, abortController.signal);
    if (headInfo?.authRequired) {
      throw createErrorWithCode('Authentication required to access this media.', 'AUTH_REQUIRED');
    }

    const headContentLength = headInfo?.contentLength ? Number(headInfo.contentLength) : null;
    const expectedTotalChunks =
      Number.isFinite(headContentLength) && headContentLength > 0
        ? Math.ceil(headContentLength / AI_UPLOAD_CHUNK_BYTES)
        : null;

    const fingerprintSource = [
      mediaUrlNormalized,
      headInfo?.etag || '',
      headInfo?.lastModified || '',
      headInfo?.contentLength || '',
      video.durationMs || '',
    ].join('|');
    const fingerprint = await hashStringSha256(fingerprintSource);

    const jobResponse = await createTranscriptionJob({
      token,
      payload: {
        fingerprint,
        mediaUrl: video.mediaUrl,
        mediaUrlNormalized,
        durationMs: video.durationMs || null,
        provider: video.provider || 'unknown',
        expectedTotalChunks,
      },
      signal: abortController.signal,
    });

    if (jobResponse?.job?.transcript) {
      progress('completed', { message: 'Transcript ready.' });
      return {
        success: true,
        transcript: jobResponse.job.transcript,
        jobId: jobResponse.job.id,
        status: 'completed',
        cached: true,
        requestId,
      };
    }

    const jobId = jobResponse?.job?.id || jobResponse?.jobId;
    if (!jobId) {
      throw new Error('Failed to create transcription job');
    }

    jobState.jobId = jobId;
    progress('uploading', { jobId, message: 'Uploading media...' });

    const uploadStats = await uploadMediaInChunks({
      jobId,
      mediaUrl: video.mediaUrl,
      token,
      signal: abortController.signal,
      onProgress: (info) => progress('uploading', { jobId, ...info }),
      tabId,
      requestId,
    });

    progress('processing', { jobId, message: 'Processing audio...' });
    const expectedTotalChunksForFinalize =
      uploadStats?.totalChunks || expectedTotalChunks || uploadStats?.chunkCount || null;
    await finalizeTranscriptionJob({
      jobId,
      token,
      options,
      expectedTotalChunks: expectedTotalChunksForFinalize,
      signal: abortController.signal,
    });

    progress('polling', { jobId, message: 'Transcribing...' });
    const transcript = await pollTranscriptJob({
      jobId,
      token,
      signal: abortController.signal,
      onProgress: (info) => progress('polling', { jobId, ...info }),
    });

    progress('completed', { jobId, message: 'Transcript ready.' });
    return {
      success: true,
      transcript,
      jobId,
      status: 'completed',
      requestId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorCode = getErrorCode(error);
    const status = error?.status;
    if (abortController.signal.aborted || message === 'CANCELED') {
      progress('canceled', { jobId: jobState.jobId, message: 'Canceled.' });
      return {
        success: false,
        error: 'Transcription canceled.',
        errorCode: 'CANCELED',
        jobId: jobState.jobId,
        status: 'canceled',
        requestId,
      };
    }
    if (errorCode === 'LOCKIN_AUTH_REQUIRED') {
      progress('failed', {
        jobId: jobState.jobId,
        message: 'Lock-in sign-in required.',
      });
      return {
        success: false,
        error:
          'Please sign in to Lock-in to use AI transcription. Click the extension icon to sign in.',
        errorCode: 'LOCKIN_AUTH_REQUIRED',
        jobId: jobState.jobId,
        status: 'failed',
        requestId,
      };
    }
    if (errorCode === 'AUTH_REQUIRED' || message === 'AUTH_REQUIRED' || isAuthStatus(status)) {
      progress('failed', {
        jobId: jobState.jobId,
        message: 'Media authentication required.',
      });
      return {
        success: false,
        error:
          'Media authentication required. Please refresh the page and ensure you are logged in to the learning platform.',
        errorCode: 'AUTH_REQUIRED',
        jobId: jobState.jobId,
        status: 'failed',
        requestId,
      };
    }
    progress('failed', { jobId: jobState.jobId, message });
    return {
      success: false,
      error: message || 'Failed to transcribe media.',
      errorCode: errorCode || 'NOT_AVAILABLE',
      jobId: jobState.jobId,
      status: 'failed',
      requestId,
    };
  } finally {
    AI_TRANSCRIPTION_JOBS.delete(requestId);
  }
}

async function handleAiTranscriptionCancel(payload) {
  const requestId = payload?.requestId;
  const jobId = payload?.jobId;

  const jobState = requestId ? AI_TRANSCRIPTION_JOBS.get(requestId) : null;
  if (jobState?.abortController) {
    jobState.abortController.abort();
  }

  const token = await getAuthToken();
  if (jobId && token) {
    await cancelTranscriptJob({ jobId, token });
  }

  return { success: true, requestId, jobId };
}

// Session management
const SESSION_STORAGE_PREFIX = 'lockin_session_';

/**
 * Get session key for a specific tab
 * @param {number} tabId - Tab ID
 * @returns {string}
 */
function getSessionKey(tabId) {
  return `${SESSION_STORAGE_PREFIX}${tabId}`;
}

/**
 * Get session for a specific tab
 * @param {number} tabId - Tab ID
 * @returns {Promise<Object|null>}
 */
async function getSession(tabId) {
  if (!tabId) return null;

  const key = getSessionKey(tabId);
  try {
    const result = await chrome.storage.local.get([key]);
    return result[key] || null;
  } catch (error) {
    console.error('Lock-in: Failed to get session:', error);
    return null;
  }
}

/**
 * Save session for a specific tab
 * @param {number} tabId - Tab ID
 * @param {Object} sessionData - Session data
 * @returns {Promise<void>}
 */
async function saveSession(tabId, sessionData) {
  if (!tabId) return;

  const key = getSessionKey(tabId);
  const storedSession = {
    ...(sessionData || {}),
    chatHistory: Array.isArray(sessionData?.chatHistory) ? sessionData.chatHistory : [],
    updatedAt: Date.now(),
  };

  try {
    await chrome.storage.local.set({ [key]: storedSession });
  } catch (error) {
    console.error('Lock-in: Failed to save session:', error);
  }
}

/**
 * Clear session for a specific tab
 * @param {number} tabId - Tab ID
 * @returns {Promise<void>}
 */
async function clearSession(tabId) {
  if (!tabId) return;

  const key = getSessionKey(tabId);
  try {
    await chrome.storage.local.remove(key);
  } catch (error) {
    console.error('Lock-in: Failed to clear session:', error);
  }
}

/**
 * Handle message from content script or popup
 * @param {Object} message - Message object
 * @param {Object} sender - Message sender info
 * @returns {Promise<Object>}
 */
async function handleMessage(message, sender) {
  const tabId = sender.tab?.id;

  // Use messaging system if available, otherwise fall back to legacy format
  const messageType = message.type || message.action;

  try {
    switch (messageType) {
      case 'getTabId':
      case 'GET_TAB_ID': {
        return Messaging ? Messaging.createSuccessResponse({ tabId }) : { tabId };
      }

      case 'getSession':
      case 'GET_SESSION': {
        const session = await getSession(tabId);
        return Messaging ? Messaging.createSuccessResponse({ session }) : { session };
      }

      case 'saveSession':
      case 'SAVE_SESSION': {
        const sessionData = message.sessionData || message.payload?.sessionData;
        await saveSession(tabId, sessionData);
        return Messaging ? Messaging.createSuccessResponse({ success: true }) : { success: true };
      }

      case 'clearSession':
      case 'CLEAR_SESSION': {
        await clearSession(tabId);
        return Messaging ? Messaging.createSuccessResponse({ success: true }) : { success: true };
      }

      case 'getSettings':
      case 'GET_SETTINGS': {
        return new Promise((resolve) => {
          chrome.storage.sync.get(['preferredLanguage'], (data) => {
            resolve(Messaging ? Messaging.createSuccessResponse(data) : data);
          });
        });
      }

      case 'saveSettings':
      case 'UPDATE_SETTINGS': {
        const settings = message.settings || message.payload?.settings || {};
        return new Promise((resolve) => {
          chrome.storage.sync.set(settings, () => {
            resolve(
              Messaging ? Messaging.createSuccessResponse({ success: true }) : { success: true },
            );
          });
        });
      }

      case 'extractTranscript':
      case 'EXTRACT_TRANSCRIPT': {
        console.log('[Lock-in BG] EXTRACT_TRANSCRIPT message received');
        const video = message.video || message.payload?.video;
        if (!video) {
          console.warn('[Lock-in BG] No video provided in EXTRACT_TRANSCRIPT message');
          return Messaging
            ? Messaging.createErrorResponse('No video provided')
            : { error: 'No video provided' };
        }
        console.log('[Lock-in BG] Processing EXTRACT_TRANSCRIPT for:', video.provider, video.id);
        const result = await handleTranscriptExtraction(video);
        console.log('[Lock-in BG] EXTRACT_TRANSCRIPT result:', result.success);
        return Messaging
          ? result.success
            ? Messaging.createSuccessResponse(result)
            : Messaging.createErrorResponse(result.error || 'Failed to extract transcript', result)
          : result;
      }

      case 'DETECT_ECHO360_VIDEOS': {
        const context = message.context || message.payload?.context;
        const result = await handleEcho360VideoDetection(context);
        return Messaging
          ? result.success
            ? Messaging.createSuccessResponse(result)
            : Messaging.createErrorResponse(result.error || 'Echo360 detection failed', result)
          : result;
      }

      case 'FETCH_PANOPTO_MEDIA_URL': {
        console.log('[Lock-in BG] FETCH_PANOPTO_MEDIA_URL message received');
        const video = message.video || message.payload?.video;
        if (!video) {
          console.warn('[Lock-in BG] No video provided in FETCH_PANOPTO_MEDIA_URL message');
          return Messaging
            ? Messaging.createErrorResponse('No video provided')
            : { success: false, error: 'No video provided' };
        }
        console.log('[Lock-in BG] Fetching media URL for:', video.provider, video.id);
        const result = await handlePanoptoMediaUrlFetch(video, { tabId });
        console.log('[Lock-in BG] FETCH_PANOPTO_MEDIA_URL result:', result.success);
        return Messaging
          ? result.success
            ? Messaging.createSuccessResponse(result)
            : Messaging.createErrorResponse(result.error || 'Failed to fetch media URL', result)
          : result;
      }

      case 'TRANSCRIBE_MEDIA_AI': {
        const action = message.action || message.payload?.action || 'start';
        if (action === 'cancel') {
          return handleAiTranscriptionCancel(message.payload || message);
        }
        const payload = message.payload || message;
        return handleAiTranscriptionStart(payload, sender);
      }

      case 'MEDIA_CHUNK': {
        // Handle media chunks from content script
        handleMediaChunkMessage(message);
        return { received: true };
      }

      case 'LIST_ACTIVE_TRANSCRIPT_JOBS': {
        const token = message.token || message.payload?.token;
        if (!token) {
          return Messaging
            ? Messaging.createErrorResponse('No auth token provided')
            : { success: false, error: 'No auth token provided' };
        }
        try {
          const result = await listActiveTranscriptJobs({ token });
          return Messaging ? Messaging.createSuccessResponse(result) : { success: true, ...result };
        } catch (error) {
          return Messaging
            ? Messaging.createErrorResponse(error.message)
            : { success: false, error: error.message };
        }
      }

      case 'CANCEL_ALL_ACTIVE_TRANSCRIPT_JOBS': {
        const token = message.token || message.payload?.token;
        if (!token) {
          return Messaging
            ? Messaging.createErrorResponse('No auth token provided')
            : { success: false, error: 'No auth token provided' };
        }
        try {
          const result = await cancelAllActiveTranscriptJobs({ token });
          return Messaging ? Messaging.createSuccessResponse(result) : { success: true, ...result };
        } catch (error) {
          return Messaging
            ? Messaging.createErrorResponse(error.message)
            : { success: false, error: error.message };
        }
      }

      default: {
        const error = `Unknown message type: ${messageType}`;
        return Messaging ? Messaging.createErrorResponse(error) : { error };
      }
    }
  } catch (error) {
    console.error('Lock-in: Error handling message:', error);
    const errorMessage = error.message || String(error);
    return Messaging ? Messaging.createErrorResponse(errorMessage) : { error: errorMessage };
  }
}

// Extension lifecycle
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu
  chrome.contextMenus.create({
    id: 'lockin-process',
    title: 'Lock-in: Explain',
    contexts: ['selection'],
  });

  console.log('Lock-in extension installed successfully!');
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'lockin-process' && info.selectionText) {
    // Send message to content script to show the mode selector
    chrome.tabs
      .sendMessage(tab.id, {
        type: 'SHOW_MODE_SELECTOR',
        payload: {
          text: info.selectionText,
        },
      })
      .catch((error) => {
        console.error('Lock-in: Failed to send message to content script:', error);
      });
  }
});

// Clean up session when tab is closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await clearSession(tabId);
  console.log(`Lock-in: Cleared session for closed tab ${tabId}`);
});

// Detect navigation to different origin and clear session
chrome.webNavigation.onCommitted.addListener(async (details) => {
  // Only handle main frame navigation (not iframes)
  if (details.frameId !== 0) return;

  const tabId = details.tabId;
  const newOrigin = new URL(details.url).origin;

  // Get existing session
  const session = await getSession(tabId);

  if (session && session.origin !== newOrigin) {
    // Origin changed, clear the session
    await clearSession(tabId);
    console.log(`Lock-in: Origin changed in tab ${tabId}, cleared session`);
  }
});

// Set up message listener
if (Messaging && typeof Messaging.setupMessageListener === 'function') {
  Messaging.setupMessageListener(handleMessage);
} else {
  // Fallback to legacy message handling
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender)
      .then((response) => {
        sendResponse(response);
      })
      .catch((error) => {
        sendResponse({ error: error.message || String(error) });
      });
    return true; // Keep channel open for async
  });
}

// Log when service worker starts
console.log('Lock-in background service worker started');
