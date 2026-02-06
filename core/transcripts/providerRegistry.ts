/**
 * Provider Registry
 *
 * Manages video transcript providers and coordinates detection.
 * Supports both synchronous (DOM-based) and asynchronous (API-based) detection.
 */

import type {
  VideoProvider,
  DetectedVideo,
  VideoDetectionContext,
  TranscriptExtractionResult,
} from './types';
import type { AsyncFetcher, EnhancedAsyncFetcher } from './fetchers/types';

// ─────────────────────────────────────────────────────────────────────────────
// Provider Interface (Extended)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extended provider interface with async support
 */
export interface TranscriptProviderV2 {
  /** Provider type identifier */
  readonly provider: VideoProvider;

  /** Check if this provider can handle the given URL */
  canHandle(url: string): boolean;

  /**
   * Detect videos synchronously from DOM context.
   * Returns empty array if async detection is required.
   */
  detectVideosSync(context: VideoDetectionContext): DetectedVideo[];

  /**
   * Whether this provider requires async (API-based) detection.
   * If true, detectVideosAsync must be implemented.
   */
  requiresAsyncDetection(context: VideoDetectionContext): boolean;

  /**
   * Detect videos asynchronously (e.g., via API calls).
   * Only called if requiresAsyncDetection returns true.
   * This is typically handled by the background script.
   */
  detectVideosAsync?(
    context: VideoDetectionContext,
    fetcher: AsyncFetcher,
  ): Promise<DetectedVideo[]>;

  /**
   * Extract transcript for a video.
   * Typically handled by the background script.
   * Providers can use EnhancedAsyncFetcher for advanced features like redirect tracking.
   */
  extractTranscript?(
    video: DetectedVideo,
    fetcher: AsyncFetcher | EnhancedAsyncFetcher,
  ): Promise<TranscriptExtractionResult>;

  /**
   * Get a hint message when no videos are detected.
   * This allows provider-specific guidance (e.g., "Open a lesson page").
   * Returns null if no hint is available.
   */
  getEmptyDetectionHint?(context: VideoDetectionContext): string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Registry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registry of transcript providers
 */
class ProviderRegistry {
  private providers: TranscriptProviderV2[] = [];

  /**
   * Register a provider
   */
  register(provider: TranscriptProviderV2): void {
    // Prevent duplicates
    if (this.providers.some((p) => p.provider === provider.provider)) {
      return;
    }
    this.providers.push(provider);
  }

  /**
   * Get all registered providers
   */
  getAll(): TranscriptProviderV2[] {
    return [...this.providers];
  }

  /**
   * Get provider that can handle a URL
   */
  getProviderForUrl(url: string): TranscriptProviderV2 | null {
    return this.providers.find((p) => p.canHandle(url)) || null;
  }

  /**
   * Detect videos synchronously from all providers
   */
  detectVideosSync(context: VideoDetectionContext): {
    videos: DetectedVideo[];
    provider: TranscriptProviderV2 | null;
    requiresAsync: boolean;
  } {
    // First, find provider that handles this URL
    const provider = this.getProviderForUrl(context.pageUrl);
    if (!provider) {
      return { videos: [], provider: null, requiresAsync: false };
    }

    // Check if async detection is required
    if (provider.requiresAsyncDetection(context)) {
      return { videos: [], provider, requiresAsync: true };
    }

    // Perform sync detection
    const videos = provider.detectVideosSync(context);
    return { videos, provider, requiresAsync: false };
  }

  /**
   * Clear all registered providers (for testing)
   */
  clear(): void {
    this.providers = [];
  }
}

// Global registry instance
const registry = new ProviderRegistry();

/**
 * Get the global provider registry
 */
export function getProviderRegistry(): ProviderRegistry {
  return registry;
}

/**
 * Register a provider
 */
export function registerProvider(provider: TranscriptProviderV2): void {
  registry.register(provider);
}

/**
 * Get provider for a URL
 */
export function getProviderForUrl(url: string): TranscriptProviderV2 | null {
  return registry.getProviderForUrl(url);
}

/**
 * Detect videos synchronously from all registered providers
 */
export function detectVideosFromRegistry(context: VideoDetectionContext): {
  videos: DetectedVideo[];
  provider: TranscriptProviderV2 | null;
  requiresAsync: boolean;
} {
  return registry.detectVideosSync(context);
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Registration
// ─────────────────────────────────────────────────────────────────────────────

// Note: Actual provider implementations are in ./providers/
// They should be imported and registered during application bootstrap.
// Example:
//   import { PanoptoProvider } from './providers/panoptoProvider';
//   registerProvider(new PanoptoProvider());
