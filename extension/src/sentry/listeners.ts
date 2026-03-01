import type { BrowserClient } from '@sentry/browser';

const EXTENSION_FILENAME_MARKERS = ['chrome-extension://', 'dist/ui/', 'dist/libs/', 'extension/'];

export function isExtensionErrorFilename(filename: string): boolean {
  return EXTENSION_FILENAME_MARKERS.some((marker) => filename.includes(marker));
}

export function toError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason));
}

export function setupWindowErrorListeners(client: BrowserClient, isDevelopment: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.addEventListener('error', (event) => {
    if (event.error === undefined || event.error === null) {
      return;
    }

    const filename = event.filename ?? '';
    if (isDevelopment || isExtensionErrorFilename(filename)) {
      client.captureException(event.error);
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    client.captureException(toError(event.reason));
  });
}
