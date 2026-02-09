/**
 * Site Adapter Factory
 *
 * Selects the appropriate adapter based on the current URL.
 */

import type { BaseAdapter } from './adapters/baseAdapter';
import { GenericAdapter } from './adapters/baseAdapter';
import { MoodleAdapter } from './adapters/moodleAdapter';
import { EdstemAdapter } from './adapters/edstemAdapter';

// Registry of all adapters (order matters - more specific first)
const adapters: BaseAdapter[] = [
  new MoodleAdapter(),
  new EdstemAdapter(),
  new GenericAdapter(), // Fallback - must be last
];

/**
 * Get the appropriate adapter for the given URL
 */
export function getAdapterForUrl(url: string): BaseAdapter {
  for (const adapter of adapters) {
    if (adapter.canHandle(url)) {
      return adapter;
    }
  }
  // Should never reach here since GenericAdapter handles everything
  return new GenericAdapter();
}

/**
 * Get adapter for current page
 */
export function getCurrentAdapter(): BaseAdapter {
  if (typeof window === 'undefined' || !window.location) {
    return new GenericAdapter();
  }
  return getAdapterForUrl(window.location.href);
}

// Export adapter classes for direct use if needed
export type { BaseAdapter };
export { GenericAdapter, MoodleAdapter, EdstemAdapter };
