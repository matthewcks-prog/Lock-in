/**
 * Chrome Messaging Wrapper for Extension Content Scripts
 *
 * Provides type-safe messaging between content scripts, background script,
 * and other extension components.
 * Exposes window.LockInMessaging for use by content scripts.
 *
 * This is bundled by vite.config.contentLibs.ts into extension/dist/libs/
 */

export interface Messaging {
  sendToBackground: <T = unknown>(message: unknown) => Promise<T>;
  onMessage: (
    callback: (
      message: unknown,
      sender: chrome.runtime.MessageSender,
    ) => unknown | Promise<unknown>,
  ) => () => void;
  sendToTab: <T = unknown>(tabId: number, message: unknown) => Promise<T>;
}

type MessageCallback = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
) => unknown | Promise<unknown>;

async function withRuntimeResponse<T>(executor: (done: (response: T) => void) => void): Promise<T> {
  return await new Promise((resolve, reject) => {
    try {
      executor((response) => {
        const lastError = chrome.runtime.lastError;
        if (lastError !== undefined && lastError !== null) {
          reject(new Error(lastError.message));
          return;
        }
        resolve(response);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function createOnMessageListener(callback: MessageCallback) {
  return (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ): boolean | void => {
    try {
      const result = callback(message, sender);
      if (result instanceof Promise) {
        result.then(sendResponse).catch((err: Error) => {
          console.error('[Lock-in] Message handler error:', err);
          sendResponse({ error: err.message });
        });
        return true;
      }
      if (result !== undefined) {
        sendResponse(result);
      }
      return undefined;
    } catch (err) {
      console.error('[Lock-in] Message handler error:', err);
      sendResponse({ error: err instanceof Error ? err.message : 'Unknown error' });
      return undefined;
    }
  };
}

function createMessaging(): Messaging {
  const sendToBackground = async <T = unknown>(message: unknown): Promise<T> =>
    withRuntimeResponse((done) => {
      chrome.runtime.sendMessage(message, done);
    });

  const sendToTab = async <T = unknown>(tabId: number, message: unknown): Promise<T> =>
    withRuntimeResponse((done) => {
      chrome.tabs.sendMessage(tabId, message, done);
    });

  const onMessage = (callback: MessageCallback): (() => void) => {
    const listener = createOnMessageListener(callback);
    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  };

  return { sendToBackground, onMessage, sendToTab };
}

const messaging = createMessaging();

if (typeof window !== 'undefined') {
  window.LockInMessaging = messaging;
}

export { messaging };
