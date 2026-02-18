import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

window.LockInContent = window.LockInContent || {};
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

    const toggleButton = document.getElementById('lockin-fake-fs-toggle');
    if (toggleButton) {
      toggleButton.remove();
    }

    document.body.innerHTML = '';

    vi.restoreAllMocks();
  });

  it('exports createFakeFullscreen', () => {
    expect(typeof createFakeFullscreen).toBe('function');
  });

  it('intercepts video fullscreen requests and activates fake fullscreen', async () => {
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

  it('intercepts native fullscreenchange for video-like elements', async () => {
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

  it('updates toggle visibility when sidebar state changes', () => {
    const video = document.createElement('video');
    document.body.appendChild(video);

    fakeFullscreen.init();
    fakeFullscreen.activate(video);

    const toggleButton = document.getElementById('lockin-fake-fs-toggle');
    expect(toggleButton).not.toBeNull();
    expect(stateSubscriber).not.toBeNull();
    expect(toggleButton.classList.contains('lockin-fake-fs-toggle--visible')).toBe(true);

    stateSubscriber({ isSidebarOpen: false });
    expect(toggleButton.classList.contains('lockin-fake-fs-toggle--visible')).toBe(false);

    stateSubscriber({ isSidebarOpen: true });
    expect(toggleButton.classList.contains('lockin-fake-fs-toggle--visible')).toBe(true);
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
});
