const { LONG_INPUT_THRESHOLD } = require('./constants');

function getLastUserMessageContent(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role !== 'user') {
      continue;
    }

    const content = messages[index].content;
    return typeof content === 'string' ? content : content?.[0]?.text || '';
  }
  return '';
}

function needsUpgradedModel(userMessage, options) {
  if (!userMessage) {
    return false;
  }

  const lowerMessage = userMessage.toLowerCase();
  const upgradePatterns = [
    'step-by-step',
    'step by step',
    'detailed',
    'explain in depth',
    'comprehensive',
  ];

  const isLongInput = userMessage.length > LONG_INPUT_THRESHOLD;
  const needsStructuredOutput =
    options.responseFormat?.type === 'json_object' ||
    lowerMessage.includes('table') ||
    lowerMessage.includes('json');

  return (
    isLongInput ||
    needsStructuredOutput ||
    upgradePatterns.some((pattern) => lowerMessage.includes(pattern))
  );
}

function selectModel(messages, options, models) {
  if (options.usePremiumModel) {
    return models.premium;
  }

  if (options.useUpgradedModel) {
    return models.upgraded;
  }

  const lastUserMessage = getLastUserMessageContent(messages);
  return needsUpgradedModel(lastUserMessage, options) ? models.upgraded : models.default;
}

module.exports = {
  selectModel,
  needsUpgradedModel,
  getLastUserMessageContent,
};
