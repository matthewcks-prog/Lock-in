import {
  extractPanoptoInfo as _extractPanoptoInfo,
  isPanoptoUrl as _isPanoptoUrl,
} from './providers/panoptoProvider';
export type { PanoptoInfo } from './providers/panoptoProvider';
export const extractPanoptoInfo = _extractPanoptoInfo;
export const isPanoptoUrl = _isPanoptoUrl;

export { detectPanoptoVideosFromIframes } from './videoDetection/panoptoDetection';
export { detectHtml5Videos } from './videoDetection/html5Detection';
export { detectVideosSync, type VideoDetectionResult } from './videoDetection/detectVideosSync';
export {
  MAX_IFRAME_DEPTH,
  collectIframeInfo,
  buildDetectionContext,
} from './videoDetection/context';
