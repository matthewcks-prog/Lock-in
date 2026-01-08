'use strict';
/**
 * Provider Registry
 *
 * Manages video transcript providers and coordinates detection.
 * Supports both synchronous (DOM-based) and asynchronous (API-based) detection.
 */
Object.defineProperty(exports, '__esModule', { value: true });
exports.getProviderRegistry = getProviderRegistry;
exports.registerProvider = registerProvider;
exports.getProviderForUrl = getProviderForUrl;
exports.detectVideosFromRegistry = detectVideosFromRegistry;
// ─────────────────────────────────────────────────────────────────────────────
// Provider Registry
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Registry of transcript providers
 */
class ProviderRegistry {
  constructor() {
    this.providers = [];
  }
  /**
   * Register a provider
   */
  register(provider) {
    // Prevent duplicates
    if (this.providers.some((p) => p.provider === provider.provider)) {
      return;
    }
    this.providers.push(provider);
  }
  /**
   * Get all registered providers
   */
  getAll() {
    return [...this.providers];
  }
  /**
   * Get provider that can handle a URL
   */
  getProviderForUrl(url) {
    return this.providers.find((p) => p.canHandle(url)) || null;
  }
  /**
   * Detect videos synchronously from all providers
   */
  detectVideosSync(context) {
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
  clear() {
    this.providers = [];
  }
}
// Global registry instance
const registry = new ProviderRegistry();
/**
 * Get the global provider registry
 */
function getProviderRegistry() {
  return registry;
}
/**
 * Register a provider
 */
function registerProvider(provider) {
  registry.register(provider);
}
/**
 * Get provider for a URL
 */
function getProviderForUrl(url) {
  return registry.getProviderForUrl(url);
}
/**
 * Detect videos synchronously from all registered providers
 */
function detectVideosFromRegistry(context) {
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
