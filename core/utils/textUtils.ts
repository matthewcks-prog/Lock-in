/**
 * Text Processing Utilities
 *
 * Pure utility functions for text manipulation - no dependencies.
 */

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MILLISECONDS_PER_MINUTE = SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  if (typeof text !== 'string') return '';
  return text.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

/**
 * Extract course code from text (e.g., "FIT1045" or "MAT1830")
 * Pattern: 3 uppercase letters followed by 4 digits
 */
export function extractCourseCodeFromText(text: string | null | undefined): string | null {
  if (typeof text !== 'string' || text.length === 0) return null;
  const match = text.match(/\b([A-Z]{3}\d{4})\b/i);
  const courseCode = match?.[1];
  return typeof courseCode === 'string' && courseCode.length > 0 ? courseCode.toUpperCase() : null;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: string | null | undefined): string {
  if (timestamp === null || timestamp === undefined || timestamp === '') return 'Just now';

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / MILLISECONDS_PER_MINUTE);

  if (minutes < MINUTES_PER_HOUR) {
    return minutes <= 1 ? 'Just now' : `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) {
    return `${hours} hr${hours > 1 ? 's' : ''} ago`;
  }

  return date.toLocaleDateString();
}

/**
 * Build fallback chat title from timestamp
 */
export function buildFallbackChatTitle(timestamp: string | null | undefined): string {
  if (timestamp === null || timestamp === undefined || timestamp === '') return 'Untitled chat';

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Untitled chat';

  return `Chat from ${date.toISOString().split('T')[0]}`;
}
