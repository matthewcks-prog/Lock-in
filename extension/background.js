/**
 * Lock-in Background Service Worker
 *
 * Handles context menu integration, per-tab session management, and extension-level coordination.
 * Uses the messaging system for typed communication.
 */

// Import shared libraries
try {
  importScripts("dist/libs/webvttParser.js");
} catch (e) {
  console.warn("Lock-in: Failed to import webvttParser.js:", e);
}

// Import messaging system (available via global in service worker)
const Messaging =
  typeof self !== "undefined" && self.LockInMessaging
    ? self.LockInMessaging
    : null;

// Get shared VTT parser
const WebVtt =
  typeof self !== "undefined" && self.LockInWebVtt ? self.LockInWebVtt : null;

// ─────────────────────────────────────────────────────────────────────────────
// Transcript Extraction Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse WebVTT content into structured segments
 * Uses shared parser from dist/libs/webvttParser.js if available, otherwise fallback
 */
function parseWebVtt(vttContent) {
  if (WebVtt && typeof WebVtt.parseWebVtt === "function") {
    return WebVtt.parseWebVtt(vttContent);
  }
  // Fallback: minimal parser in case shared lib not loaded
  console.warn("Lock-in: Using fallback VTT parser");
  const lines = vttContent.split(/\r?\n/);
  const segments = [];
  const textParts = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("WEBVTT") && !trimmed.includes("-->")) {
      textParts.push(trimmed);
    }
  }
  return {
    plainText: textParts.join(" "),
    segments,
    durationMs: 0,
  };
}

/**
 * Extract CaptionUrl from Panopto embed HTML
 */
function extractCaptionVttUrl(html) {
  // Pattern 1: "CaptionUrl":["..."]
  const captionUrlMatch = html.match(/"CaptionUrl"\s*:\s*\[\s*"([^"]+)"/);
  if (captionUrlMatch) return captionUrlMatch[1].replace(/\\/g, "");

  // Pattern 2: "Captions":[{"Url":"..."}]
  const captionsMatch = html.match(
    /"Captions"\s*:\s*\[\s*\{\s*"Url"\s*:\s*"([^"]+)"/
  );
  if (captionsMatch) return captionsMatch[1].replace(/\\/g, "");

  // Pattern 3: Direct GetCaptionVTT.ashx URL
  const directVttMatch = html.match(
    /https?:\/\/[^"]+GetCaptionVTT\.ashx\?[^"]+/
  );
  if (directVttMatch) return directVttMatch[0].replace(/\\/g, "");

  // Pattern 4: TranscriptUrl
  const transcriptMatch = html.match(/"TranscriptUrl"\s*:\s*"([^"]+)"/);
  if (transcriptMatch) return transcriptMatch[1].replace(/\\/g, "");

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Network Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Default retry configuration */
const RETRY_CONFIG = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 5000,
};

/**
 * Delay for exponential backoff
 * @param {number} attempt - Current attempt (0-based)
 * @returns {Promise<void>}
 */
function backoffDelay(attempt) {
  const delay = Math.min(
    RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
    RETRY_CONFIG.maxDelayMs
  );
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Determine if an error is retryable
 * @param {Error} error - The error to check
 * @param {Response} response - The response object if available
 * @returns {boolean}
 */
function isRetryableError(error, response) {
  // Don't retry auth errors - user needs to sign in
  if (response && (response.status === 401 || response.status === 403)) {
    return false;
  }
  // Don't retry 404 - resource doesn't exist
  if (response && response.status === 404) {
    return false;
  }
  // Retry network errors and 5xx server errors
  if (!response || response.status >= 500) {
    return true;
  }
  // Retry rate limiting (429)
  if (response.status === 429) {
    return true;
  }
  return false;
}

/**
 * Fetch with retry and exponential backoff
 * @param {string} url - URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {number} maxRetries - Maximum retry attempts (default 2)
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options, maxRetries = RETRY_CONFIG.maxRetries) {
  let lastError;
  let lastResponse;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      lastResponse = response;

      // If successful or non-retryable error, return
      if (response.ok || !isRetryableError(null, response)) {
        return response;
      }

      // Retryable error
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error;
      // Network errors are retryable
      if (attempt < maxRetries) {
        console.log(`[Lock-in] Retry ${attempt + 1}/${maxRetries} for ${url}`);
        await backoffDelay(attempt);
        continue;
      }
    }

    // If this wasn't the last attempt, wait and retry
    if (attempt < maxRetries && isRetryableError(lastError, lastResponse)) {
      console.log(`[Lock-in] Retry ${attempt + 1}/${maxRetries} for ${url}`);
      await backoffDelay(attempt);
    }
  }

  // Return last response if we have one, otherwise throw
  if (lastResponse) {
    return lastResponse;
  }
  throw lastError;
}

/**
 * Fetch HTML with credentials (with retry)
 */
async function fetchWithCredentials(url) {
  const response = await fetchWithRetry(url, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      throw new Error("AUTH_REQUIRED");
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.text();
}

/**
 * Fetch VTT content (with retry)
 */
async function fetchVttContent(url) {
  const response = await fetchWithRetry(url, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "text/vtt,text/plain,*/*" },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      throw new Error("AUTH_REQUIRED");
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.text();
}

/**
 * Extract transcript from a Panopto video
 */
async function extractPanoptoTranscript(video) {
  try {
    // Step 1: Fetch the embed page HTML
    const embedHtml = await fetchWithCredentials(video.embedUrl);

    // Step 2: Extract caption URL from the HTML
    const captionUrl = extractCaptionVttUrl(embedHtml);

    if (!captionUrl) {
      return {
        success: false,
        error: "No captions available for this video",
        errorCode: "NO_CAPTIONS",
        aiTranscriptionAvailable: true,
      };
    }

    // Step 3: Fetch the VTT content
    const vttContent = await fetchVttContent(captionUrl);

    // Step 4: Parse the VTT
    const transcript = parseWebVtt(vttContent);

    if (transcript.segments.length === 0) {
      return {
        success: false,
        error: "Caption file is empty or could not be parsed",
        errorCode: "PARSE_ERROR",
        aiTranscriptionAvailable: true,
      };
    }

    return { success: true, transcript };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message === "AUTH_REQUIRED") {
      return {
        success: false,
        error: "Authentication required. Please log in to Panopto.",
        errorCode: "AUTH_REQUIRED",
        aiTranscriptionAvailable: true,
      };
    }

    if (
      message.includes("Failed to fetch") ||
      message.includes("NetworkError")
    ) {
      return {
        success: false,
        error: "Network error. Please check your connection.",
        errorCode: "NETWORK_ERROR",
        aiTranscriptionAvailable: true,
      };
    }

    return {
      success: false,
      error: `Failed to extract transcript: ${message}`,
      errorCode: "PARSE_ERROR",
      aiTranscriptionAvailable: true,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Echo360 Transcript Extraction
// ─────────────────────────────────────────────────────────────────────────────

/** Cache for Echo360 syllabus responses */
const syllabusCache = new Map();
/** Cache TTL in milliseconds (5 minutes) */
const SYLLABUS_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Get cache key for syllabus
 * @param {string} echoOrigin - Echo360 origin
 * @param {string} sectionId - Section ID
 * @returns {string} Cache key
 */
function getSyllabusCacheKey(echoOrigin, sectionId) {
  return `${echoOrigin}:${sectionId}`;
}

/**
 * Check if cached syllabus is still valid
 * @param {Object} cached - Cached entry with data and timestamp
 * @returns {boolean} Whether cache is valid
 */
function isCacheValid(cached) {
  if (!cached || !cached.timestamp) return false;
  return Date.now() - cached.timestamp < SYLLABUS_CACHE_TTL_MS;
}

/**
 * Fetch Echo360 syllabus to get list of recordings
 * Results are cached for 5 minutes to reduce API calls.
 * @param {Object} context - Echo360 context with echoOrigin and sectionId
 * @returns {Promise<Object>} Result with videos array or error
 */
async function fetchEcho360Syllabus(context) {
  const { echoOrigin, sectionId } = context;

  if (!echoOrigin || !sectionId) {
    console.warn("[Lock-in] Missing Echo360 context:", {
      echoOrigin,
      sectionId,
    });
    return {
      success: false,
      error: "Missing Echo360 context (origin or sectionId)",
      errorCode: "INVALID_CONTEXT",
    };
  }

  // Check cache first
  const cacheKey = getSyllabusCacheKey(echoOrigin, sectionId);
  const cached = syllabusCache.get(cacheKey);
  if (isCacheValid(cached)) {
    console.log("[Lock-in] Using cached Echo360 syllabus for:", cacheKey);
    return cached.data;
  }

  const syllabusUrl = `${echoOrigin}/section/${sectionId}/syllabus`;
  console.log("[Lock-in] Fetching Echo360 syllabus from:", syllabusUrl);

  try {
    const response = await fetchWithRetry(syllabusUrl, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.warn(
        "[Lock-in] Echo360 syllabus request failed:",
        response.status
      );
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: "Please sign in to Echo360 to view recordings.",
          errorCode: "AUTH_REQUIRED",
        };
      }
      return {
        success: false,
        error: `Failed to fetch syllabus: HTTP ${response.status}`,
        errorCode: "NETWORK_ERROR",
      };
    }

    const data = await response.json();
    const videos = parseEcho360Syllabus(data, echoOrigin, sectionId);
    console.log(
      "[Lock-in] Parsed",
      videos.length,
      "videos from Echo360 syllabus"
    );

    const result = {
      success: true,
      videos,
    };

    // Cache successful response
    syllabusCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Lock-in] Echo360 syllabus fetch error:", message);

    return {
      success: false,
      error: `Failed to fetch Echo360 recordings: ${message}`,
      errorCode: "NETWORK_ERROR",
    };
  }
}

/**
 * Parse Echo360 syllabus response into DetectedVideo array
 * @param {Object} data - Syllabus API response
 * @param {string} echoOrigin - Echo360 origin URL
 * @param {string} sectionId - Section ID
 * @returns {Array} Array of DetectedVideo objects
 */
function parseEcho360Syllabus(data, echoOrigin, sectionId) {
  const videos = [];

  // Handle both direct array and { data: [...] } formats
  const items = Array.isArray(data) ? data : data.data || [];
  console.log(
    "[Lock-in] parseEcho360Syllabus: data type =",
    typeof data,
    ", items count =",
    items.length
  );
  console.log("[Lock-in] Raw data keys:", Object.keys(data || {}));

  if (items.length === 0) {
    console.log(
      "[Lock-in] No items found. Full data structure:",
      JSON.stringify(data).substring(0, 2000)
    );
  }

  for (const item of items) {
    console.log("[Lock-in] Processing syllabus item type:", item.type);

    // Skip non-lesson items
    if (item.type && item.type !== "SyllabusLessonType") {
      console.log("[Lock-in] Skipping non-lesson item type:", item.type);
      continue;
    }

    // The structure is: item.lesson.lesson for lesson data, item.lesson.medias for medias
    const lessonWrapper = item.lesson || item;
    const lesson = lessonWrapper.lesson || lessonWrapper;
    const medias = lessonWrapper.medias || [];

    console.log(
      "[Lock-in] Lesson id:",
      lesson?.id,
      "medias count:",
      medias.length
    );

    if (!lesson || !lesson.id) {
      console.log("[Lock-in] Skipping item without lesson id");
      continue;
    }

    // Create a video entry for each media in the lesson
    for (const media of medias) {
      if (!media.id) continue;

      // Skip unavailable media
      if (media.isAvailable === false) {
        console.log("[Lock-in] Skipping unavailable media:", media.id);
        continue;
      }

      const title =
        lesson.name ||
        lesson.displayName ||
        media.title ||
        `Recording ${videos.length + 1}`;
      const recordedAt =
        lesson.timing?.start || lessonWrapper.captureStartedAt || null;

      videos.push({
        id: `${lesson.id}_${media.id}`,
        provider: "echo360",
        title,
        embedUrl: `${echoOrigin}/lesson/${lesson.id}/classroom`,
        echoOrigin,
        sectionId,
        lessonId: lesson.id,
        mediaId: media.id,
        durationMs: media.durationMs || undefined,
        thumbnailUrl: media.thumbnailUri || media.thumbnailUrl || undefined,
        recordedAt,
      });

      console.log("[Lock-in] Added video:", title);
    }

    // If no medias array but lesson has video content, create placeholder entry
    if (medias.length === 0 && lesson.id && lessonWrapper.hasVideo) {
      videos.push({
        id: lesson.id,
        provider: "echo360",
        title:
          lesson.name || lesson.displayName || `Recording ${videos.length + 1}`,
        embedUrl: `${echoOrigin}/lesson/${lesson.id}/classroom`,
        echoOrigin,
        sectionId,
        lessonId: lesson.id,
        recordedAt: lesson.timing?.start || null,
      });
      console.log(
        "[Lock-in] Added lesson without explicit media:",
        lesson.name
      );
    }
  }

  console.log("[Lock-in] Total videos parsed:", videos.length);
  return videos;
}

/**
 * Extract potential sectionId from a compound Echo360 lessonId
 * Echo360 compound lesson IDs often contain embedded section IDs in the format:
 * G_{uuid1}_{sectionId}_{timestamp1}_{timestamp2}
 * @param {string} lessonId - The compound lesson ID
 * @returns {string|null} Section ID if found, null otherwise
 */
function extractSectionIdFromLessonId(lessonId) {
  if (!lessonId) return null;
  
  // UUID pattern
  const UUID_PATTERN = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
  
  // Find all UUIDs in the lessonId
  const uuids = lessonId.match(UUID_PATTERN);
  
  if (!uuids || uuids.length < 2) {
    console.log('[Lock-in] Could not find multiple UUIDs in lessonId:', lessonId);
    return null;
  }
  
  // The second UUID is typically the sectionId
  // First UUID is usually the lesson/recording UUID
  // Second UUID is the section UUID
  console.log('[Lock-in] Found UUIDs in lessonId:', uuids);
  return uuids[1]; // Return the second UUID as the sectionId
}

/**
 * Try to fetch mediaId from Echo360 using multiple strategies
 * @param {string} echoOrigin - Echo360 origin URL
 * @param {string} lessonId - Lesson ID
 * @returns {Promise<string|null>} Media ID or null if not found
 */
async function fetchEcho360MediaId(echoOrigin, lessonId) {
  // Strategy 0: Try to extract sectionId from compound lessonId and use syllabus API
  const embeddedSectionId = extractSectionIdFromLessonId(lessonId);
  if (embeddedSectionId) {
    try {
      console.log('[Lock-in] Strategy 0: Trying syllabus API with embedded sectionId:', embeddedSectionId);
      const syllabusResult = await fetchEcho360Syllabus({ echoOrigin, sectionId: embeddedSectionId });
      
      if (syllabusResult.success && syllabusResult.videos && syllabusResult.videos.length > 0) {
        // Find the video that matches our lessonId
        for (const video of syllabusResult.videos) {
          // Check if this video's lessonId matches (could be exact or partial match)
          if (video.lessonId && lessonId.includes(video.lessonId)) {
            if (video.mediaId) {
              console.log('[Lock-in] Strategy 0 SUCCESS - Found mediaId from syllabus:', video.mediaId);
              return video.mediaId;
            }
          }
        }
        
        // If no exact match, try the first video with a mediaId (single-video sections)
        if (syllabusResult.videos.length === 1 && syllabusResult.videos[0].mediaId) {
          console.log('[Lock-in] Strategy 0 SUCCESS - Using single video mediaId:', syllabusResult.videos[0].mediaId);
          return syllabusResult.videos[0].mediaId;
        }
        
        console.log('[Lock-in] Strategy 0: Found syllabus but no matching mediaId for lessonId');
      }
    } catch (e) {
      console.warn('[Lock-in] Strategy 0 failed:', e.message);
    }
  }

  // Strategy 1: Try fetching lesson details
  try {
    const lessonUrl = `${echoOrigin}/api/ui/echoplayer/lessons/${lessonId}`;
    console.log("[Lock-in] Strategy 1: Fetching lesson from:", lessonUrl);

    const lessonResponse = await fetch(lessonUrl, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (lessonResponse.ok) {
      const lessonData = await lessonResponse.json();
      console.log("[Lock-in] Lesson data keys:", Object.keys(lessonData || {}));
      console.log("[Lock-in] Lesson data (truncated):", JSON.stringify(lessonData).substring(0, 2000));

      // Try various response structures
      const medias = 
        lessonData.data?.medias ||
        lessonData.medias ||
        lessonData.data?.lesson?.medias ||
        lessonData.lesson?.medias ||
        [];
      
      if (medias.length > 0 && medias[0].id) {
        console.log("[Lock-in] Strategy 1 SUCCESS - Found media ID:", medias[0].id);
        return medias[0].id;
      }
      
      // Check for media in video property
      const video = lessonData.data?.video || lessonData.video;
      if (video?.id) {
        console.log("[Lock-in] Strategy 1 SUCCESS - Found video ID:", video.id);
        return video.id;
      }
    }
  } catch (e) {
    console.warn("[Lock-in] Strategy 1 failed:", e.message);
  }

  // Strategy 2: Try fetching lesson medias directly
  try {
    const mediasUrl = `${echoOrigin}/api/ui/echoplayer/lessons/${lessonId}/medias`;
    console.log("[Lock-in] Strategy 2: Fetching medias from:", mediasUrl);

    const mediasResponse = await fetch(mediasUrl, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (mediasResponse.ok) {
      const mediasData = await mediasResponse.json();
      console.log("[Lock-in] Medias data:", JSON.stringify(mediasData).substring(0, 1000));

      const medias = Array.isArray(mediasData) ? mediasData : 
                     mediasData.data || mediasData.medias || [];
      
      if (medias.length > 0 && medias[0].id) {
        console.log("[Lock-in] Strategy 2 SUCCESS - Found media ID:", medias[0].id);
        return medias[0].id;
      }
    }
  } catch (e) {
    console.warn("[Lock-in] Strategy 2 failed:", e.message);
  }

  // Strategy 3: Try fetching the classroom page and parsing for mediaId
  try {
    const classroomUrl = `${echoOrigin}/lesson/${lessonId}/classroom`;
    console.log("[Lock-in] Strategy 3: Fetching classroom HTML from:", classroomUrl);

    const classroomResponse = await fetch(classroomUrl, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "text/html" },
    });

    if (classroomResponse.ok) {
      const html = await classroomResponse.text();
      
      // Look for mediaId in various patterns
      const patterns = [
        /"mediaId"\s*:\s*"([a-f0-9-]{36})"/i,
        /"media[_-]?id"\s*[=:]\s*"([a-f0-9-]{36})"/i,
        /medias\/([a-f0-9-]{36})\/transcript/i,
        /medias\/([a-f0-9-]{36})(?:\/|\?|")/i,
        /"id"\s*:\s*"([a-f0-9-]{36})"/g, // Multiple UUIDs - we'll pick the first that looks like a media ID
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          console.log("[Lock-in] Strategy 3 SUCCESS - Found media ID from pattern:", pattern.source, "->", match[1]);
          return match[1];
        }
      }
      
      console.log("[Lock-in] Strategy 3: No mediaId found in HTML");
    }
  } catch (e) {
    console.warn("[Lock-in] Strategy 3 failed:", e.message);
  }

  // Strategy 4: Try the public API info endpoint
  try {
    const infoUrl = `${echoOrigin}/api/ui/echoplayer/public-api/lessons/${lessonId}/info`;
    console.log("[Lock-in] Strategy 4: Fetching public info from:", infoUrl);

    const infoResponse = await fetch(infoUrl, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    if (infoResponse.ok) {
      const infoData = await infoResponse.json();
      console.log("[Lock-in] Info data:", JSON.stringify(infoData).substring(0, 1000));

      const medias = infoData.data?.medias || infoData.medias || [];
      if (medias.length > 0 && medias[0].id) {
        console.log("[Lock-in] Strategy 4 SUCCESS - Found media ID:", medias[0].id);
        return medias[0].id;
      }
    }
  } catch (e) {
    console.warn("[Lock-in] Strategy 4 failed:", e.message);
  }

  return null;
}

/**
 * Fetch transcript for an Echo360 video
 * @param {Object} video - DetectedVideo with Echo360 metadata
 * @returns {Promise<Object>} Result with transcript or error
 */
async function extractEcho360Transcript(video) {
  const { echoOrigin, lessonId, mediaId } = video;

  console.log("[Lock-in] extractEcho360Transcript called with:", {
    echoOrigin,
    lessonId,
    mediaId,
  });

  if (!echoOrigin || !lessonId) {
    console.error("[Lock-in] Missing required Echo360 metadata");
    return {
      success: false,
      error: "Missing Echo360 video metadata (origin or lessonId)",
      errorCode: "INVALID_CONTEXT",
      aiTranscriptionAvailable: true,
    };
  }

  // If mediaId is missing, try multiple strategies to get it
  let targetMediaId = mediaId;
  if (!targetMediaId) {
    console.log("[Lock-in] No mediaId provided, trying multiple strategies to find it...");
    targetMediaId = await fetchEcho360MediaId(echoOrigin, lessonId);
  } else {
    console.log("[Lock-in] Using provided mediaId:", targetMediaId);
  }

  if (!targetMediaId) {
    console.error("[Lock-in] Could not determine media ID after all strategies");
    return {
      success: false,
      error: "Could not determine media ID for transcript",
      errorCode: "NO_MEDIA_ID",
      aiTranscriptionAvailable: true,
    };
  }

  const transcriptUrl = `${echoOrigin}/api/ui/echoplayer/lessons/${lessonId}/medias/${targetMediaId}/transcript`;
  console.log("[Lock-in] Fetching transcript from:", transcriptUrl);

  try {
    const response = await fetchWithRetry(transcriptUrl, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: "Please sign in to Echo360 to access transcripts.",
          errorCode: "AUTH_REQUIRED",
          aiTranscriptionAvailable: true,
        };
      }
      if (response.status === 404) {
        return {
          success: false,
          error:
            "Transcript not available for this recording. AI transcription may be available as a fallback.",
          errorCode: "NOT_AVAILABLE",
          aiTranscriptionAvailable: true,
        };
      }
      return {
        success: false,
        error: `Failed to fetch transcript: HTTP ${response.status}`,
        errorCode: "NETWORK_ERROR",
        aiTranscriptionAvailable: true,
      };
    }

    const data = await response.json();
    const transcript = parseEcho360Transcript(data);

    if (!transcript || transcript.segments.length === 0) {
      return {
        success: false,
        error:
          "Transcript not available for this recording. AI transcription may be available as a fallback.",
        errorCode: "NOT_AVAILABLE",
        aiTranscriptionAvailable: true,
      };
    }

    return {
      success: true,
      transcript,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Lock-in] Echo360 transcript fetch error:", message);

    return {
      success: false,
      error: `Failed to fetch transcript: ${message}`,
      errorCode: "NETWORK_ERROR",
      aiTranscriptionAvailable: true,
    };
  }
}

/**
 * Parse Echo360 transcript API response into TranscriptResult
 * @param {Object} data - Transcript API response
 * @returns {Object|null} TranscriptResult or null if no content
 */
function parseEcho360Transcript(data) {
  console.log(
    "[Lock-in] parseEcho360Transcript: raw data keys:",
    Object.keys(data || {})
  );

  // Handle various response structures
  const cues =
    data?.data?.contentJSON?.cues ||
    data?.contentJSON?.cues ||
    data?.cues ||
    [];

  console.log("[Lock-in] parseEcho360Transcript: found", cues.length, "cues");

  if (!cues || cues.length === 0) {
    console.log(
      "[Lock-in] parseEcho360Transcript: no cues found, data structure:",
      JSON.stringify(data).substring(0, 1000)
    );
    return null;
  }

  const segments = [];
  const textParts = [];

  for (const cue of cues) {
    const text = (cue.content || cue.text || "").trim();
    if (!text) continue;

    segments.push({
      startMs: cue.startMs || cue.start || 0,
      endMs: cue.endMs || cue.end || 0,
      text,
      speaker: cue.speaker || undefined,
    });

    textParts.push(text);
  }

  const plainText = textParts.join(" ");
  const durationMs =
    segments.length > 0 ? segments[segments.length - 1].endMs : 0;

  console.log(
    "[Lock-in] parseEcho360Transcript: parsed",
    segments.length,
    "segments, plainText length:",
    plainText.length
  );

  return {
    plainText,
    segments,
    durationMs,
  };
}

/**
 * Handle transcript extraction message
 */
async function handleTranscriptExtraction(video) {
  switch (video.provider) {
    case "panopto": {
      const result = await extractPanoptoTranscript(video);
      return { success: result.success, data: result };
    }
    case "echo360": {
      const result = await extractEcho360Transcript(video);
      return { success: result.success, data: result };
    }
    default:
      return {
        success: false,
        error: `Unsupported video provider: ${video.provider}`,
      };
  }
}

// Session management
const SESSION_STORAGE_PREFIX = "lockin_session_";

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
    console.error("Lock-in: Failed to get session:", error);
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
    chatHistory: Array.isArray(sessionData?.chatHistory)
      ? sessionData.chatHistory
      : [],
    updatedAt: Date.now(),
  };

  try {
    await chrome.storage.local.set({ [key]: storedSession });
  } catch (error) {
    console.error("Lock-in: Failed to save session:", error);
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
    console.error("Lock-in: Failed to clear session:", error);
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
      case "getTabId":
      case "GET_TAB_ID": {
        return Messaging
          ? Messaging.createSuccessResponse({ tabId })
          : { tabId };
      }

      case "getSession":
      case "GET_SESSION": {
        const session = await getSession(tabId);
        return Messaging
          ? Messaging.createSuccessResponse({ session })
          : { session };
      }

      case "saveSession":
      case "SAVE_SESSION": {
        const sessionData = message.sessionData || message.payload?.sessionData;
        await saveSession(tabId, sessionData);
        return Messaging
          ? Messaging.createSuccessResponse({ success: true })
          : { success: true };
      }

      case "clearSession":
      case "CLEAR_SESSION": {
        await clearSession(tabId);
        return Messaging
          ? Messaging.createSuccessResponse({ success: true })
          : { success: true };
      }

      case "getSettings":
      case "GET_SETTINGS": {
        return new Promise((resolve) => {
          chrome.storage.sync.get(
            ["preferredLanguage", "difficultyLevel"],
            (data) => {
              resolve(Messaging ? Messaging.createSuccessResponse(data) : data);
            }
          );
        });
      }

      case "saveSettings":
      case "UPDATE_SETTINGS": {
        const settings = message.settings || message.payload?.settings || {};
        return new Promise((resolve) => {
          chrome.storage.sync.set(settings, () => {
            resolve(
              Messaging
                ? Messaging.createSuccessResponse({ success: true })
                : { success: true }
            );
          });
        });
      }

      case "extractTranscript":
      case "EXTRACT_TRANSCRIPT": {
        const video = message.video || message.payload?.video;
        if (!video) {
          return Messaging
            ? Messaging.createErrorResponse("No video provided")
            : { error: "No video provided" };
        }
        const result = await handleTranscriptExtraction(video);
        return Messaging
          ? result.success
            ? Messaging.createSuccessResponse(result)
            : Messaging.createErrorResponse(
                result.error || "Failed to extract transcript",
                result
              )
          : result;
      }

      case "fetchEcho360Syllabus":
      case "FETCH_ECHO360_SYLLABUS": {
        const context = message.context || message.payload?.context;
        if (!context) {
          return Messaging
            ? Messaging.createErrorResponse("No Echo360 context provided")
            : { success: false, error: "No Echo360 context provided" };
        }
        const result = await fetchEcho360Syllabus(context);
        if (result.success) {
          return Messaging
            ? Messaging.createSuccessResponse({
                success: true,
                videos: result.videos,
              })
            : { success: true, videos: result.videos };
        }
        return Messaging
          ? Messaging.createErrorResponse(
              result.error || "Failed to fetch syllabus",
              { data: result }
            )
          : { success: false, error: result.error, data: result };
      }

      default: {
        const error = `Unknown message type: ${messageType}`;
        return Messaging ? Messaging.createErrorResponse(error) : { error };
      }
    }
  } catch (error) {
    console.error("Lock-in: Error handling message:", error);
    const errorMessage = error.message || String(error);
    return Messaging
      ? Messaging.createErrorResponse(errorMessage)
      : { error: errorMessage };
  }
}

// Extension lifecycle
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu
  chrome.contextMenus.create({
    id: "lockin-process",
    title: "Lock-in: Explain",
    contexts: ["selection"],
  });

  console.log("Lock-in extension installed successfully!");
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "lockin-process" && info.selectionText) {
    // Send message to content script to show the mode selector
    chrome.tabs
      .sendMessage(tab.id, {
        type: "SHOW_MODE_SELECTOR",
        payload: {
          text: info.selectionText,
        },
      })
      .catch((error) => {
        console.error(
          "Lock-in: Failed to send message to content script:",
          error
        );
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
if (Messaging && typeof Messaging.setupMessageListener === "function") {
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
console.log("Lock-in background service worker started");
