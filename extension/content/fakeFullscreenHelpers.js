/**
 * Shared helpers for fake fullscreen behavior.
 */
(function () {
  const STYLE_KEYS = [
    'position',
    'top',
    'left',
    'width',
    'height',
    'zIndex',
    'maxWidth',
    'maxHeight',
    'objectFit',
    'margin',
    'padding',
    'transform',
  ];

  function captureInlineStyles(element) {
    const saved = {};
    STYLE_KEYS.forEach((key) => {
      saved[key] = element.style[key];
    });
    return saved;
  }

  function restoreInlineStyles(element, savedStyles) {
    if (!element || !savedStyles) return;
    STYLE_KEYS.forEach((key) => {
      element.style[key] = savedStyles[key];
    });
  }

  function isVideoRelatedElement(element) {
    if (!element || typeof element.tagName !== 'string') return false;
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'video' || tagName === 'iframe') return true;
    return typeof element.querySelector === 'function' && element.querySelector('video') !== null;
  }

  function resolveExitButtonHelpers(explicitHelpers) {
    if (explicitHelpers && typeof explicitHelpers === 'object') {
      return explicitHelpers;
    }
    const content = typeof window !== 'undefined' ? window.LockInContent : null;
    return {
      create: content && content.createExitButton ? content.createExitButton : () => {},
      remove: content && content.removeExitButton ? content.removeExitButton : () => {},
    };
  }

  function resolveScrollbarManager(explicitManager) {
    if (explicitManager && typeof explicitManager.forceUpdate === 'function') {
      return explicitManager;
    }
    const content = typeof window !== 'undefined' ? window.LockInContent : null;
    return content && content.scrollbarManager ? content.scrollbarManager : null;
  }

  function updateScrollbarWidth(explicitManager) {
    const schedule =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (callback) => setTimeout(callback, 0);
    schedule(() => {
      const manager = resolveScrollbarManager(explicitManager);
      if (manager && typeof manager.forceUpdate === 'function') {
        manager.forceUpdate();
      }
    });
  }

  window.LockInContent = window.LockInContent || {};
  window.LockInContent.fakeFullscreenHelpers = {
    captureInlineStyles,
    restoreInlineStyles,
    isVideoRelatedElement,
    resolveExitButtonHelpers,
    updateScrollbarWidth,
  };
})();
