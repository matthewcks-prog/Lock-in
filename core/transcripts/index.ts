/**
 * Transcripts Module
 * 
 * Core transcript types and utilities.
 * No Chrome dependencies - pure TypeScript.
 */

export * from './types';
export * from './webvttParser';
export * from './videoDetection';
export * from './providerRegistry';
export {
  PanoptoProvider,
  createPanoptoProvider,
  extractCaptionVttUrl,
  extractPanoptoMediaUrl,
  extractDeliveryId,
  extractTenantDomain,
  extractPanoptoInfo,
  buildPanoptoEmbedUrl,
  buildPanoptoViewerUrl,
  normalizePanoptoEmbedUrl,
  detectPanoptoFromLinks,
  detectPanoptoFromRedirect,
  isPanoptoUrl,
  isPanoptoDomain,
  isLmsRedirectPage,
  type PanoptoInfo,
} from './providers/panoptoProvider';
