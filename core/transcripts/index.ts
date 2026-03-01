/**
 * Transcripts Module
 *
 * Core transcript types and utilities.
 * No Chrome dependencies - pure TypeScript.
 */

export type * from './types';
export * from './webvttParser';
export * from './videoDetection';
export * from './providerRegistry';
export type * from './fetchers/types';
export {
  PanoptoProvider,
  createPanoptoProvider,
  extractCaptionVttUrl,
  extractPanoptoInfoFromHtml,
  extractPanoptoMediaUrl,
  extractPanoptoInfo,
  buildPanoptoEmbedUrl,
  buildPanoptoViewerUrl,
  normalizePanoptoEmbedUrl,
  resolvePanoptoInfoFromWrapperUrl,
  detectPanoptoFromLinks,
  detectPanoptoFromRedirect,
  isPanoptoUrl,
  isPanoptoDomain,
  isLmsRedirectPage,
  type PanoptoInfo,
} from './providers/panoptoProvider';
export { Html5Provider, createHtml5Provider } from './providers/html5Provider';
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
