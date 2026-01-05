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
export * from './fetchers/types';
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
export {
  Echo360Provider,
  createEcho360Provider,
  detectEcho360Videos,
  extractEcho360Info,
  extractSectionId,
  isEcho360Domain,
  isEcho360SectionPage,
  isEcho360Url,
  normalizeEcho360TranscriptJson,
  type Echo360Info,
} from './providers/echo360Provider';
