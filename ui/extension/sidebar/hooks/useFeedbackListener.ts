import { useEffect } from 'react';

interface FeedbackMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * Hook to listen for feedback-related messages from the extension.
 */
export function useFeedbackListener(onOpen: () => void): void {
  useEffect(() => {
    if (typeof chrome === 'undefined' || chrome.runtime?.onMessage === undefined) {
      return;
    }

    const listener = (
      message: FeedbackMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: { success: boolean }) => void,
    ): boolean | void => {
      if (message?.type === 'OPEN_FEEDBACK') {
        onOpen();
        sendResponse({ success: true });
        return true;
      }
      return undefined;
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [onOpen]);
}
