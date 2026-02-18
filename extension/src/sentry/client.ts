import {
  BrowserClient,
  defaultStackParser,
  getDefaultIntegrations,
  makeFetchTransport,
  Scope,
} from '@sentry/browser';
import { beforeSendScrubber } from './privacy';
import { getExtensionVersion } from './utils';
import { PROD_TRACES_SAMPLE_RATE } from './runtime';
import type { GlobalWithChrome, Surface } from './types';

type CreateSentryClientParams = {
  dsn: string;
  isDevelopment: boolean;
  globalWithChrome: GlobalWithChrome;
};

function getSentryIntegrations(): ReturnType<typeof getDefaultIntegrations> {
  return getDefaultIntegrations({}).filter(
    (integration) =>
      !['BrowserApiErrors', 'Breadcrumbs', 'GlobalHandlers'].includes(integration.name),
  );
}

export function createSentryClient({
  dsn,
  isDevelopment,
  globalWithChrome,
}: CreateSentryClientParams): BrowserClient {
  const extensionVersion = getExtensionVersion(globalWithChrome.chrome);

  return new BrowserClient({
    dsn,
    transport: makeFetchTransport,
    stackParser: defaultStackParser,
    integrations: getSentryIntegrations(),
    debug: isDevelopment,
    environment: isDevelopment ? 'development' : 'production',
    release: `lockin-extension@${extensionVersion}`,
    sendDefaultPii: false,
    tracesSampleRate: isDevelopment ? 1.0 : PROD_TRACES_SAMPLE_RATE,
    attachStacktrace: true,
    normalizeDepth: 5,
    beforeSend: beforeSendScrubber,
    ignoreErrors: [
      'Extension context invalidated',
      'The message port closed',
      'Could not establish connection',
      'Receiving end does not exist',
      'ResizeObserver loop',
      'ResizeObserver loop limit exceeded',
      'Network request failed',
      'Failed to fetch',
      'NetworkError',
      'Load failed',
      'net::ERR_',
      'AbortError',
      'The operation was aborted',
    ],
  });
}

export function initializeScope(
  client: BrowserClient,
  surface: Surface,
  globalWithChrome: GlobalWithChrome,
): Scope {
  const scope = new Scope();
  scope.setClient(client);
  scope.setTag('surface', surface);
  scope.setTag('extensionVersion', getExtensionVersion(globalWithChrome.chrome));
  client.init();
  return scope;
}
