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
  Echo360Provider,
  createEcho360Provider,
  parseEcho360Syllabus,
  parseEcho360Transcript,
} from './providers/echo360Provider';
export {
  PanoptoProvider,
  createPanoptoProvider,
  extractCaptionVttUrl,
  extractDeliveryId,
  extractTenantDomain,
} from './providers/panoptoProvider';

