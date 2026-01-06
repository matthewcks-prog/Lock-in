/**
 * Transcript Types
 * 
 * Core type definitions for video transcript extraction.
 * No Chrome dependencies - pure TypeScript.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Video Providers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Supported video provider types
 */
export type VideoProvider = 'panopto' | 'echo360' | 'youtube' | 'html5' | 'unknown';

// ─────────────────────────────────────────────────────────────────────────────
// Video Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A detected video on a page
 */
export interface DetectedVideo {
  /** Unique identifier for the video (provider-specific) */
  id: string;
  /** Video provider */
  provider: VideoProvider;
  /** Video title (if available) */
  title: string;
  /** URL to embed/view the video */
  embedUrl: string;
  /** Thumbnail URL (optional) */
  thumbnailUrl?: string;
  /** Duration in milliseconds (optional) */
  durationMs?: number;
  /** Recording date/time (optional) */
  recordedAt?: string;

  // HTML5-specific fields
  /** Direct media URL for HTML5 video elements */
  mediaUrl?: string;
  /** DOM id for the video element (if present) */
  domId?: string;
  /** Stable-ish selector path for the video element */
  domSelector?: string;
  /** Captions/subtitles track URLs (if available) */
  trackUrls?: Array<{
    kind: string;
    label?: string;
    srclang?: string;
    src: string;
  }>;
  /** DRM detection hint (mediaKeys/encrypted) */
  drmDetected?: boolean;
  /** DRM detection signal (e.g., "mediaKeys", "encrypted-event") */
  drmReason?: string;
  // Panopto-specific fields
  /** Panopto tenant domain (e.g., "monash.au.panopto.com") */
  panoptoTenant?: string;
  // Echo360-specific fields
  /** Echo360 lesson identifier (UUID-like) */
  echoLessonId?: string;
  /** Echo360 media identifier (UUID-like) */
  echoMediaId?: string;
  /** Echo360 base URL (origin) for API calls */
  echoBaseUrl?: string;
}

/**
 * Context for video detection on a page
 */
export interface VideoDetectionContext {
  /** Current page URL */
  pageUrl: string;
  /** All iframes on the page */
  iframes: Array<{
    src: string;
    title?: string;
  }>;
  /** Document for DOM access (optional, not available in background) */
  document?: Document;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transcript Results
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single transcript segment with timing
 */
export interface TranscriptSegment {
  /** Start time in milliseconds */
  startMs: number;
  /** End time in milliseconds */
  endMs: number | null;
  /** Transcript text for this segment */
  text: string;
  /** Speaker name (optional) */
  speaker?: string;
  /** Confidence score (optional, 0..1) */
  confidence?: number;
}

/**
 * Full transcript result
 */
export interface TranscriptResult {
  /** Plain text version of the transcript */
  plainText: string;
  /** Timed segments */
  segments: TranscriptSegment[];
  /** Total duration in milliseconds */
  durationMs?: number;
}

/**
 * Result from transcript extraction attempt
 */
export interface TranscriptExtractionResult {
  /** Whether extraction succeeded */
  success: boolean;
  /** Transcript data (if success) */
  transcript?: TranscriptResult;
  /** Error message (if failed) */
  error?: string;
  /** Error code for programmatic handling */
  errorCode?: 'AUTH_REQUIRED' | 'LOCKIN_AUTH_REQUIRED' | 'NO_CAPTIONS' | 'NETWORK_ERROR' | 'PARSE_ERROR' | 'NOT_AVAILABLE' | 'INVALID_VIDEO' | 'MEDIA_PROCESSING' | 'MEDIA_FAILED' | 'MEDIA_PRELIMINARY' | 'MEDIA_HIDDEN' | 'INVALID_RESPONSE' | 'TIMEOUT';
  /** Whether AI transcription is available as fallback */
  aiTranscriptionAvailable?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Interface for transcript providers
 */
export interface TranscriptProvider {
  /** Provider type identifier */
  readonly provider: VideoProvider;
  
  /** Check if this provider can handle the given URL */
  canHandle(url: string): boolean;
  
  /** Detect videos on a page */
  detectVideos(context: VideoDetectionContext): DetectedVideo[];
  
  /** Extract caption URL from embed HTML (optional) */
  extractCaptionUrl?(html: string, video: DetectedVideo): string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
