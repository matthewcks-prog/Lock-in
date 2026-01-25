/**
 * Text Processing Utilities
 *
 * Pure utility functions for text manipulation - no dependencies.
 */

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
export function extractCourseCodeFromText(text: string): string | null {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/\b([A-Z]{3}\d{4})\b/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) return 'Just now';

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 60) {
    return minutes <= 1 ? 'Just now' : `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hr${hours > 1 ? 's' : ''} ago`;
  }

  return date.toLocaleDateString();
}

/**
 * Build fallback chat title from timestamp
 */
export function buildFallbackChatTitle(timestamp: string | null | undefined): string {
  if (!timestamp) return 'Untitled chat';

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Untitled chat';

  return `Chat from ${date.toISOString().split('T')[0]}`;
}
