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
  /**
   * Send a message to the background script
   */
  sendToBackground: <T = unknown>(message: unknown) => Promise<T>;

  /**
   * Listen for messages from background or other parts of extension
   */
  onMessage: (
    callback: (
      message: unknown,
      sender: chrome.runtime.MessageSender,
    ) => unknown | Promise<unknown>,
  ) => () => void;

  /**
   * Send message to a specific tab
   */
  sendToTab: <T = unknown>(tabId: number, message: unknown) => Promise<T>;
}

/**
 * Create the messaging wrapper
 */
function createMessaging(): Messaging {
  return {
    sendToBackground<T = unknown>(message: unknown): Promise<T> {
      return new Promise((resolve, reject) => {
        try {
          chrome.runtime.sendMessage(message, (response: T) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        } catch (err) {
          reject(err);
        }
      });
    },

    onMessage(
      callback: (
        message: unknown,
        sender: chrome.runtime.MessageSender,
      ) => unknown | Promise<unknown>,
    ): () => void {
      const listener = (
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
            return true; // Keep channel open for async response
          }

          if (result !== undefined) {
            sendResponse(result);
          }
        } catch (err) {
          console.error('[Lock-in] Message handler error:', err);
          sendResponse({ error: err instanceof Error ? err.message : 'Unknown error' });
        }
      };

      chrome.runtime.onMessage.addListener(listener);

      // Return unsubscribe function
      return () => {
        chrome.runtime.onMessage.removeListener(listener);
      };
    },

    sendToTab<T = unknown>(tabId: number, message: unknown): Promise<T> {
      return new Promise((resolve, reject) => {
        try {
          chrome.tabs.sendMessage(tabId, message, (response: T) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        } catch (err) {
          reject(err);
        }
      });
    },
  };
}

// Create and expose messaging
const messaging = createMessaging();

// Expose globally for content scripts
if (typeof window !== 'undefined') {
  (window as any).LockInMessaging = messaging;
}

export { messaging };
