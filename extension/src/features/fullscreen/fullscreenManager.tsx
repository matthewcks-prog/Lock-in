import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { FullscreenOverlayButton } from './fullscreenOverlayButton';
import { dispatchOpenSidebar } from './fullscreenEvents';
import type {
  FullscreenManager,
  FullscreenManagerOptions,
  FullscreenState,
} from './fullscreenTypes';
import { ensureElement, removeElement } from '../../shared/dom/safeDOM';

const MEDIA_QUERY = 'video';
const PANOPTO_HINT = 'panopto';
const OVERLAY_ID = 'lockin-fullscreen-overlay';

function resolveDocument(doc?: Document | null): Document | null {
  if (doc) return doc;
  if (typeof document !== 'undefined') return document;
  return null;
}

function resolveFullscreenElement(doc: Document | null): Element | null {
  if (!doc) return null;
  const standard = doc.fullscreenElement || null;
  const legacy = (doc as unknown as { webkitFullscreenElement?: Element | null })
    .webkitFullscreenElement;
  return standard || legacy || null;
}

function isPanoptoIframe(element: Element): boolean {
  if (element.tagName.toLowerCase() !== 'iframe') return false;
  const iframe = element as HTMLIFrameElement;
  const src = iframe.getAttribute('src') || '';
  const title = iframe.getAttribute('title') || '';
  return src.toLowerCase().includes(PANOPTO_HINT) || title.toLowerCase().includes(PANOPTO_HINT);
}

function detectMediaKind(element: Element | null): FullscreenState {
  if (!element) {
    return { isFullscreen: false, element: null, mediaKind: 'unknown' };
  }

  const tag = element.tagName?.toLowerCase?.() ?? '';
  if (tag === 'video') {
    return { isFullscreen: true, element, mediaKind: 'video-element' };
  }

  if (tag === 'iframe') {
    if (isPanoptoIframe(element)) {
      return { isFullscreen: true, element, mediaKind: 'panopto-iframe' };
    }
    return { isFullscreen: true, element, mediaKind: 'iframe' };
  }

  if (element instanceof HTMLElement) {
    const videoChild = element.querySelector(MEDIA_QUERY);
    if (videoChild) {
      return { isFullscreen: true, element, mediaKind: 'video-container' };
    }

    const iframeChild = element.querySelector('iframe');
    if (iframeChild && isPanoptoIframe(iframeChild)) {
      return { isFullscreen: true, element, mediaKind: 'panopto-iframe' };
    }
  }

  return { isFullscreen: true, element, mediaKind: 'unknown' };
}

export function createFullscreenManager(options: FullscreenManagerOptions): FullscreenManager {
  const targetDoc = resolveDocument(options.document);
  const eventTarget =
    options.eventTarget ?? (typeof window !== 'undefined' ? window : new EventTarget());
  const overlayId = options.overlayId ?? OVERLAY_ID;
  const renderOverlay = options.renderOverlay !== false;

  let overlayRoot: Root | null = null;
  let overlayHost: HTMLElement | null = null;
  let started = false;
  let lastState: FullscreenState = { isFullscreen: false, element: null, mediaKind: 'unknown' };

  const unmountOverlay = () => {
    if (overlayRoot) {
      overlayRoot.unmount();
      overlayRoot = null;
    }
    if (overlayHost) {
      removeElement(overlayHost);
      overlayHost = null;
    }
  };

  const exitFullscreenSafely = async () => {
    try {
      const doc = targetDoc ?? document;
      if (doc && typeof doc.exitFullscreen === 'function') {
        await doc.exitFullscreen();
      } else if (
        doc &&
        (doc as unknown as { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen
      ) {
        await (
          doc as unknown as { webkitExitFullscreen: () => Promise<void> }
        ).webkitExitFullscreen();
      }
    } catch (error) {
      // Swallow errors to avoid blocking sidebar open
      // eslint-disable-next-line no-console
      console.warn('[Lock-in] exitFullscreen failed:', error);
    } finally {
      dispatchOpenSidebar(eventTarget);
    }
  };

  const renderOverlayButton = () => {
    if (!renderOverlay || !targetDoc || !targetDoc.body) return;
    overlayHost = ensureElement({ doc: targetDoc, id: overlayId });
    if (!overlayHost) return;

    if (!overlayRoot) {
      overlayRoot = createRoot(overlayHost);
    }

    overlayRoot.render(<FullscreenOverlayButton onClick={exitFullscreenSafely} />);
  };

  const handleChange = () => {
    const element = resolveFullscreenElement(targetDoc);
    const state = detectMediaKind(element);
    lastState = state;

    if (options.onChange) {
      options.onChange(state);
    }

    if (state.isFullscreen && renderOverlay) {
      renderOverlayButton();
    } else {
      unmountOverlay();
    }
  };

  const start = () => {
    if (!targetDoc || started) return;
    started = true;
    targetDoc.addEventListener('fullscreenchange', handleChange);
    targetDoc.addEventListener('webkitfullscreenchange', handleChange);
    handleChange();
  };

  const stop = () => {
    if (!targetDoc || !started) return;
    started = false;
    targetDoc.removeEventListener('fullscreenchange', handleChange);
    targetDoc.removeEventListener('webkitfullscreenchange', handleChange);
    unmountOverlay();
  };

  const requestSidebarOpen = async () => {
    await exitFullscreenSafely();
  };

  return {
    start,
    stop,
    isActive: () => started,
    requestSidebarOpen,
  };
}
