/**
 * Echo360 Transcript Provider
 * 
 * Handles detection and transcript extraction for Echo360 videos.
 * Echo360 pages have URLs like:
 *   https://echo360.{domain}/section/{sectionId}/home
 *   https://echo360.{domain}/lesson/{lessonId}/classroom
 * 
 * Syllabus API: GET /section/{sectionId}/syllabus
 * Transcript API: GET /api/ui/echoplayer/lessons/{lessonId}/medias/{mediaId}/transcript
 */

import type {
  TranscriptProvider,
  VideoProvider,
  DetectedVideo,
  VideoDetectionContext,
  Echo360Context,
} from '@core/transcripts/types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List of valid Echo360 host domains
 */
export const ECHO360_HOSTS = [
  'echo360qa.org',
  'echo360qa.dev',
  'echo360.org',
  'echo360.org.au',
  'echo360.net.au',
  'echo360.ca',
  'echo360.org.uk',
] as const;

/**
 * Regex to extract section ID from Echo360 URL
 * Matches: /section/{sectionId}/...
 * Section IDs are UUIDs with hex chars and dashes
 */
const SECTION_ID_REGEX = /\/section\/([a-f0-9-]+)/i;

/**
 * Regex to extract lesson ID from Echo360 URL
 * Matches: /lesson/{lessonId}/...
 * Lesson IDs can contain: letters, numbers, dashes, underscores, dots, colons
 * Example: G_6f71556b-833c-..._2025-07-31T13:58:00.000_2025-07-31T15:53:00.000
 */
const LESSON_ID_REGEX = /\/lesson\/([^/]+)/i;

// ─────────────────────────────────────────────────────────────────────────────
// URL Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a hostname is an Echo360 domain
 */
export function isEcho360Domain(hostname: string): boolean {
  const lowerHost = hostname.toLowerCase();
  return ECHO360_HOSTS.some(domain => 
    lowerHost === domain || lowerHost.endsWith('.' + domain)
  );
}

/**
 * Check if a URL is an Echo360 page
 */
export function isEcho360Url(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return isEcho360Domain(urlObj.hostname);
  } catch {
    return false;
  }
}

/**
 * Extract Echo360 origin from hostname
 */
export function extractEcho360Origin(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (isEcho360Domain(urlObj.hostname)) {
      return urlObj.origin;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract section ID from Echo360 URL
 */
export function extractSectionId(url: string): string | null {
  const match = url.match(SECTION_ID_REGEX);
  return match ? match[1] : null;
}

/**
 * Extract lesson ID from Echo360 URL
 */
export function extractLessonId(url: string): string | null {
  const match = url.match(LESSON_ID_REGEX);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * Extract media ID from Echo360 URL query params
 * Tries multiple common parameter names for robustness
 */
export function extractMediaId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // Try common parameter names
    return urlObj.searchParams.get('mediaId') ||
           urlObj.searchParams.get('media') ||
           urlObj.searchParams.get('mid') ||
           null;
  } catch {
    return null;
  }
}

/**
 * Extract full Echo360 context from a page URL
 * Uses multiple fallback strategies for robustness across different configurations
 */
export function extractEcho360Context(url: string): Echo360Context | null {
  const echoOrigin = extractEcho360Origin(url);
  if (!echoOrigin) return null;
  
  let lessonId = extractLessonId(url) || undefined;
  let sectionId = extractSectionId(url) || undefined;
  let mediaId = extractMediaId(url) || undefined;
  
  // Fallback: Check query params for IDs
  try {
    const urlObj = new URL(url);
    if (!lessonId) {
      lessonId = urlObj.searchParams.get('lessonId') ||
                 urlObj.searchParams.get('lesson') ||
                 urlObj.searchParams.get('lid') ||
                 undefined;
    }
    if (!sectionId) {
      sectionId = urlObj.searchParams.get('sectionId') ||
                  urlObj.searchParams.get('section') ||
                  urlObj.searchParams.get('sid') ||
                  undefined;
    }
  } catch {
    // URL parsing failed, continue with what we have
  }
  
  return {
    echoOrigin,
    sectionId,
    lessonId,
    mediaId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Echo360 transcript provider implementation
 */
export class Echo360TranscriptProvider implements TranscriptProvider {
  readonly provider: VideoProvider = 'echo360';
  
  canHandle(url: string): boolean {
    return isEcho360Url(url);
  }
  
  /**
   * For Echo360, video detection happens dynamically via API calls,
   * not by scanning the DOM. This method returns an empty array as
   * detection is handled by the useTranscripts hook with API calls.
   */
  detectVideos(_context: VideoDetectionContext): DetectedVideo[] {
    // Echo360 detection requires API calls which are handled separately
    // in the useTranscripts hook and background script
    return [];
  }
}

/**
 * Create a new Echo360 provider instance
 */
export function createEcho360Provider(): Echo360TranscriptProvider {
  return new Echo360TranscriptProvider();
}

