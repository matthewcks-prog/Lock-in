import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

window.LockInContent = window.LockInContent || {};
await import('../fakeFullscreenHelpers.js');
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

describe('fakeFullscreen edge cases', () => {
  let fakeFullscreen;
  let stateStore;
  let stateSubscriber;
  let requestDescriptor;

  beforeEach(() => {
    requestDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'requestFullscreen');
    stateSubscriber = null;
    stateStore = {
      getSnapshot: vi.fn().mockReturnValue({ isSidebarOpen: true }),
      subscribe: vi.fn((callback) => {
        stateSubscriber = callback;
        return vi.fn();
      }),
    };
    fakeFullscreen = createFakeFullscreen({
      Logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
      stateStore,
    });
  });

  afterEach(() => {
    if (fakeFullscreen) {
      fakeFullscreen.destroy();
      fakeFullscreen = null;
    }
    restorePrototypeMethod('requestFullscreen', requestDescriptor);
    document.body.classList.remove('lockin-fake-fullscreen');
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('falls back to native request when activation is throttled', async () => {
    const nativeRequest = vi.fn().mockResolvedValue('native-result');
    Object.defineProperty(Element.prototype, 'requestFullscreen', {
      configurable: true,
      writable: true,
      value: nativeRequest,
    });

    const dateSpy = vi.spyOn(Date, 'now');
    dateSpy.mockReturnValueOnce(1000).mockReturnValueOnce(1000).mockReturnValueOnce(1100);

    const video = document.createElement('video');
    document.body.appendChild(video);

    fakeFullscreen.init();
    fakeFullscreen.activate(video);
    fakeFullscreen.deactivate();

    const result = await video.requestFullscreen();

    expect(result).toBe('native-result');
    expect(fakeFullscreen.isActive()).toBe(false);
    expect(nativeRequest).toHaveBeenCalledTimes(1);
  });

  it('ignores non-boolean sidebar snapshots from the state store', () => {
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
    stateSubscriber(undefined);

    expect(fakeFullscreen.isActive()).toBe(true);
    expect(nativeRequest).not.toHaveBeenCalled();
  });
});
