const {
  initApplicationInsights,
  disposeApplicationInsights,
  getAppInsightsClient,
  trackMetric,
  trackEvent,
} = require('./appInsights');
const { logger, createChildLogger, LOG_LEVEL } = require('./logger');
const { createLlmUsageTracker } = require('./llmUsage');

const trackLlmUsage = createLlmUsageTracker({
  logger,
  trackMetric,
  trackEvent,
});

module.exports = {
  initApplicationInsights,
  disposeApplicationInsights,
  getAppInsightsClient,
  trackMetric,
  trackEvent,
  logger,
  createChildLogger,
  trackLlmUsage,
  LOG_LEVEL,
};
