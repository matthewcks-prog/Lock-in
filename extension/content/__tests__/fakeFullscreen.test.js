import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

window.LockInContent = window.LockInContent || {};
await import('../fakeFullscreenHelpers.js');
// Exit button module must load before fakeFullscreen (mirrors manifest order)
await import('../fakeFullscreenExitButton.js');
await import('../fakeFullscreen.js');

const { createFakeFullscreen } = window.LockInContent;

function restorePrototypeMethod(name, descriptor) {
  if (descriptor) {
    Object.defineProperty(Element.prototype, name, descriptor);
    return;
  }
  delete Element.prototype[name];
}

describe('fakeFullscreen content script', () => {
  let fakeFullscreen;
  let logger;
  let stateStore;
  let stateSubscriber;
  let requestDescriptor;
  let webkitDescriptor;

  beforeEach(() => {
    requestDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'requestFullscreen');
    webkitDescriptor = Object.getOwnPropertyDescriptor(
      Element.prototype,
      'webkitRequestFullscreen',
    );

    logger = {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    stateSubscriber = null;
    stateStore = {
      getSnapshot: vi.fn().mockReturnValue({ isSidebarOpen: true }),
      subscribe: vi.fn((callback) => {
        stateSubscriber = callback;
        return vi.fn();
      }),
    };

    fakeFullscreen = createFakeFullscreen({ Logger: logger, stateStore });
  });

  afterEach(() => {
    if (fakeFullscreen) {
      fakeFullscreen.destroy();
      fakeFullscreen = null;
    }

    restorePrototypeMethod('requestFullscreen', requestDescriptor);
    restorePrototypeMethod('webkitRequestFullscreen', webkitDescriptor);

    document.body.classList.remove('lockin-fake-fullscreen');
    document.body.classList.remove('lockin-sidebar-open');

    // Clean up exit button if still present
    const exitBtn = document.getElementById('lockin-fake-fullscreen-exit');
    if (exitBtn) exitBtn.remove();

    document.body.innerHTML = '';

    vi.restoreAllMocks();
  });

  it('exports createFakeFullscreen', () => {
    expect(typeof createFakeFullscreen).toBe('function');
  });

  it('activates fake fullscreen for video when sidebar is open', async () => {
    const nativeRequest = vi.fn().mockResolvedValue('native-result');
    Object.defineProperty(Element.prototype, 'requestFullscreen', {
      configurable: true,
      writable: true,
      value: nativeRequest,
    });

    const video = document.createElement('video');
    document.body.appendChild(video);

    fakeFullscreen.init();
    const result = await video.requestFullscreen();

    expect(result).toBeUndefined();
    expect(fakeFullscreen.isActive()).toBe(true);
    expect(nativeRequest).not.toHaveBeenCalled();
    expect(video.classList.contains('lockin-fake-fullscreen-video')).toBe(true);
    expect(document.body.classList.contains('lockin-fake-fullscreen')).toBe(true);
  });

  it('uses native fullscreen for video when sidebar is closed', async () => {
    stateStore.getSnapshot.mockReturnValue({ isSidebarOpen: false });

    const nativeRequest = vi.fn().mockResolvedValue('native-result');
    Object.defineProperty(Element.prototype, 'requestFullscreen', {
      configurable: true,
      writable: true,
      value: nativeRequest,
    });

    const video = document.createElement('video');
    document.body.appendChild(video);

    fakeFullscreen.init();
    const result = await video.requestFullscreen();

    expect(result).toBe('native-result');
    expect(fakeFullscreen.isActive()).toBe(false);
    expect(nativeRequest).toHaveBeenCalledTimes(1);
  });

  it('passes non-video elements through native fullscreen', async () => {
    const nativeRequest = vi.fn().mockResolvedValue('native-result');
    Object.defineProperty(Element.prototype, 'requestFullscreen', {
      configurable: true,
      writable: true,
      value: nativeRequest,
    });

    const panel = document.createElement('div');
    document.body.appendChild(panel);

    fakeFullscreen.init();
    const result = await panel.requestFullscreen();

    expect(result).toBe('native-result');
    expect(nativeRequest).toHaveBeenCalledTimes(1);
    expect(fakeFullscreen.isActive()).toBe(false);
  });

  it('exits fake fullscreen on Escape', () => {
    const video = document.createElement('video');
    document.body.appendChild(video);

    fakeFullscreen.init();
    fakeFullscreen.activate(video);
    expect(fakeFullscreen.isActive()).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(fakeFullscreen.isActive()).toBe(false);
    expect(document.body.classList.contains('lockin-fake-fullscreen')).toBe(false);
  });

  it('creates an exit button when fake fullscreen activates', () => {
    const video = document.createElement('video');
    document.body.appendChild(video);

    fakeFullscreen.init();
    fakeFullscreen.activate(video);

    const exitBtn = document.getElementById('lockin-fake-fullscreen-exit');
    expect(exitBtn).toBeTruthy();
    expect(exitBtn.getAttribute('aria-label')).toBe('Exit fullscreen');
  });

  it('removes exit button when fake fullscreen deactivates', () => {
    const video = document.createElement('video');
    document.body.appendChild(video);

    fakeFullscreen.init();
    fakeFullscreen.activate(video);
    expect(document.getElementById('lockin-fake-fullscreen-exit')).toBeTruthy();

    fakeFullscreen.deactivate();
    expect(document.getElementById('lockin-fake-fullscreen-exit')).toBeFalsy();
  });

  it('deactivates fake fullscreen when exit button is clicked', () => {
    const video = document.createElement('video');
    document.body.appendChild(video);

    fakeFullscreen.init();
    fakeFullscreen.activate(video);
    expect(fakeFullscreen.isActive()).toBe(true);

    const exitBtn = document.getElementById('lockin-fake-fullscreen-exit');
    exitBtn.click();

    expect(fakeFullscreen.isActive()).toBe(false);
    expect(document.body.classList.contains('lockin-fake-fullscreen')).toBe(false);
    expect(document.getElementById('lockin-fake-fullscreen-exit')).toBeFalsy();
  });

  it('transitions to native fullscreen when sidebar closes during fake fullscreen', () => {
    const nativeRequest = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(Element.prototype, 'requestFullscreen', {
      configurable: true,
      writable: true,
      value: nativeRequest,
    });

    const video = document.createElement('video');
    document.body.appendChild(video);

    fakeFullscreen.init();
    fakeFullscreen.activate(video);
    expect(fakeFullscreen.isActive()).toBe(true);

    stateSubscriber({ isSidebarOpen: false });

    expect(fakeFullscreen.isActive()).toBe(false);
    expect(document.body.classList.contains('lockin-fake-fullscreen')).toBe(false);
    expect(nativeRequest).toHaveBeenCalledTimes(1);
  });

  it('intercepts native fullscreenchange for video when sidebar is open', async () => {
    const video = document.createElement('video');
    document.body.appendChild(video);

    const fullscreenDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
    let fullscreenElement = null;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });

    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      writable: true,
      value: exitFullscreen,
    });

    try {
      fakeFullscreen.init();
      fullscreenElement = video;
      document.dispatchEvent(new Event('fullscreenchange'));

      await vi.waitFor(() => {
        expect(fakeFullscreen.isActive()).toBe(true);
      });

      expect(exitFullscreen).toHaveBeenCalledTimes(1);
      expect(video.classList.contains('lockin-fake-fullscreen-video')).toBe(true);
    } finally {
      if (fullscreenDescriptor) {
        Object.defineProperty(document, 'fullscreenElement', fullscreenDescriptor);
      } else {
        delete document.fullscreenElement;
      }
      delete document.exitFullscreen;
    }
  });

  it('does not intercept native fullscreenchange when sidebar is closed', async () => {
    stateStore.getSnapshot.mockReturnValue({ isSidebarOpen: false });

    const video = document.createElement('video');
    document.body.appendChild(video);

    const fullscreenDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
    let fullscreenElement = null;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });

    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      writable: true,
      value: exitFullscreen,
    });

    try {
      fakeFullscreen.init();
      fullscreenElement = video;
      document.dispatchEvent(new Event('fullscreenchange'));

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(fakeFullscreen.isActive()).toBe(false);
      expect(exitFullscreen).not.toHaveBeenCalled();
    } finally {
      if (fullscreenDescriptor) {
        Object.defineProperty(document, 'fullscreenElement', fullscreenDescriptor);
      } else {
        delete document.fullscreenElement;
      }
      delete document.exitFullscreen;
    }
  });

  it('restores fullscreen APIs when destroyed', () => {
    const nativeRequest = vi.fn().mockResolvedValue(undefined);
    const nativeWebkitRequest = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(Element.prototype, 'requestFullscreen', {
      configurable: true,
      writable: true,
      value: nativeRequest,
    });
    Object.defineProperty(Element.prototype, 'webkitRequestFullscreen', {
      configurable: true,
      writable: true,
      value: nativeWebkitRequest,
    });

    fakeFullscreen.init();

    const patchedRequest = Element.prototype.requestFullscreen;
    const patchedWebkitRequest = Element.prototype.webkitRequestFullscreen;

    expect(patchedRequest).not.toBe(nativeRequest);
    expect(patchedWebkitRequest).not.toBe(nativeWebkitRequest);

    fakeFullscreen.destroy();

    expect(Element.prototype.requestFullscreen).toBe(nativeRequest);
    expect(Element.prototype.webkitRequestFullscreen).toBe(nativeWebkitRequest);
  });

  it('cleans up correctly when native fullscreen exits after fake→native transition', async () => {
    const nativeRequest = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(Element.prototype, 'requestFullscreen', {
      configurable: true,
      writable: true,
      value: nativeRequest,
    });

    const video = document.createElement('video');
    document.body.appendChild(video);

    const savedDescriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
    const fullscreenElement = null;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });

    const restoreFullscreenElement = () => {
      if (savedDescriptor) {
        Object.defineProperty(document, 'fullscreenElement', savedDescriptor);
      } else {
        delete document.fullscreenElement;
      }
    };

    try {
      fakeFullscreen.init();
      fakeFullscreen.activate(video);
      stateSubscriber({ isSidebarOpen: false });

      // Wait for .finally() to fire, which sets state.inNativeFullscreen = true
      await vi.waitFor(() => expect(nativeRequest.mock.results[0].value).resolves.toBeUndefined());

      // Simulate native fullscreen exit (user clicks exit button / ESC)
      document.dispatchEvent(new Event('fullscreenchange'));

      expect(fakeFullscreen.isActive()).toBe(false);
      expect(document.body.classList.contains('lockin-fake-fullscreen')).toBe(false);
      expect(document.getElementById('lockin-fake-fullscreen-exit')).toBeFalsy();
    } finally {
      restoreFullscreenElement();
    }
  });
});
