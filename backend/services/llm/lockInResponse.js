const { createChatCompletion } = require('./providerChain');
const { sanitizeHistory, clampHistory } = require('./history');

function buildModeDirective(mode) {
  switch (mode) {
    case 'explain':
    default:
      return "Explain the passage clearly, connect the main idea to the reader's studies, and provide at most one short example when helpful.";
  }
}

function buildSystemMessage({ mode }) {
  const directive = buildModeDirective(mode);
  const content = [
    'You are Lock-in, an AI study helper that replies as a concise, friendly tutor.',
    'Keep answers grounded in the provided conversation and original text.',
    directive,
    'Maintain academic integrity, cite the source text implicitly, and never introduce unrelated facts.',
  ].join(' ');

  return { role: 'system', content };
}

function buildInitialHistory({ selection, mode }) {
  const systemMessage = buildSystemMessage({
    mode,
  });

  // Include the original text only if we have a selection
  // This provides context for the system message
  const userMessage = selection
    ? {
        role: 'user',
        content: `Original text:\n${selection}`,
      }
    : null;

  return userMessage ? [systemMessage, userMessage] : [systemMessage];
}

async function requestCompletion(messages) {
  const completion = await createChatCompletion({
    messages,
    temperature: 0.4,
    maxTokens: 700,
    operation: 'chat.completions.create',
  });

  const choice = completion.choices[0]?.message;
  const assistantMessage = {
    role: choice?.role || 'assistant',
    content: (choice?.content || '').trim(),
  };

  return {
    assistantMessage,
    usage: completion.usage || null,
  };
}

async function generateLockInResponse(options) {
  const { selection, mode, chatHistory = [], newUserMessage } = options;

  const baseHistory = sanitizeHistory(chatHistory);
  let messages = baseHistory.length ? baseHistory : buildInitialHistory({ selection, mode });

  // Always replace or add the system message to ensure the current mode directive is used
  const systemMessage = buildSystemMessage({
    mode,
  });
  const messagesWithoutSystem = messages.filter((msg) => msg.role !== 'system');
  messages = [systemMessage, ...messagesWithoutSystem];

  let workingHistory = messages;

  if (newUserMessage && newUserMessage.trim().length) {
    workingHistory = [...messages, { role: 'user', content: newUserMessage.trim() }];
  }

  workingHistory = clampHistory(workingHistory);

  const { assistantMessage, usage } = await requestCompletion(workingHistory);
  const updatedHistory = [...workingHistory, assistantMessage];

  return {
    answer: assistantMessage.content,
    chatHistory: updatedHistory,
    usage,
  };
}

module.exports = {
  generateLockInResponse,
};
