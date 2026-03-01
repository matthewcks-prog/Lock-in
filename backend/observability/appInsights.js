const appInsights = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING
  ? require('applicationinsights')
  : null;
const { FIVE, THOUSAND } = require('../constants/numbers');
const { IS_PRODUCTION } = require('./logger');

const APP_INSIGHTS_FLUSH_TIMEOUT_MS = FIVE * THOUSAND;

let appInsightsClient = null;
let appInsightsInitialized = false;
let isShuttingDown = false;

function suppressOTelWarningsInDev() {
  if (IS_PRODUCTION) {
    return;
  }

  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  const shouldSuppress = (args) => {
    const message = args[0];
    if (typeof message !== 'string') {
      return false;
    }
    return (
      message.includes('shutdown may only be called once per MeterProvider') ||
      message.includes('shutdown may only be called once per TracerProvider')
    );
  };

  console.log = (...args) => {
    if (!shouldSuppress(args)) {
      originalConsoleLog.apply(console, args);
    }
  };
  console.warn = (...args) => {
    if (!shouldSuppress(args)) {
      originalConsoleWarn.apply(console, args);
    }
  };
  console.error = (...args) => {
    if (!shouldSuppress(args)) {
      originalConsoleError.apply(console, args);
    }
  };
}

function getAppInsightsConnectionString() {
  if (appInsightsInitialized) {
    console.log('[AppInsights] Already initialized, skipping');
    return null;
  }

  if (!appInsights) {
    if (!IS_PRODUCTION) {
      console.log('[AppInsights] Module not loaded, skipping initialization');
    }
    appInsightsInitialized = true;
    return null;
  }

  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!connectionString) {
    if (!IS_PRODUCTION) {
      console.log('[AppInsights] No connection string configured, skipping initialization');
    }
    appInsightsInitialized = true;
    return null;
  }

  return connectionString;
}

function startApplicationInsights(connectionString) {
  try {
    appInsights
      .setup(connectionString)
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true, false)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(true, true)
      .setAutoCollectPreAggregatedMetrics(true)
      .setSendLiveMetrics(IS_PRODUCTION)
      .setUseDiskRetryCaching(true)
      .setInternalLogging(false, false);

    appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRole] =
      'lockin-backend';

    appInsights.start();
    appInsightsClient = appInsights.defaultClient;
    appInsightsInitialized = true;

    console.log('[AppInsights] Initialized successfully');
    return true;
  } catch (error) {
    if (error.message?.includes('MeterProvider') || error.message?.includes('already')) {
      console.log('[AppInsights] Skipping re-initialization (hot-reload detected)');
      appInsightsInitialized = true;
      return false;
    }
    console.error('[AppInsights] Failed to initialize:', error.message);
    return false;
  }
}

function initApplicationInsights() {
  const connectionString = getAppInsightsConnectionString();
  if (!connectionString) {
    return Boolean(appInsightsClient);
  }

  return startApplicationInsights(connectionString);
}

async function disposeApplicationInsights() {
  if (isShuttingDown || !appInsightsClient) {
    return;
  }

  isShuttingDown = true;

  try {
    await new Promise((resolve) => {
      appInsightsClient.flush({
        callback: () => {
          console.log('[AppInsights] Telemetry flushed');
          resolve();
        },
      });

      setTimeout(resolve, APP_INSIGHTS_FLUSH_TIMEOUT_MS);
    });

    appInsights.dispose();
    console.log('[AppInsights] Disposed successfully');
  } catch (error) {
    if (!error.message?.includes('MeterProvider')) {
      console.error('[AppInsights] Error during dispose:', error.message);
    }
  }
}

function getAppInsightsClient() {
  return appInsightsClient;
}

function trackMetric(name, value, properties = {}) {
  if (!appInsightsClient) {
    return;
  }

  appInsightsClient.trackMetric({
    name,
    value,
    properties,
  });
}

function trackEvent(name, properties = {}, measurements = {}) {
  if (!appInsightsClient) {
    return;
  }

  appInsightsClient.trackEvent({
    name,
    properties,
    measurements,
  });
}

suppressOTelWarningsInDev();

module.exports = {
  initApplicationInsights,
  disposeApplicationInsights,
  getAppInsightsClient,
  trackMetric,
  trackEvent,
  suppressOTelWarningsInDev,
};
